import { isArray, isFunction, isObject, isOn, isString, normalizeClass, normalizeStyle, ShapeFlags } from "@vue/shared";
import { isTeleport } from "./components/Teleport";

export const Text: unique symbol = Symbol.for('v-txt');
export const Comment: unique symbol = Symbol.for('v-cmt');
export const Fragment = Symbol.for('v-fgt');

/**
 * 用于处理多级 block 
 */
export const blockStack = [];
export let currentBlock = null;

export function openBlock() {
    blockStack.push(currentBlock = []);
}

export function closeBlock() {
    blockStack.pop();
    // 将 currentBlock 指向上一个 block
    currentBlock = blockStack[blockStack.length - 1] || null;
}

function setupBlock(vnode) {
    // 当前 elementBlock 会收集子节点，用于当前 block 来收集
    vnode.dynamicChildren = currentBlock;

    // 将 currentBlock 指向上一个 block 或者置为 null, 这样当父 vnode 创建的时候就能拿到这个 block
    closeBlock(); 

    // 如果 closeBlock 后， currentBlock 依旧不为 null
    // 则说明本 vnode 的父 vnode 也开了一个 block，那么便将本 vnode 加入到 currentBlock 中
    // 从而其父亲也能将这个 currentBlock 存为 dynamicChildren
    // 这样就能形成 
    // vnode1.dynamicChildren -> children1 
    // vnode2(children1).dynamicChildren -> children2
    if (currentBlock) {
        currentBlock.push(vnode);
    }

    return vnode
}

/**
 * 有收集 dynamicChildren 功能的 createVNode
 */
export function createElementBlock(type, props, children, patchFlag) {
    return setupBlock(createVNode(type, props, children, patchFlag));
}

export function isVNode(value: any) {
    return value ? value.__v_isVNode === true : false
}

export function isSameVNodeType(n1, n2) {
    return n1.type === n2.type && n1.key === n2.key;
}

export function createVNode(type, props = null, children = null, patchFlag?) {
    if (!type) {
        type = Comment
    }
    const shapeFlag = isString(type)
        ? ShapeFlags.ELEMENT             // 元素
        : isTeleport(type)
            ? ShapeFlags.TELEPORT        // Teleport 组件
            : isObject(type)
                ? ShapeFlags.STATEFUL_COMPONENT  // 状态组件 (例如：setup)
                : isFunction(type)
                    ? ShapeFlags.FUNCTIONAL_COMPONENT  // 函数式组件传入一个函数
                    : 0
    const vnode = {
        __v_isVNode: true,
        type,
        props,               // h 函数参数传入得到的，区别于组件实例的props
        children,
        key: props?.key,
        el: null,
        shapeFlag,
        ref: props?.ref,     // 组件上的ref，见index.html下ref原理相关代码
        patchFlag,
    }

    // 如果 patchFlag 大于0，则说明该 vnode 是需要变更的 vnode
    // 例如 <span>{{ name }}<span>
    // 其中存在响应式数据 name, 此时 patchFlag 为 Text
    // 此时将该 vnode 加入到 currentBlock(如果不为 null, 且一定是父 vnode 创建的)
    // 后面该 vnode 的父 vnode 便会将该 currentBlock 存为 dynamicChildren
    if (currentBlock && patchFlag > 0) {
        currentBlock.push(vnode);
    }

    // children规范化
    if (children) {
        if (isArray(children)) {
            vnode.shapeFlag |= ShapeFlags.ARRAY_CHILDREN;
        } else if (isObject(children)) {
            // h 函数第三个参数是对象，则代表其为slots
            vnode.shapeFlag |= ShapeFlags.SLOTS_CHILDREN;
        } else if (isFunction(children)) {
            vnode.children = { default: children }
            vnode.shapeFlag |= ShapeFlags.SLOTS_CHILDREN
        } else {
            children = String(children);
            vnode.shapeFlag |= ShapeFlags.TEXT_CHILDREN;
        }
    }

    return vnode;
}

export { createVNode as createElementVNode }

export function normalizeVNode(child) {
    if (child == null || typeof child === 'boolean') {
        return createVNode(Comment);
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