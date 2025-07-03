import { ShapeFlags } from "@vue/shared";
import { onBeforeUnmount, onMounted } from "../apiLifecycle"


const TransitionHookValidator = [Function, Array];

export const BaseTransitionPropsValidators = {
    mode: String,
    appear: Boolean,
    persisted: Boolean,
    // enter
    onBeforeEnter: TransitionHookValidator,
    onEnter: TransitionHookValidator,
    onAfterEnter: TransitionHookValidator,
    onEnterCancelled: TransitionHookValidator,
    // leave
    onBeforeLeave: TransitionHookValidator,
    onLeave: TransitionHookValidator,
    onAfterLeave: TransitionHookValidator,
    onLeaveCancelled: TransitionHookValidator,
    // appear
    onBeforeAppear: TransitionHookValidator,
    onAppear: TransitionHookValidator,
    onAfterAppear: TransitionHookValidator,
    onAppearCancelled: TransitionHookValidator,
}

/**
 * 创建一个当前Transition组件的状态，
 * 该函数是在BaseTransition的setup函数中执行的
 * 所以通过调用组件生命周期钩子(onMounted、onBeforeUnmount)来进行状态管理
 * 注意：这里的状态是Transition组件本身的状态，不是其内部组件的状态
 */
export function useTransitionState() {
    const state = {
        isMounted: false,
        isLeaving: false,
        isUnmounting: false,
        leavingVNodes: new Map(),
    }
    // 组件挂载完成后将状态设置为挂载完成
    // 用于参与appear功能的实现
    // 注意：这里是Transition组件自身的生命周期
    onMounted(() => {
        state.isMounted = true
    })
    onBeforeUnmount(() => {
        state.isUnmounting = true
    })
    return state
}


//获取插槽中的子节点,为子节点添加过渡钩子,并返回子节点（不包裹任何额外 DOM）；
const BaseTransitionImpl = {
    name: `BaseTransition`,

    props: BaseTransitionPropsValidators,

    setup(props, { slots }) {
        const state = useTransitionState();

        return () => {
            const children =
                slots.default && slots.default();
            if (!children || !children.length) {
                return
            }

            const child = children[0];  // 此处由于slots被规范化，故default拿到的是数组

            // 再次对钩子函数进行包装(例如appear的实现)
            let enterHooks = resolveTransitionHooks(props, state);
            // 将钩子函数挂载到组件实例上
            setTransitionHooks(child, enterHooks);

            return child;
        }
    }
};

export const BaseTransition = BaseTransitionImpl as unknown as {
    new(): {
        $props
        $slots: {
            default()
        }
    }
}

export function resolveTransitionHooks(
    props,
    state,
) {
    const {
        appear,
        mode,
        persisted = false,
        onBeforeEnter,
        onEnter,
        onAfterEnter,
        onEnterCancelled,
        onBeforeLeave,
        onLeave,
        onAfterLeave,
        onLeaveCancelled,
        onBeforeAppear,
        onAppear,
        onAfterAppear,
        onAppearCancelled,
    } = props;

    const callHook = (hook, args) => {
        hook && hook(...args);
    }

    const hooks = {
        mode,
        persisted,
        // 对onBeforeEnter进行包装，从而实现appear
        beforeEnter(el) {
            let hook = onBeforeEnter;
            if (!state.isMounted) {
                if (props.appear) {
                    // 如果是首次出现，那么优先调用beforeAppear钩子，
                    // 挂载完成后便不会进入这个if(即一直都是调用beforeEnter钩子)
                    hook = onBeforeAppear || onBeforeEnter;
                } else {
                    return;
                }
            }
            callHook(hook, [el]);
        },
        // 对onEnter进行包装，从而实现appear
        enter(el) {
            let hook = onEnter;
            if (!state.isMounted) {
                if (appear) {
                    // 如果是首次出现，那么优先调用appear钩子，
                    // 挂载完成后便不会进入这个if(即一直都是调用enter钩子)
                    hook = onAppear || onEnter;
                } else {
                    return;
                }
            }
            callHook(hook, [el])
        },
        leave(el, remove) {
            if (state.isUnmounting) {
                // 如果Transition组件正在被卸载，那么说明下一步就会进行其内部组件(子组件)的生命周期，
                // 但由于Transition组件都要被卸载了，所以此时便会直接对子组件dom元素进行移除，跳过动画
                return remove()
            }
            callHook(onBeforeLeave, [el]);
            callHook(onLeave, [el, remove]);
        }
    }

    return hooks;
}

export function setTransitionHooks(vnode, hooks): void {
    if (vnode.shapeFlag & ShapeFlags.COMPONENT && vnode.component) {
        vnode.transition = hooks
        setTransitionHooks(vnode.component.subTree, hooks)
    } else {
        vnode.transition = hooks
    }
}
