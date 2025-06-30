import { isString, ShapeFlags } from "@vue/shared";
import { MoveType } from "../renderer";

export const isTeleport = (type) => type.__isTeleport;
// disabled的Teleport不会进行生效，内部组件直接原地插入
const isTeleportDisabled = (props): boolean =>
    props && (props.disabled || props.disabled === '')

// 获取target对应的dom元素
const resolveTarget = (
    props,
    select,
) => {
    const targetSelector = props && props.to;
    if (isString(targetSelector)) {
        if (!select) {
            console.warn(
                `Current renderer does not support string target for Teleports. ` +
                `(missing querySelector renderer option)`,
            );
            return null;
        } else {
            const target = select(targetSelector);
            if (!target && !isTeleportDisabled(props)) {
                console.warn(
                    `Failed to locate Teleport target with selector "${targetSelector}". ` +
                    `Note the target element must exist before the component is mounted - ` +
                    `i.e. the target cannot be rendered by the component itself, and ` +
                    `ideally should be outside of the entire Vue component tree.`,
                );
            }
            return target;
        }
    } else {
        if (!targetSelector && !isTeleportDisabled(props)) {
            console.warn(`Invalid Teleport target: ${targetSelector}`)
        }
        return targetSelector;
    }
}

export const TeleportImpl = {
    name: 'Teleport',
    __isTeleport: true,
    process(
        n1,
        n2,
        container,
        anchor,
        parentComponent,
        internals
    ) {
        const {
            mc: mountChildren,
            pc: patchChildren,
            o: { insert, querySelector, createText },
        } = internals;

        // Teleport组件最新的状态
        const disabled = isTeleportDisabled(n2.props)
        let { shapeFlag, children } = n2;

        if (n1 == null) {
            // 现在原地的内部插入首尾锚点，注意是插在container中不是target中
            // 用于标记Teleport组件原本的位置
            const placeholder = (n2.el = createText(''));
            const mainAnchor = (n2.anchor = createText(''));
            insert(placeholder, container, anchor)
            insert(mainAnchor, container, anchor)

            const mount = (container, anchor) => {
                if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                    mountChildren(
                        children,
                        container,
                        anchor,
                    )
                }
            }
            const mountToTarget = () => {
                const target = (n2.target = resolveTarget(n2.props, querySelector))
                // 在目标dom中插入首尾锚点，并拿到尾部锚点
                const targetAnchor = prepareAnchor(target, n2, createText, insert);
                if (target) {
                    if (!disabled) {
                        // 如果是enabled，就插入到target中
                        mount(target, targetAnchor)
                    }
                } else {
                    console.warn(
                        'Invalid Teleport target on mount:',
                        target,
                        `(${typeof target})`,
                    )
                }
            }
            // 如果是disabled了，就不插入在target中，而是直接原地进行插入
            if (disabled) {
                mount(container, mainAnchor)
            }

            mountToTarget();
        } else {
            // 注意，Teleport组件更新的时候需要维护两部分内容
            // 一部分是Teleport组件本身及内部组件的挂载位置
            // 一部分是内部组件之间的相对位置及
            // Teleport组件本身在container中可能会发生移动，此时需要更新n2.el和n2.anchor(即本身的锚点)
            // target发生变化时，则需要将其内部组件从旧的target移动到新的target中
            // 对于内部组件的更新则通过patchChildren进行diff复用更新

            // 先进行状态信息复用
            // n1.el 为container元素内部的首部锚点(见本if语句另一分支的开头两行)
            n2.el = n1.el;
            // n1.targetStart为target元素内部的首部锚点，见prepareAnchor函数
            n2.targetStart = n1.targetStart;
            // n1.anchor 为container元素内部的尾部锚点(见本if语句另一分支的开头两行)
            const mainAnchor = (n2.anchor = n1.anchor)!;
            // n1.targetAnchor为target元素内部的尾部锚点，见prepareAnchor函数
            const targetAnchor = (n2.targetAnchor = n1.targetAnchor)!;
            const target = (n2.target = n1.target)!;

            // Teleport组件旧的disabled状态
            const wasDisabled = isTeleportDisabled(n1.props);

            // 通过Teleport组件旧的disabled状态，拿到当前其内部组件的位置
            // 比如当旧的为disabled，则其内部组件目前位于Teleport的container中，对应的锚点为mainAnchor
            const currentContainer = wasDisabled ? container : target;
            const currentAnchor = wasDisabled ? mainAnchor : targetAnchor;

            // 先将根据上面拿到的Teleport内部组件所在位置及锚点，
            // 对内部组件(children)的dom元素进行diff算法复用更新，
            // 此时进行的是内部children的dom复用与属性、相对位置更新
            patchChildren(
                n1,
                n2,
                currentContainer,
                currentAnchor,
                parentComponent,
            )

            // 然后进行Teleport组件及其内部整体children的位置更新
            if (disabled) {
                if (!wasDisabled) {
                    // enabled -> disabled 
                    // 让组件回到到container的原本位置
                    moveTeleport(
                        n2,
                        container,
                        mainAnchor,
                        internals,
                        TeleportMoveTypes.TOGGLE,
                    )
                } else {
                    // 最新的状态为disabled时，可能需要更新target，便于后面恢复enabled时不丢失状态
                    if (n2.props && n1.props && n2.props.to !== n1.props.to) {
                        n2.props.to = n1.props.to
                    }
                }
            } else {
                if ((n2.props && n2.props.to) !== (n1.props && n1.props.to)) {
                    // 旧的和新的都是enabled，且target改变
                    const nextTarget = (n2.target = resolveTarget(
                        n2.props,
                        querySelector,
                    ));
                    if (nextTarget) {
                        moveTeleport(
                            n2,
                            nextTarget,
                            null,
                            internals,
                            TeleportMoveTypes.TARGET_CHANGE,
                        )
                    } else {
                        console.warn(
                            'Invalid Teleport target on update:',
                            target,
                            `(${typeof target})`,
                        )
                    }
                }
                else if (wasDisabled) {
                    // disabled -> enabled
                    // 将组件移动target中
                    moveTeleport(
                        n2,
                        target,
                        targetAnchor,
                        internals,
                        TeleportMoveTypes.TOGGLE,
                    )
                }
            }
        }
    },

    // Teleport组件删除函数
    remove(vnode, { um: unmount, o: { remove: hostRemove } }) {
        const {
            shapeFlag,
            children,
            anchor,        // container内部首部锚点
            targetStart,   // target内部首部锚点
            targetAnchor,  // target内部尾部锚点
            target,
        } = vnode;

        if (target) {
            hostRemove(targetStart!)
            hostRemove(targetAnchor!)
        }

        hostRemove(anchor!);

        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                unmount(child);
            }
        }
    }
}

// Teleport组件移动类型
export enum TeleportMoveTypes {
    TARGET_CHANGE,  // target发生变化
    TOGGLE, // enable / disable
    REORDER, // Teleport组件在container中的位置发生变化
}

function moveTeleport(
    vnode,
    container,
    parentAnchor,
    { o: { insert }, m: move },
    moveType: TeleportMoveTypes = TeleportMoveTypes.REORDER,
) {
    // 如果是target改变，则移动target内部尾部锚点，即维护targetAnchor的位置
    // 此时container是新的target
    // 即将targetAnchor插入到新的target中
    if (moveType === TeleportMoveTypes.TARGET_CHANGE) {
        insert(vnode.targetAnchor!, container, parentAnchor);
    }
    const {
        el,        // container 首部锚点
        anchor,    // container 尾部锚点
        shapeFlag,
        children,
        props
    } = vnode;
    const isReorder = moveType === TeleportMoveTypes.REORDER;
    // 如果是Teleport组件本身位置发生变化，就移动Teleport组件内部首部锚点(尾部移动在后面)
    if (isReorder) {
        insert(el!, container, parentAnchor)
    }
    // 当移动类型不是Teleport移动或Teleport没有被disabled，则进行children的移动
    if (!isReorder || isTeleportDisabled(props)) {
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            // 此处的children由于在process函数中已经进行了patchChildren进行diff更新，所以children内部的相对顺序已经是排好了的
            for (let i = 0; i < children.length; i++) {
                // 调用renderer中传入的move函数进行移动
                // 这里进去的基本都能走到move函数的最后面，即直接进行dom操作
                move(
                    children[i],
                    container,
                    parentAnchor,
                    MoveType.REORDER,
                );
            }
        }
    }
    // 如果是Teleport本身位置发生变化，就移动Teleport组件内部尾部锚点(首部移动在前面)
    if (isReorder) {
        insert(anchor!, container, parentAnchor)
    }
}

export const Teleport = TeleportImpl as unknown as {
    __isTeleport: true
    new(): {
        $props
        $slots: {
            default()
        }
    }
}

// 在目标dom元素内部首位插入锚点
function prepareAnchor(
    target,
    vnode,
    createText,
    insert,
) {
    const targetStart = (vnode.targetStart = createText(''))
    const targetAnchor = (vnode.targetAnchor = createText(''))

    if (target) {
        insert(targetStart, target)
        insert(targetAnchor, target)
    }

    return targetAnchor
}