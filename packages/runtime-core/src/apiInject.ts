import { currentInstance } from "./component"

export function provide(
    key,
    value,
): void {
    // 子用的是父，子提供的新属性与父无关
    // 通过原型链，所以当父与子同时有一个属性时，子组件的后代会优先使用子组件提供的值
    if (!currentInstance) {
        console.warn(`provide() can only be used inside setup().`);
    } else {
        let provides = currentInstance.provides;
        const parentProvides = currentInstance.parent?.provides;
        if (parentProvides === provides) {
            // 一开始的时候，由于子的provides引用的是父的provides，所以会进入if语句
            // (上述见component#createComponentInstance)
            // 将父组件的provides作为子组件的原型
            provides = currentInstance.provides = Object.create(parentProvides);
        }
        provides[key] = value;
    }
}

export function inject(
    key,
    defaultValue?
) {
    const instance = currentInstance;

    if (instance) {
        let provides =  instance.parent?.provides || undefined;

        if (provides && key in provides) {
            return provides[key];
        } else if (arguments.length > 1) {
            return defaultValue;
        } else {
            console.warn(`injection "${String(key)}" not found.`);
        }
    } else {
        console.warn(`inject() can only be used inside setup() or functional components.`);
    }
}