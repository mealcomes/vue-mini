/*
// type only
h('div')

// type + props
h('div', {})

// type + omit props + children
// Omit props does NOT support named slots
h('div', []) // array
h('div', 'foo') // text
h('div', h('br')) // vnode
h(Component, () => {}) // default slot

// type + props + children
h('div', {}, []) // array
h('div', {}, 'foo') // text
h('div', {}, h('br')) // vnode
h(Component, {}, () => {}) // default slot
h(Component, {}, {}) // named slots

// named slots without props requires explicit `null` to avoid ambiguity
h(Component, null, {})
**/

import { isArray, isObject } from "@vue/shared";
import { createVNode, isVNode } from "./vnode";

export function h(type, propsOrChildren, children) {
    const l = arguments.length;

    // 处理propsOrChildren
    if (l === 2) {
        // h(type, props | children)
        if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
            // children
            if (isVNode(propsOrChildren)) {
                // h(type, vnode)
                return createVNode(type, null, [propsOrChildren]);
            }
            // props、没有children
            return createVNode(type, propsOrChildren);
        } else {
            // h(type, children)
            return createVNode(type, null, propsOrChildren);
        }
    }
    else {
        if (l > 3) {
            children = Array.prototype.slice.call(arguments, 2);
        } else if (l === 3 && isVNode(children)) {
            children = [children];
        }
        return createVNode(type, propsOrChildren, children);
    }

}

