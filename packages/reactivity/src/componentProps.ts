import { reactive } from "./reactive";


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