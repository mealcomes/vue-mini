import { isArray, ShapeFlags } from "@vue/shared";
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