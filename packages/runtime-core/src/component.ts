import { isFunction, isObject, ShapeFlags } from "@vue/shared";
import { initProps } from "./componentProps"
import { PublicInstanceProxyHandlers } from "./componentPublicInstance";
import { applyOptions } from "./componentOptions";
import { proxyRefs } from "@vue/reactivity";
import { initSlots } from "./componentSlots";

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
        slots: {},             // 插槽
        propsOptions,          // 组件的props，其为defineProps
        component: null,
        proxy: null,           // 用来代理 props attrs data 方便访问
        setupState: {},        // setup函数返回的对象
        exposed: null,
    }

    return instance
}

// 初始化instance.props和instance.attrs
export function setupComponent(
    instance,
) {
    const { props, children } = instance.vnode;
    const isStateful = isStatefulComponent(instance);

    // 根据 h函数传入的props 区分出 组件的props(defineProps)和attrs
    initProps(instance, props);
    initSlots(instance, children);

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
            slots: instance.slots,
            attrs: instance.attrs,
            // 通过合成eventName，再找到父组件onEventName属性对应的函数并对其进行调用
            emit(event: string, ...args) {  
                const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
                const handler = instance.vnode.props[eventName];
                handler && handler(...args);
            },
            // 在 instance 上添加对象
            expose(value) {
                instance.exposed = value;
            },
        }
        // 传入 setupContext， 见index.html中使用的setup传入的参数
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
