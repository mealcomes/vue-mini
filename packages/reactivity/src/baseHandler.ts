import { isObject, isSymbol } from "@vue/shared";
import { track, trigger } from "./reactiveEffect";
import { reactive } from "./reactive";
import { ReactiveFlags } from "./constants";

const isNonTrackableKeys = (key) => {
    return key === '__proto__' || key === '__v_isRef';
}

const builtInSymbols = new Set(
    Object.getOwnPropertyNames(Symbol)
        .filter(key => key !== 'arguments' && key !== 'caller')
        .map(key => Symbol[key as keyof SymbolConstructor])
        .filter((val) => typeof val === 'symbol'),
)

export const mutableHandlers: ProxyHandler<object> = {
    get(target, key, receiver) {
        if (key === ReactiveFlags.IS_REACTIVE) {
            return true;
        }

        // 当取值的时候，应让响应式属性和effect映射起来

        let res = Reflect.get(target, key, receiver);

        // 当key为原型上的属性或为'__is_Ref'等时应直接将结果返回
        if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
            return res;
        }

        // 收集target对象上的key属性，并将其与activeEffect关联起来
        track(target, key);

        if (isObject(res)) {  // 当取的值也为对象,需要对该对象继续代理(递归代理)
            return reactive(res);
        }

        return res; // 使用Reflect原因见 questions/1.js
    },
    set(target, key, value, receiver) {
        // 找到属性，让对应的effect重写执行
        let oldValue = target[key];

        let res = Reflect.set(target, key, value, receiver);
        if (oldValue !== value) {
            trigger(target, key, value, oldValue);
        }

        return res;
    }
}