import { reactive } from "@vue/reactivity";


// rawProps为instance.vnode.props，即 h 函数传入的props，我们需要将其分成组件的props(defineProps)和attrs
export function initProps(instance, rawProps) {
    const props = {};
    const attrs = Object.create({});
    const propsOptions = instance.propsOptions || {};  // 组件中定义的defineProps
    if (rawProps) {
        for (let key in rawProps) {
            const value = rawProps[key];
            if (key in propsOptions) {
                props[key] = value;
            }
            else {
                attrs[key] = value;
            }
        }
    }
    instance.attrs = attrs;
    instance.props = reactive(props);  // 其实props不需要深度代理，且组件不能更改props(单向数据流)
}

export function updateProps(instance, rawProps, rawPrevProps) {

}

// 判断两个Vnode的Props(区别于组件实例的props)是否发生变化
function hasPropsChanged(prevProps, nextProps) {
    const nextKeys = Object.keys(nextProps);
    if (nextKeys.length !== Object.keys(prevProps).length) {
        return true
    }
    for (let i = 0; i < nextKeys.length; i++) {
        const key = nextKeys[i]
        if (nextProps[key] !== prevProps[key]) {
            return true
        }
    }
    return false
}

export function shouldUpdateComponent(prevVNode, nextVNode) {
    const { props: prevProps, children: prevChildren, component } = prevVNode;
    const { props: nextProps, children: nextChildren, patchFlag } = nextVNode;
    return hasPropsChanged(prevProps, nextProps);
}