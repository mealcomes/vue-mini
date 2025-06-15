import { ReactiveEffect } from './effect';
import { isFunction } from "@vue/shared";
import { trackRefValue, triggerRefValue } from './ref';

export class ComputedRefImpl {
    public _value;
    public effect: ReactiveEffect;
    public dep;
    constructor(getter, public setter) {
        // 创建一个effect管理当前计算属性的dirty属性
        this.effect = new ReactiveEffect(() => getter(this._value), () => {
            // 计算属性依赖的值变化，需要触发渲染effect重新执行
            triggerRefValue(this);
        })
    }
    get value() {
        // 脏值时才会进行执行
        if (this.effect.dirty) {
            // 默认取值一定是脏的，但执行一次后就非脏了（见ReactiveEffect）
            this._value = this.effect.run();

            // 如果当前在effect中访问了计算属性，则需要进行依赖收集
            trackRefValue(this);
        }
        return this._value;
    }

    set value(v) {
        this.setter(v);
    }

}

/*
const state = ref({
    name: 'Bob',
})
const info = computed({
    get(oldValue) {
        console.log('计算属性执行');
        return `name: ${state.name}`;
    },
    set(value) {
        console.log(value);     // info.value = 'xxx'时进入该set函数
    }
});
effect(() => {
    app.innerHTML = info.value
});
setTimeout(() => {
    state.name = 'Alice'
}, 1000)
此时建立了两个映射：
info(ref类型) => effect中的函数
state.name => computed传入的get函数（被封装为了ReactiveEffect存在了ComputedRefImpl中）
当改变state.name时，会触发其scheduler。
而在该scheduler中，我们不是进行get函数的重新执行，而是进行info的依赖触发，即重新执行effect函数，
此时由于在触发时我们使info变成了脏数据，所以在重新执行effect函数期间获取info.value时，
会重新执行get函数从而拿到更新后的数据
简单来说如下：
state.name改变 ----> 计算属性(state.name收集的effect)重新执行  
                    ||
                    ||
                   \||/
                    \/   
计算属性scheduler ----> 计算属性收集的effect
*/

export function computed(getterOrOptions) {
    let getter;
    let setter;
    if (isFunction(getterOrOptions)) {
        getter = getterOrOptions;
        setter = () => { };
    }
    else {
        getter = getterOrOptions.get
        setter = getterOrOptions.set
    }
    return new ComputedRefImpl(getter, setter);
}