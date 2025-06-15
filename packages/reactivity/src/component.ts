import { initProps } from "./componentProps"

export function setupComponent(
    instance,
) {
    const { props } = instance.vnode
    initProps(instance, props)

}