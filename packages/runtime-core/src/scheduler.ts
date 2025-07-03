import { isArray } from "@vue/shared";

const queue = [];                   // 缓存当前要执行的队列
const pendingPostFlushCbs = [];     // DOM 全部挂载完成后需要执行的任务
const resolvedPromise = Promise.resolve();
let currentFlushPromise: Promise<void> | null = null


// 同时在一个组件中更新多个状态，job肯定是同一个
// 同时开启一个异步任务
export function queueJob(job) {
    if (!queue.includes(job)) { // 同一个任务去重
        queue.push(job);
    }
    queueFlush()
}

export function queuePostFlushCb(cb): void {
    if (!isArray(cb)) {
        pendingPostFlushCbs.push(cb)
    } else {
        pendingPostFlushCbs.push(...cb)
    }
    queueFlush()
}

function queueFlush() {
    // 如果当前有正在刷新的 Promise ，则跳过，因为flushJobs里面会进行递归调用flush
    if (!currentFlushPromise) {
        currentFlushPromise = resolvedPromise.then(flushJobs)
    }
}

/**
 * 先执行前置调度阶段任务(调度渲染 -> instance.update())
 * 后执行后置调度阶段任务渲染完成后的副作用逻辑(如访问 DOM、执行动画、通知外部系统、恢复状态等)
 */
function flushJobs() {
    try {
        const copy = queue.slice(0);
        queue.length = 0;
        copy.forEach(job => job());
        copy.length = 0;
    } finally {
        flushPostFlushCbs()
        currentFlushPromise = null
        if (queue.length || pendingPostFlushCbs.length) {
            flushJobs()
        }
    }
}

export function flushPostFlushCbs(): void {
    if (pendingPostFlushCbs.length) {
        const deduped = pendingPostFlushCbs.slice(0);
        pendingPostFlushCbs.length = 0
        deduped.forEach(job => job());
        deduped.length = 0;
    }
}
