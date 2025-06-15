import { ComputedRefImpl } from "./computed";
import { ReactiveFlags } from "./constants";
import { activeEffect, trackEffect, triggerEffects } from "./effect";
import { toReactive } from "./reactive";
import { createDep } from "./reactiveEffect";


// ref shallowRef
export function ref(value) {
    return createRef(value);
}

export function isRef(r) {
    return r ? r[ReactiveFlags.IS_REF] === true : false
}

function createRef(value) {
    return new RefImpl(value);
}

class RefImpl {
    public readonly [ReactiveFlags.IS_REF] = true;
    public _value;
    public dep;  // 用于收集对应的effect
    constructor(public rawValue) {
        this._value = toReactive(rawValue);
    }

    get value() {
        trackRefValue(this);
        return this._value;
    }
    set value(newValue) {
        if (newValue !== this.rawValue) {
            this.rawValue = newValue;
            this._value = toReactive(newValue);
            triggerRefValue(this);
        }
    }
}

export function trackRefValue(ref: RefImpl | ComputedRefImpl) {
    if (activeEffect) {
        trackEffect(activeEffect, 
            ref.dep = ref.dep || createDep(() => ref.dep = undefined, undefined))
    }
}

export function triggerRefValue(ref: RefImpl | ComputedRefImpl) {
    let dep = ref.dep;
    if (dep) {
        triggerEffects(dep); // 触发依赖更新
    }
}

class ObjectRefImpl {
    public __v_isRef = true;
    constructor(public _object, public _key) {

    }
    get value() {
        return this._object[this._key];
    }
    set value(newValue) {
        this._object[this._key] = newValue;
    }
}

export function toRef(object, key) {
    return new ObjectRefImpl(object, key);
}

// const obj = reactive({name: 'aaa', age: 11})
// const {name, age} = obj // 此时结构得到的name和age丧失了响应式
export function toRefs(object: object | Array<any>) {
    const res = Array.isArray(object) ? new Array(object.length) : {};
    for (let key in object) {
        res[key] = toRef(object, key);
    }
    return res;
}

/**
 * 对于类似 obj = {
 *      name: ref('Bob'),
 *      age: ref(20)
 * }
 * 的数据(可通过Refs得到)，可以直接通过obj.name进行访问，而不是obj.name.value
 * 
 */
export function proxyRefs(objectWithRef) {
    return new Proxy(objectWithRef, {
        get(target, key, receiver) {
            let r = Reflect.get(target, key, receiver);
            return r.__v_isRef ? r.value : r;   // 自动脱ref
        },
        set(target, key, value, receiver) {
            const oldValue = target[key];
            if (oldValue.__v_isRef && !value.__v_isRef) {
                oldValue.value = value;
                return true;
            }
            else {
                return Reflect.set(target, key, value, receiver);
            }
        }
    })
}