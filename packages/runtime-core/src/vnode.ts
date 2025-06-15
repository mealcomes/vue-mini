import { isArray, isObject, isString, ShapeFlags } from "@vue/shared";

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
        : 0;
    const vnode = {
        __v_isVNode: true,
        type,
        props,
        children,
        key: props?.key,
        el: null,
        shapeFlag,
    }

    if (children) {
        if (isArray(children)) {
            vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
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
