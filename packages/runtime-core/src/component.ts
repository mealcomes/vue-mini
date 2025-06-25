import { isFunction, isObject, ShapeFlags } from "@vue/shared";
import { initProps } from "./componentProps"
import { PublicInstanceProxyHandlers } from "./componentPublicInstance";
import { applyOptions } from "./componentOptions";
import { proxyRefs } from "@vue/reactivity";

export function isStatefulComponent(
    instance,
): number {
    return instance.vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
}

export function createComponentInstance(
    vnode
) {
    const {
        props: propsOptions = {}   // 组件的props，其为defineProps
    } = vnode.type;   // type 是组件对象 { props: {}, render(){} } 
    // 同时vnode也有也有props，其为h函数参数传入的

    const type = vnode.type

    const instance = {
        type,                  // h 函数的第一个参数, 
        // state: {},          // 原本 data 为 state
        data: {},              // 响应式数据，vue2中的data函数返回的对象
        render: null,          // render 函数
        vnode,                 // 组件的虚拟节点
        subTree: null,         // 子树
        isMounted: false,      // 是否挂载完成
        update: null,          // 组件的更新函数
        props: {},             // API defineProps的那个props
        attrs: {},             // propsOptions - props = attrs
        propsOptions,          // 组件的props，其为defineProps
        component: null,
        proxy: null,           // 用来代理 props attrs data 方便访问
        setupState: {},
    }

    return instance
}

// 初始化instance.props和instance.attrs
export function setupComponent(
    instance,
) {
    const { props } = instance.vnode;
    const isStateful = isStatefulComponent(instance);

    // 根据 h函数传入的props 区分出 组件的props(defineProps)和attrs
    initProps(instance, props)

    if (isStateful) {
        setupStatefulComponent(instance);
    }
}

function setupStatefulComponent(instance) {
    const Component = instance.type;

    instance.proxy = new Proxy(instance, PublicInstanceProxyHandlers);

    const { setup } = Component;
    if (setup) {
        const setupContext = {

        }
        const setupResult = setup(instance.props, setupContext);
        handleSetupResult(instance, setupResult);
    }
    else {
        finishComponentSetup(instance);
    }
}

export function handleSetupResult(
    instance,
    setupResult,
): void {
    if (isFunction(setupResult)) {
        instance.render = setupResult;
    } else if (isObject(setupResult)) {
        instance.setupState = proxyRefs(setupResult)  // 将返回的值脱ref
    }
    finishComponentSetup(instance)
}

function finishComponentSetup(instance) {
    const Component = instance.type;

    if (!instance.render) {
        // type 中的render 赋值给 instance
        instance.render = (Component.render || (() => { }))
    }

    try {
        applyOptions(instance)
    } catch (e) {
        console.error(e)
    }
}
