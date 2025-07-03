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
    vnode,
    parent
) {
    const {
        props: propsOptions = {}   // 组件的props，其为defineProps(用户声明的props)
    } = vnode.type;   // type 是组件对象 { props: {}, render(){} } 
    // 同时vnode也有也有props，其为h函数参数传入的

    const type = vnode.type

    const instance = {
        // state: {},          // 原本 data 为 state
        vnode,                 // 组件的虚拟节点
        type,                  // h 函数的第一个参数, 
        parent,                // 父组件
        next: null,            // 组件更新时用到的next
        subTree: null,         // 子树
        update: null,          // 组件的更新函数
        render: null,          // render 函数
        proxy: null,           // 用来代理 props attrs data 方便访问
        exposed: null,         // 用于暴露组件内部数据的函数

        provides: parent ? parent.provides : Object.create(null),

        components: null,

        propsOptions,          // 组件的props，其为defineProps(用户声明的props)

        emit: null,            // 组件的发布事件函数

        ctx: {},               // KeepAlive组件的dom API，见renderer.ts中的mountElement
        data: {},              // 响应式数据，vue2中的data函数返回的对象
        props: {},             // API defineProps的那个props(最终父组件传过来的，其属于propsOptions)
        attrs: {},             // propsOptions - props = attrs
        slots: {},             // 插槽
        setupState: {},        // setup函数返回的对象

        isMounted: false,      // 是否挂载完成
        bm: null,
        m: null,
        bu: null,
        u: null,
        um: null,
        bum: null,
    }

    instance.ctx = { _: instance };

    // 通过合成eventName，再找到父组件onEventName属性对应的函数并对其进行调用
    instance.emit = function (event: string, ...args) {
        const eventName = `on${event[0].toUpperCase() + event.slice(1)}`;
        const handler = instance.vnode.props[eventName];
        handler && handler(...args);
    };

    return instance
}

// 此处的设计类似依赖收集时的全局activeEffect
// 帮助拿到当前的组件实例，用于生命周期时的调用
export let currentInstance = null;
export const getCurrentInstance = () => {
    return currentInstance;
}
export const setCurrentInstance = (instance) => {
    const prev = currentInstance;
    currentInstance = instance;
    return () => {
        currentInstance = prev;
    }
}
export const unsetCurrentInstance = () => {
    currentInstance = null;
}

// 初始化instance.props和instance.attrs
export function setupComponent(
    instance,
) {
    const { props, children } = instance.vnode;
    const isStateful = isStatefulComponent(instance);

    // 根据 h函数传入的props 区分出 组件的props(defineProps)和attrs
    initProps(instance, props, isStateful);
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
        const setupContext = createSetupContext(instance);
        // 设置当前组件实例到全局，从而setup函数能够拿到该实例
        const reset = setCurrentInstance(instance);
        // 传入 setupContext， 见index.html中使用的setup传入的参数
        const setupResult = setup(instance.props, setupContext);
        reset();  // 恢复全局实例
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

export function createSetupContext(instance) {
    const expose = exposed => {
        instance.exposed = exposed || {};
    };

    return {
        attrs: instance.attrs,
        slots: instance.slots,
        emit: instance.emit,
        expose,
    }
}

