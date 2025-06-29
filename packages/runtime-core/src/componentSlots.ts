import { isArray, isFunction, ShapeFlags } from "@vue/shared";
import { normalizeVNode } from "./vnode";

export const initSlots = (instance, children) => {
    if (instance.vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
        // VNode 类型为插槽数组时，便将children直接赋值给instance.slots
        instance.slots = children;
    } else if (children) {
        // VNode 不为SLOTS_CHILDREN，但是有 children，就将其赋为default插槽。如下：
        // <template>
        //   <MyComponent>
        //     <div>我是默认插槽内容</div>
        //   </MyComponent>
        // </template>
        // 其中的<div>我是默认插槽内容</div>便被赋值为默认插槽
        // 但一般这里只有在模板编译后才会出现这个
        const normalized = isArray(children)
            ? children.map(normalizeVNode)
            : [normalizeVNode(children)]
        instance.slots.default = () => normalized;
    }
}

export const updateSlots = (instance, children) => {
    const { vnode, slots } = instance;
    if (vnode.shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
        // children 为手写的插槽，对其进行规范化（确保每个插槽是函数），并插入到instances.slots上
        normalizeObjectSlots(children, slots)
    } else if (children) {
        // 不是插槽对象，说明父组件直接传了 VNode (没有使用插槽语法)，直接将其作为default插槽处理
        normalizeVNodeSlots(instance, children);
    }
}

// 对手写的slots进行规范化处理，保证每个插槽都是一个函数(rawSlots是未规范化的插槽)
const normalizeObjectSlots = (rawSlots, slots) => {
    for (const key in rawSlots) {
        if (key[0] === '_') continue;
        const value = rawSlots[key];
        if (isFunction(value)) {
            slots[key] = value;
        } else if (value != null) {
            // 插槽对象不为空但不是函数
            console.warn(
                `Non-function value encountered for slot "${key}". ` +
                `Prefer function slots for better performance.`,
            )
            const normalized = normalizeSlotValue(value);
            slots[key] = () => normalized;
        }
    }
}

const normalizeVNodeSlots = (instance, children) => {
    const normalized = normalizeSlotValue(children);
    instance.slots.default = () => normalized;
}

const normalizeSlotValue = (value) => {
    return isArray(value)
    ? value.map(normalizeVNode)
    : normalizeVNode(value);
}
