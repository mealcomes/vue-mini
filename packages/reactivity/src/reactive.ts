import { isObject } from "@vue/shared";
import { mutableHandlers } from "./baseHandler";
import { ReactiveFlags } from "./constants";

// 用于记录代理后的结果，以便可以复用
const reactiveMap = new WeakMap();

function createReactiveObject(target: object) {
    if (!isObject(target)) {
        return target;
    }
    if (target[ReactiveFlags.IS_REACTIVE]) {
        return target;
    }
    const existingProxy = reactiveMap.get(target);
    if (existingProxy) {
        return existingProxy;
    }

    let proxy = new Proxy(target, mutableHandlers);

    // 缓存代理后的结果
    reactiveMap.set(target, proxy);

    return proxy;
}

export function reactive(target: object) {
    return createReactiveObject(target);
}

export function shallowReactive(target: object) {
    return createReactiveObject(target);
}

export function toReactive(value) {
    return isObject(value) ? reactive(value) : value;
}

export function isReactive(value) {
    return !!(value && value[ReactiveFlags.IS_REACTIVE])
}