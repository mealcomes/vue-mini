import { initProps } from "./componentProps"
import { reactive } from "./reactive";

export function createComponentInstance(
    vnode
) {
    const {
        data = () => { },
        props: propsOptions = {}   // 组件的props，其为defineProps
    } = vnode.type;   // type 是组件对象 { props: {}, render(){} } 
                      // 同时vnode也有也有props，其为h函数参数传入的

    // 拿到数据并编程响应式
    const state = reactive(data());

    const instance = {
        state,                 // 状态
        vnode,                 // 组件的虚拟节点
        subTree: null,         // 子树
        isMounted: false,      // 是否挂载完成
        update: null,          // 组件的更新函数
        props: {},             // API defineProps的那个props
        attrs: {},             // propsOptions - props = attrs
        propsOptions,          // 组件的props，其为defineProps
        component: null,
    }

    return instance
}


export function setupComponent(
    instance,
) {
    const { props } = instance.vnode

    // 根据 h函数传入的props 区分出 组件的props(defineProps)和attrs
    initProps(instance, props)
}