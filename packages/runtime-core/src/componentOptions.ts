import { reactive } from "@vue/reactivity";
import { isFunction, isObject } from "@vue/shared";

export function applyOptions(instance) {
    const options = instance.type;  // 此处的type即为vnode的type
    const publicThis = instance.proxy!

    const {
        data: dataOptions,
    } = options;

    // 调用 data(一个函数，类似 setup 里面的定义的响应式变量)，并将其返回的对象转为响应式对象
    if (dataOptions) {
        if (!isFunction(dataOptions)) {
            console.warn(
                `The data option must be a function. `
            )
        }

        const data = dataOptions.call(publicThis, publicThis);  // data 中可以拿到 props(其实就是 proxy)
        if (!isObject(data)) {
            console.warn(`data() should return an object.`)
        } else {
            instance.data = reactive(data);
        }
    }
}