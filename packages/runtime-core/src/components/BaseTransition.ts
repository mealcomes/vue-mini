import { onBeforeUnmount, onMounted } from "../apiLifecycle"
import { getCurrentInstance } from "../component"

export function useTransitionState() {
    const state = {
        isMounted: false,
        isLeaving: false,
        isUnmounting: false,
        leavingVNodes: new Map(),
    }
    onMounted(() => {
        state.isMounted = true
    })
    onBeforeUnmount(() => {
        state.isUnmounting = true
    })
    return state
}

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


//获取插槽中的子节点,为子节点添加过渡钩子,并返回子节点（不包裹任何额外 DOM）；
const BaseTransitionImpl = {
    name: `BaseTransition`,

    props: BaseTransitionPropsValidators,

    setup(props, { slots }) {
        const instance = getCurrentInstance()!;
        const state = useTransitionState();

        return () => {
            const child =
                slots.default && slots.default();
            if (!child) {
                return
            }

            child.transition = {
                beforeEnter: props.onBeforeEnter,
                enter: props.onEnter,
                leave: props.onLeave
            };

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


