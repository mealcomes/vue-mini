import { LifecycleHooks } from './enums'
import {
    currentInstance,
    setCurrentInstance,
} from './component'


export function injectHook(type, hook, target) {
    if (target) {
        // 当前钩子是在组件中运行的
        // 看当前钩子是否已经存放，且会存在多个钩子函数
        const hooks = target[type] || (target[type] = []);

        // 钩子函数一定是在setup函数执行完之后执行的
        // 而 setup 函数执行完后全局实例会被置为 null 
        // 此处便是为了确保在钩子函数中能拿到当前组件的实例
        // 见 index.html 中的生命周期钩子相关注释
        const wrappedHook = (...args: unknown[]) => {
            const reset = setCurrentInstance(target)
            const res = hook(...args);
            reset()
            return res
        }
        hooks.push(wrappedHook);
        return wrappedHook;
    } else {
        console.warn(`${type} is called when there is no active component instance 
                to be associated with.`);
    }
}

const createHook = (lifecycle) => {
    // 注意，返回值是一个函数，即创建一个钩子函数
    // 并且将当前实例存到该钩子上(通过闭包，实例会暂存为该函数的target)
    return (hook, target = currentInstance) => {
        injectHook(lifecycle, (...args: unknown[]) => hook(...args), target);
    }
}

export const onBeforeMount = createHook(LifecycleHooks.BEFORE_MOUNT)
export const onMounted = createHook(LifecycleHooks.MOUNTED)
export const onBeforeUpdate = createHook(LifecycleHooks.BEFORE_UPDATE)
export const onUpdated = createHook(LifecycleHooks.UPDATED)