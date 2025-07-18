import { reactive } from "@vue/reactivity";


// rawProps为instance.vnode.props，即 h 函数传入的props，我们需要将其分成组件的props(defineProps)和attrs
export function initProps(instance, rawProps, isStateful) {
    const props = {};
    const attrs = Object.create({});
    const propsOptions = instance.propsOptions || {};  // 组件中定义的defineProps
    if (rawProps) {
        for (let key in rawProps) {
            // 对于h函数传入的props，如果key为key或ref，则为特殊的属性，不能算作props或attrs
            if (key === 'key' || key === 'ref') {
                continue
            }

            const value = rawProps[key];
            if (key in propsOptions) {
                props[key] = value;
            }
            else {
                attrs[key] = value;
            }
        }
    }
    if (isStateful) {
        // 如果是状态组件(setup)
        instance.props = reactive(props);  // 其实props不需要深度代理，且组件不能更改props(单向数据流)
    } else {
        // 函数式组件
        if (!instance.type.props) {
            // 没有声明 props -> 所有传入的都当作 attrs
            instance.props = attrs;
        } else {
            // 有声明 props -> 用 props
            instance.props = props;
        }
    }
    
    instance.attrs = attrs;
}

export function updateProps(instance, rawProps, rawPrevProps) {

    for (let key in rawProps) {
        // 如果新props中有旧props中没有的，则直接覆盖
        instance.props[key] = rawProps[key];
    }

    for (let key in instance.props) {
        // 如果旧props中有新props中没有的，则删除
        if (!(key in rawProps)) {
            delete instance.props[key];
        }
    }
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
    const { props: prevProps, children: prevChildren } = prevVNode;
    const { props: nextProps, children: nextChildren } = nextVNode;

    // 如果有插槽，则需要进行渲染
    if (prevChildren || nextChildren) return true;

    if (prevProps === nextProps) return false;

    return hasPropsChanged(prevProps, nextProps);
}