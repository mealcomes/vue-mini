import { hasOwn } from "@vue/shared";

const publicProperty = {
    $attrs: (instance) => instance.attrs,
    $slots: (instance) => instance.slots,
}

export const PublicInstanceProxyHandlers = {
    get(target, key) {
        // setupState 是当setup函数返回值为对象的时候，把该对象当作组件的状态来处理，见component#handleSetupResult函数
        const { data, props, setupState } = target;

        if (data && hasOwn(data, key)) {
            return data[key];
        } else if (props && hasOwn(props, key)) {
            return props[key];
        } else if (setupState && hasOwn(setupState, key)) {
            return setupState[key];
        }

        const getter = publicProperty[key];
        if (getter) {
            return getter(target);
        }

    },
    set(instance, key, value) {
        const { data, props } = instance;

        if (data && hasOwn(data, key)) {
            data[key] = value;
        }
        else if (props && hasOwn(props, key)) {
            // 用户可以修改props，但是破坏了单向数据流
            console.warn(`Attempting to mutate prop "${String(key)}". Props are readonly.`)
            props[key] = value;
        }
        return true;
    }
}