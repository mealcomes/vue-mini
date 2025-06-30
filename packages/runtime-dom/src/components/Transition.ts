import { BaseTransition, BaseTransitionPropsValidators, h } from "@vue/runtime-core";
import { isArray, isObject } from "@vue/shared";

/**
 * Key，其对应的value是个Set，用于存放在dom元素上添加的类名，便于动态维护类名
 */
export const vtcKey = Symbol('_vtc');


// Transition 组件所有可能的通过 h 函数传入的 props
const DOMTransitionPropsValidators = {
    name: String,
    type: String,
    css: {
        type: Boolean,
        default: true,
    },
    duration: [String, Number, Object],
    enterFromClass: String,
    enterActiveClass: String,
    enterToClass: String,
    appearFromClass: String,
    appearActiveClass: String,
    appearToClass: String,
    leaveFromClass: String,
    leaveActiveClass: String,
    leaveToClass: String,
}

export const TransitionPropsValidators: any = Object.assign(
    {},
    BaseTransitionPropsValidators as any,
    DOMTransitionPropsValidators,
)

/**
 * 执行钩子函数(用户传入的，且如果有的话)
*/
const callHook = (
    hook: Function | Function[] | undefined,
    args: any[] = [],
) => {
    if (isArray(hook)) {
        hook.forEach(h => h(...args))
    } else if (hook) {
        hook(...args)
    }
}

// 根据用户传入的 props，生成一套完整的过渡钩子函数和 class 名配置，
// 供渲染器在 patch 阶段调用，从而实现进入/离开动画效果。
export function resolveTransitionProps(rawProps) {
    const baseProps: any = {};
    // 拿到所有用户传入的钩子函数，并在后面对钩子函数进行封装
    // 此时其实也是先将与CSS控制动画无关的属性全部放入baseProps
    // 后续如果CSS=false，则直接返回baseProps，因为此时与CSS控制相关的属性是无效的，可以直接删掉
    // 否则，便从rawProps中拿出与CSS控制动画相关的属性并构建动画类名等信息
    // 然后根据这些类名等信息，将用户传入的钩子函数进行封装
    for (const key in rawProps) {
        if (!(key in DOMTransitionPropsValidators)) {
            baseProps[key] = rawProps[key];
        }
    }

    // 如果用户设置css为false，则只使用 JavaScript 钩子函数控制过渡行为，
    // 不对钩子函数进行封装(即不自动添加 CSS class，也不监听动画结束事件)。
    if (rawProps.css === false) {
        return baseProps;
    }

    // enterFrom enterActive enterTo  leaveFrom leaveActive leaveTo
    // 构建CSS控制动画相关的属性
    const {
        name = 'v',
        type,
        duration,
        enterFromClass = `${name}-enter-from`,
        enterActiveClass = `${name}-enter-active`,
        enterToClass = `${name}-enter-to`,
        appearFromClass = enterFromClass,
        appearActiveClass = enterActiveClass,
        appearToClass = enterToClass,
        leaveFromClass = `${name}-leave-from`,
        leaveActiveClass = `${name}-leave-active`,
        leaveToClass = `${name}-leave-to`,
    } = rawProps

    // 解析动画持续时长
    const durations = normalizeDuration(duration)
    const enterDuration = durations && durations[0]
    const leaveDuration = durations && durations[1]

    // 拿到用户传入的钩子函数
    const {
        onBeforeEnter,
        onEnter,
        onEnterCancelled,
        onLeave,
        onLeaveCancelled,
        onBeforeAppear = onBeforeEnter,
        onAppear = onEnter,
        onAppearCancelled = onEnterCancelled,
    } = baseProps;

    /**
     *  enter完成，移除相关的类名，如果用户传入了done，就执行done
     *  因为用户可能是下面这种方式传入的
     *  onEnter(el) {
     *      console.log('enter', arguments);
     *  }
     *  即此时用户设置的钩子没有传入done
     */
    const finishEnter = (
        el: Element & { _enterCancelled?: boolean },
        isAppear: boolean,
        done?: () => void,
        isCancelled?: boolean,
    ) => {
        el._enterCancelled = isCancelled;
        removeTransitionClass(el, isAppear ? appearToClass : enterToClass);
        removeTransitionClass(el, isAppear ? appearActiveClass : enterActiveClass);
        done && done();
    }

    /**
     * leave完成，移除相关的类名
     */
    const finishLeave = (
        el: Element & { _isLeaving?: boolean },
        done?: () => void,
    ) => {
        el._isLeaving = false;
        removeTransitionClass(el, leaveFromClass);
        removeTransitionClass(el, leaveToClass);
        removeTransitionClass(el, leaveActiveClass);
        done && done();
    }

    /**
     * 
     * 创建钩子(appear或enter)，该函数返回一个函数，也就是返回对用户传入的钩子包装过后的钩子
     */
    const makeEnterHook = (isAppear: boolean) => {
        return (el: Element, done: () => void) => {
            const hook = isAppear ? onAppear : onEnter; // 先拿到用户传入的钩子
            // resolve是动画结束时调用的函数
            const resolve = () => finishEnter(el, isAppear, done);
            // 调用用户传入的钩子(如果用户传了的话)，参数传入el(dom元素)和resolve(done函数)
            callHook(hook, [el, resolve]);
            nextFrame(() => {
                // 移除from类名，添加to类名
                // 然后根据active设置的transition，便可以实现动画播放
                // 例如：
                // from对应的样式是 opacity: 0
                // to对应的样式是 opacity: 1
                // active对应的样式是 transition: opacity 1s ease
                // 删除from类名添加to类名，此时opacity便会根据active的transition情况进行动画播放
                removeTransitionClass(el, isAppear ? appearFromClass : enterFromClass)
                addTransitionClass(el, isAppear ? appearToClass : enterToClass)

                if (!hook || hook.length <= 1) {
                    /**
                     *  因为用户可能是下面这种方式传入的钩子函数
                     *  onEnter(el) {
                     *      console.log('enter', arguments);
                     *  }
                     *  即用户设置的钩子没有传入done(函数参数小于2)，hook的参数长度便小于等于1
                     *  此时vue需要自己进行动画结束处理工作
                     */
                    el.addEventListener('transitionend', resolve);
                }
            });
        }
    }


    return Object.assign(baseProps, {
        /**
         * 对用户传入的beforeEnter钩子继续封装,
         * dom 进入之前，执行用户的钩子，并添加enterFrom和enterActive类名
         */
        onBeforeEnter(el) {
            callHook(onBeforeEnter, [el]);
            addTransitionClass(el, enterFromClass);
            addTransitionClass(el, enterActiveClass);
        },
        onBeforeAppear(el) {
            callHook(onBeforeAppear, [el])
            addTransitionClass(el, appearFromClass);
            addTransitionClass(el, appearActiveClass)
        },
        onEnter: makeEnterHook(false),
        onAppear: makeEnterHook(true),
        /**
         * 此处done函数是在renderer#mountElement中传入的
         */
        onLeave(el, done) {
            el._isLeaving = true;
            const resolve = () => finishLeave(el, done);
            addTransitionClass(el, leaveFromClass);
            if (!el._enterCancelled) {
                // 先强制进行重绘，让样式变成leaveFrom样式，再添加activeClass(transition)
                forceReflow();
                addTransitionClass(el, leaveActiveClass);
            } else {
                addTransitionClass(el, leaveActiveClass);
                forceReflow();
            }
            nextFrame(() => {
                if (!el._isLeaving) {
                    // cancelled
                    return;
                }
                // 同enter一样，先移除leaveFromClass，再添加leaveToClass，
                // 这样就会根据activeClass设置的transition进行动画播放
                removeTransitionClass(el, leaveFromClass);
                addTransitionClass(el, leaveToClass);
                // 如果用户传入的onLeave钩子参数个数为2，则说明用户需要自己管理done，
                // 否则监听动画结束进行resolve
                if (!onLeave || onLeave.length <= 1) {
                    el.addEventListener('transitionend', resolve);
                }
            });
            // 调用用户传入的onLeave钩子
            // 用户传入的onLeave可能没有resolve(done)，
            // 此时我们便在nextFrame中对其进行判断来决定我们自己调用resolve，还是用户自己管理resolve
            callHook(onLeave, [el, resolve]); 
        },
        onEnterCancelled(el) {
            finishEnter(el, false, undefined, true)
            callHook(onEnterCancelled, [el])
        },
        onAppearCancelled(el) {
            finishEnter(el, true, undefined, true)
            callHook(onAppearCancelled, [el])
        },
        onLeaveCancelled(el) {
            finishLeave(el)
            callHook(onLeaveCancelled, [el])
        },
    });
}

/**
 * 给 Transition 组件设置props，这样就能当h函数传入props时，不会将其当作attrs来处理了
 */
const decorate = (t: typeof Transition) => {
    t.displayName = 'Transition'
    t.props = TransitionPropsValidators
    return t
}

// Transition组件是BaseTransition的一个实现，存在于runtime-dom包下
// BaseTransition属于runtime-core包下
// Transition组件是一个函数式组件
export const Transition = decorate(
    (props, { slots }) =>
        h(BaseTransition, resolveTransitionProps(props), slots)
)

function normalizeDuration(
    duration,
): [number, number] | null {
    if (duration == null) {
        return null
    } else if (isObject(duration)) {
        return [NumberOf(duration.enter), NumberOf(duration.leave)]
    } else {
        const n = NumberOf(duration)
        return [n, n]
    }
}

function NumberOf(val): number {
    const res = Number(val);
    return isNaN(res) ? val : res;
}

export function addTransitionClass(el: Element, cls: string): void {
    // 往dom元素上添加动画类名
    cls.split(/\s+/).forEach(c => c && el.classList.add(c));

    (el[vtcKey] || (el[vtcKey] = new Set())).add(cls);
}

export function removeTransitionClass(el: Element, cls: string): void {
    // 移除dom元素上的动画类名
    cls.split(/\s+/).forEach(c => c && el.classList.remove(c));

    const _vtc = el[vtcKey];
    if (_vtc) {
        _vtc.delete(cls)
        if (!_vtc!.size) {
            el[vtcKey] = undefined
        }
    }
}

function nextFrame(cb: () => void) {
    requestAnimationFrame(() => {
        requestAnimationFrame(cb)
    })
}

/**
 * 强制回流
 */
export function forceReflow(): number {
    return document.body.offsetHeight
}
