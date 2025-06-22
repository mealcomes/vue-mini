import { hasOwn } from "@vue/shared";

const publicProperty = {
    $attrs: (instance) => instance.attrs,
}

export const PublicInstanceProxyHandlers = {
    get(target, key) {
        const { data, props } = target;

        if (data && hasOwn(data, key)) {
            return data[key];
        }
        else if (props && hasOwn(props, key)) {
            return props[key];
        }

        const getter = publicProperty[key];
        if (getter) {
            return getter(target);
        }

    },
    set(instance, key, value) {
        const { state, props } = instance;

        if (state && hasOwn(state, key)) {
            return state[key] = value;
        }
        else if (props && hasOwn(props, key)) {
            // 用户可以修改props，但是破坏了单向数据流
            console.warn(`Attempting to mutate prop "${String(key)}". Props are readonly.`)
            return props[key] = value;
        }
        return true;
    }
}