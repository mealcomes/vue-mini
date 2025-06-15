import { activeEffect, trackEffect, triggerEffects } from "./effect";

/**
 * 存放依赖收集的关系
 */
const targetMap = new WeakMap();
// 形式如下
// Map: {obj: {keyofObj: {effect0: 0, effect1: 0, ...}}}
// {
//     {name: 'Bob', age: 30}: {
//         age: {
//             effect: 0
//         },
//         name: {
//             effect1: 0,
//             effect2: 0
//         }
//     }
// }

/**
 * 该函数中为dep添加clearup的原因如下
 * ```
 * const state = reactive({
 * name: 'Bob',
 * age: 30,
 * flag: false,
 * });
 * effect(() => {
 *     el.innerHTML = state.flag ? `姓名:${state.name}` : `年龄:${state.age}`
 * })
 * setTimeout(() => {
 *     state.flag = true;
 *     setTimeout(() => {
 *         // 由于state.flag变为true，上述effect走的是state.name，
 *         // 故此时不应该触发上面的effect。因此我们需要进行依赖清理
 *         state.age++;
 *     }, 1000)
 * }, 1000);
 * ```
 */
export const createDep = (cleanup: Function, key: string = undefined) => {
    const dep = new Map() as any;
    dep.cleanup = cleanup;

    if (key) {
        dep.key = key;
    }
    return dep;
}

export function track(target: object, key: any) {
    // 有activeEffect，则说明这个key是在effect内访问的，进行依赖收集
    if (!activeEffect) {
        return;
    }

    let depsMap: Map<any, any> = targetMap.get(target);

    if (!depsMap) {
        targetMap.set(target, depsMap = new Map())
    }

    let dep = depsMap.get(key);
    if (!dep) {
        depsMap.set(
            key,
            // 添加依赖清理函数
            dep = createDep(() => depsMap.delete(key), key)
        );
    }

    // 将当前effect放入到dep(映射表)中，后续可根据值的变化触发此dep中存放的effect
    trackEffect(activeEffect, dep);
}

export function trigger(target: object, key: unknown, newVal: any, oldVal: any) {
    let depsMap: Map<any, any> = targetMap.get(target);

    if (!depsMap) {
        return;
    }

    let dep = depsMap.get(key);
    if (dep) {
        triggerEffects(dep)
    }
}
