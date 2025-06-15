import { isArray, isFunction, isMap, isObject, isPlainObject, isSet } from "@vue/shared";
import { ReactiveEffect } from "./effect";
import { isRef } from "./ref";
import { isReactive } from "./reactive";

export function watch(source, cb, options = {} as any) {
    return doWatch(source, cb, options);
}

// 等价于effect()
export function watchEffect(source, options = {} as any) {
    return doWatch(source, null, options);
}

// function traverse(source, depth, currentDepth = 0, seen = new Set()) {
//     if (!isObject(source)) {
//         return source;
//     }
//     if (depth) {
//         if (currentDepth <= depth) {
//             return source;
//         }
//         currentDepth++;
//     }

// }

export function traverse(
    value: any,
    depth: number = Infinity,
    seen?: Set<unknown>,
): unknown {
    if (depth <= 0 || !isObject(value)) {
        return value
    }

    seen = seen || new Set()
    if (seen.has(value)) {
        return value
    }
    seen.add(value)
    depth--
    if (isRef(value)) {
        traverse(value.value, depth, seen)
    } else if (isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            traverse(value[i], depth, seen)
        }
    } else if (isSet(value) || isMap(value)) {
        value.forEach((v: any) => {
            traverse(v, depth, seen)
        })
    } else if (isPlainObject(value)) {
        for (const key in value) {
            traverse(value[key], depth, seen)
        }
        for (const key of Object.getOwnPropertySymbols(value)) {
            if (Object.prototype.propertyIsEnumerable.call(value, key)) {
                traverse(value[key as any], depth, seen)
            }
        }
    }
    return value
}

function doWatch(source, cb, options) {
    const { immediate, deep } = options;

    const reactiveGetter = (source) => {
        if (deep === false || deep === 0) {
            return traverse(source, 1);
        }
        return traverse(source);
    }

    // 产生一个可以给ReactiveEffect来使用的getter，需要对这个对象进行取值操作，并且关联当前的reactiveEffect
    let getter;
    if (isReactive(source)) {
        getter = () => reactiveGetter(source);
    }
    else if (isRef(source)) {
        getter = () => source.value;
    }
    else if (isFunction(source)) {
        getter = source;
    }
    else {
        getter = () => { };
    }

    let oldValue;
    let cleanup;
    const onCleanup = (fn: Function) => {
        cleanup = () => {
            fn();
            cleanup = undefined;
        }
    }
    const job = () => {
        if (cb) {
            // watch()
            const newValue = effect.run();

            // 执行回调前先执行上一次的清理操作
            if (cleanup) {
                cleanup();
            }

            cb(newValue, oldValue, onCleanup);
            oldValue = newValue;
        }
        else {
            // watchEffect
            effect.run();
        }
    }

    const effect = new ReactiveEffect(getter, job);

    if (cb) {
        if (immediate) {
            job();
        }
        else {
            oldValue = effect.run();
        }
    }
    else {
        // 没有cb即为watchEffect
        effect.run();
    }

    const unwatch = () => {
        effect.stop();
    }

    return unwatch;
}