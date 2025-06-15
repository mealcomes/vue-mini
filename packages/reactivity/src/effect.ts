import { DirtyLevels } from "./constants";

export let activeEffect;

export interface ReactiveEffectRunner<T = any> {
    (): T
    effect: ReactiveEffect
}

export class ReactiveEffect {
    _trackId: number = 0;  // 记录当前effect执行的次数(保证一个属性在同一个effect中被多次访问只收集一次)

    // 当前effect的所有依赖表。
    // key1 => {effect1, effect2}
    // key2 => {effect1}
    // 同时 effect1.deps = {{effect1, effect2}, {effect1}}
    deps: Array<Map<ReactiveEffect, number>> = [];

    _depsLength: number = 0;

    _running = 0;

    public active = true;

    _dirtyLevel = DirtyLevels.Dirty;

    // fn 用户编写的函数
    // 如果fn中依赖的数据变化后，需要重写调用 -> run()
    constructor(public fn, public scheduler) {

    }
    run() {
        this._dirtyLevel = DirtyLevels.NoDirty;
        // 不是激活的，执行后什么都不用做
        if (!this.active) {
            return this.fn();
        }

        this._running++;
        preCleanEffect(this);

        /**
         *  该操作是为了解决下面的场景出现的问题
         *  ```
         *  const obj = reactive({age: 11, name: 'Bob'});
         *  effect(() => {
         *      console.log(obj.age);
         *      effect(() => {
         *          console.log(obj.age);
         *      })
         *      console.log(obj.name);
         *  })
         * ```
         * 在内部effect执行期间，需要将外部的effect存起来
         */
        let preEffect = activeEffect;

        // 设置当前正在执行的effect，从而当触发set、get时获得该effect从而进行依赖收集
        activeEffect = this;
        try {
            return this.fn();
        } finally {
            // 新的依赖列表的长度可能比旧的长，此时应该将多余的给删除掉
            // {flag, name, aa, bb} => {flag, age}
            postCleanEffect(this);
            activeEffect = preEffect;
            this._running--;
        }
    }

    stop() {
        if (this.active) {
            this.active = false;
            preCleanEffect(this);
            postCleanEffect(this);
        }
    }

    public get dirty() {
        return this._dirtyLevel === DirtyLevels.Dirty;
    }

    public set dirty(v) {
        this._dirtyLevel = v ? DirtyLevels.Dirty : DirtyLevels.NoDirty;
    }
}

export function effect<T = any>(fn: Function, options?: Object)
    : ReactiveEffectRunner<T> {
    // 创建一个effect，只要依赖的属性变化了，就要执行回调
    const _effect = new ReactiveEffect(fn, () => {
        _effect.run();
    });

    if (options) {
        Object.assign(_effect, options);  // 用用户传递的覆盖内置的，例如schedule、stop
    }
    _effect.run();

    const runner = _effect.run.bind(_effect) as ReactiveEffectRunner;
    runner.effect = _effect;  // 可以在run方法上获取到effect的引用

    return runner;  // 外界可以自己让其重新执行
}



export function trackEffect(effect: ReactiveEffect, dep: Map<ReactiveEffect, number>) {

    // 重新收集依赖，将不需要的依赖移除

    // 避免同一个effect中多次使用同一个依赖的时候，依赖被多次收集了(_trackId的改变见effect#cleanupEffect函数)
    // 如下述操作
    // ```
    // const state = reactive({age: 10});
    // effect(() => {
    //      app.innerHTML = state.age + state.age + state.age;
    // })
    // ```
    if (dep.get(effect) !== effect._trackId) {
        dep.set(effect, effect._trackId);
    }

    // 重新执行effect时会重新进行依赖收集，此时_depsLength从0开始(_depsLength变为0见effect#cleanupEffect函数)
    let oldDep = effect.deps[effect._depsLength];
    // 如果当前_depsLength的依赖和新添加的dep不同，说明需要更新
    // 如下述例子：
    // ```
    // let proxy = reactive({flag: true, name: 'Alice', age: 30})
    // effect(() => {
    //      app.innerHTML = proxy.flag ? flag : name;
    // });
    // ```
    // { flag, name }
    //       ||
    //       ||
    //       \/
    // { flag, age }
    // 当_depsLength为0时，都为flag故复用，为1时发生变化，则更新
    if (oldDep !== dep) {
        if (oldDep) {
            // 删除老的
            cleanDepEffect(oldDep, effect);
        }
        effect.deps[effect._depsLength++] = dep;  // 保证依赖表永远是最新的
    }
    // 否则直接将_depsLength加一进行dep复用
    else {
        effect._depsLength++;
    }
}

export function triggerEffects(dep: Map<ReactiveEffect, number>) {
    for (const effect of dep.keys()) {
        
        // 当前这个值是不脏的，但触发更新需要将值变为脏值
        if (effect._dirtyLevel < DirtyLevels.Dirty) {
            effect._dirtyLevel = DirtyLevels.Dirty;
        }

        if (effect.scheduler) {
            if (!effect._running) {  // 当前effect在执行中修改了数据，不会触发effect重新执行
                effect.scheduler();
            }
        }
    }
}

function preCleanEffect(e: ReactiveEffect) {
    e._depsLength = 0;  // 置为0是为了后续进行依赖清理(见依赖收集函数trackEffect)
    e._trackId++;  // 每次执行，id都+1，如果当前同一个effect执行，id就是相同的(见依赖收集函数trackEffect)
}

function postCleanEffect(e: ReactiveEffect) {
    if (e.deps.length > e._depsLength) {
        for (let i = e._depsLength; i < e.deps.length; i++) {
            cleanDepEffect(e.deps[i], e);  // 删除映射表中对应的effect
        }
        e.deps.length = e._depsLength;  // 更新依赖列表长度
    }
}

function cleanDepEffect(dep, effect) {
    dep.delete(effect);
    // 如果属性不存在effect，则将该属性移除
    if (dep.size === 0) {
        dep.cleanup()
    }
}
