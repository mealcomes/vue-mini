import { isArray, isFunction, isObject, isOn, isString, normalizeClass, normalizeStyle, ShapeFlags } from "@vue/shared";

export const Text: unique symbol = Symbol.for('v-txt');
export const Fragment = Symbol.for('v-fgt');

export function isVNode(value: any) {
    return value ? value.__v_isVNode === true : false
}

export function isSameVNodeType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key;
}

export function createVNode(type, props = null, children = null) {
    const shapeFlag = isString(type)
        ? ShapeFlags.ELEMENT             // 元素
        : isObject(type)
            ? ShapeFlags.STATEFUL_COMPONENT  // 状态组件
            : isFunction(type)
                ? ShapeFlags.FUNCTIONAL_COMPONENT  // 函数式组件 (setup)
                : 0
    const vnode = {
        __v_isVNode: true,
        type,
        props,               // h 函数参数传入得到的，区别于组件实例的props
        children,
        key: props?.key,
        el: null,
        shapeFlag,
    }

    if (children) {
        if (isArray(children)) {
            vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
        }
        else if (isObject(children)) {
            // h 函数第三个参数是对象，则代表其为slots
            vnode.shapeFlag |= ShapeFlags.SLOTS_CHILDREN;
        }
        else {
            children = String(children);
            vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
        }
    }

    return vnode;
}

export function normalizeVNode(child) {
    if (child == null || typeof child === 'boolean') {
        return null;
    } else if (isArray(child)) {
        return createVNode(Fragment, null, child.slice());
    } else if (isVNode(child)) {
        return child;
    } else {
        return createVNode(Text, null, String(child))
    }
}


export function mergeProps(...args) {
    const ret: any = {}
    for (let i = 0; i < args.length; i++) {
        const toMerge = args[i]
        for (const key in toMerge) {
            if (key === 'class') {
                if (ret.class !== toMerge.class) {
                    ret.class = normalizeClass([ret.class, toMerge.class])
                }
            } else if (key === 'style') {
                ret.style = normalizeStyle([ret.style, toMerge.style])
            } else if (isOn(key)) {
                const existing = ret[key]
                const incoming = toMerge[key]
                if (
                    incoming &&
                    existing !== incoming &&
                    !(isArray(existing) && existing.includes(incoming))
                ) {
                    ret[key] = existing
                        ? [].concat(existing as any, incoming as any)
                        : incoming
                }
            } else if (key !== '') {
                ret[key] = toMerge[key]
            }
        }
    }
    return ret
}