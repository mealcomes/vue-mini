import { ShapeFlags } from "@vue/shared";
import { mergeProps, normalizeVNode } from "./vnode";

export function renderComponentRoot(instance) {
    const {
        type: Component,
        render,
        vnode,
        proxy,
        attrs,
    } = instance;

    let result;

    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
        // call(proxy, proxy)
        // 前一个参数是绑定this(因为组件对象的render函数里面会用到this)
        // 后一个参数是将proxy作为参数传给组件对象的render函数
        // render函数需要返回vnode(执行h函数得到的结果)
        result = normalizeVNode(
            // render函数中会用到响应式数据，加上renderer#createRenderer#setupRenderEffect中转为ReactiveEffect，是实现视图跟随数据变化响应式更新的关键之一
            render.call(proxy, proxy)
        );
    } else {
        // 函数式组件
        const render = Component as Function;
        result = normalizeVNode(
            render(attrs)
        );
    }

    // 简单处理父组件向子组件通过h函数参数传递的属性
    const extraProps = attrs;
    if (extraProps) {
        const mergedProps = mergeProps(result.props || {}, extraProps);
        result.props = mergedProps;
    }

    return result;
}