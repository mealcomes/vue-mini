import { isArray } from "@vue/shared";

const queue = [];                   // 缓存当前要执行的队列
const pendingPostFlushCbs = [];     // DOM 全部挂载完成后需要执行的任务
// let isFlushing = false;             // 是否正在刷新
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
    if (!currentFlushPromise) {
        currentFlushPromise = resolvedPromise.then(flushJobs)
    }
}

function flushJobs() {
    try {
        console.log('前置调度阶段');
        const copy = queue.slice(0);
        queue.length = 0;
        copy.forEach(job => job());
        copy.length = 0;
    } finally {
        queue.length = 0
        flushPostFlushCbs()
        currentFlushPromise = null
        if (queue.length || pendingPostFlushCbs.length) {
            flushJobs()
        }
    }
}

export function flushPostFlushCbs(): void {
    if (pendingPostFlushCbs.length) {
        console.log('后置调度阶段');
        const deduped = pendingPostFlushCbs.slice(0);
        pendingPostFlushCbs.length = 0
        deduped.forEach(job => job());
        deduped.length = 0;
    }
}
