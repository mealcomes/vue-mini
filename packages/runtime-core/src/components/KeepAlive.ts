import { invokeArrayFns, ShapeFlags } from "@vue/shared";
import { injectHook, onBeforeUnmount, onMounted, onUnmounted, onUpdated } from "../apiLifecycle";
import { currentInstance, getCurrentInstance } from "../component";
import { isSameVNodeType } from "../vnode";
import { LifecycleHooks } from "../enums";
import { queuePostFlushCb } from "../scheduler";

export const isKeepAlive = (vnode): boolean =>
    vnode.type.__isKeepAlive

const KeepAliveImpl = {
    name: 'KeepAlive',

    __isKeepAlive: true,

    props: {
        include: [String, RegExp, Array],
        exclude: [String, RegExp, Array],
        max: [String, Number],
    },

    // 缓存的是组件  ->  组件里有subtree  ->  subtree上有el元素  ->  移动到页面中
    setup(props, { slots }) {
        // 先拿到当前实例与KeepAlive相关的ctx(dom操作API)
        const instance = getCurrentInstance()!;
        const sharedContext = instance.ctx;

        const cache = new Map(); // 缓存表
        const keys = new Set();  // 用来记录哪些组件缓存过
        let current = null;

        const {
            renderer: {
                p: patch,
                m: move,
                um: _unmount,
                o: { createElement },
            },
        } = sharedContext;
        const storageContainer = createElement('div');
        sharedContext.activate = (vnode, container, anchor) => {
            const instance = vnode.component!;
            // 此时vnode.subTree.el指向的dom元素存在于storageContainer上
            // 将该dom元素加到container上去，其实也就是将storageContainer上对应的dom移动到了container上
            move(vnode, container, anchor);
            patch(
                instance.vnode,
                vnode,
                container,
                anchor,
                instance,
            );
            // activated 钩子函数执行
            queuePostFlushCb(() => {
                instance.isDeactivated = false;
                if (instance.a) {
                    invokeArrayFns(instance.a);
                }
            });
        }

        sharedContext.deactivate = (vnode) => {
            const instance = vnode.component!;
            // 组件失活时，将组件的dom元素临时移动到一个用于存储的div中
            // 此时组件的subtree.el仍然指向该dom，只是dom的位置变了而已
            move(vnode, storageContainer, null);
            // deactivated 钩子函数执行
            queuePostFlushCb(() => {
                if (instance.da) {
                    invokeArrayFns(instance.da);
                }
            });
        }

        function unmount(vnode) {
            // 先移除与KeepAlive相关的shapeFlag(不然删不掉的)
            resetShapeFlag(vnode);
            _unmount(vnode, instance);
        }

        /**
         * 删除指定key的缓存
         */
        function pruneCacheEntry(key) {
            const cached = cache.get(key);
            if (cached && (!current || !isSameVNodeType(cached, current))) {
                // 只有待删除的组件与当前正处于激活状态的组件不是相同组件的时候才会进行删除
                unmount(cached)
            } else if (current) {
                // 相同的话，则先进行resetShapeFlag，这样后面就能正常删了
                resetShapeFlag(current)
            }
            cache.delete(key)
            keys.delete(key)
        }

        // 在渲染完成后，缓存KeepAlive内部children组件，即subTree
        // ctrl+点击 见赋值处
        let pendingCacheKey = null;
        const cacheSubtree = () => {
            if (pendingCacheKey != null) {
                cache.set(pendingCacheKey, instance.subTree);
            }
        }
        onMounted(cacheSubtree);
        onUpdated(cacheSubtree);

        onBeforeUnmount(() => {
            // 当 <KeepAlive> 所在的父组件被销毁时，它自身也会被卸载
            // 此时：所有被缓存的组件实例也需要处理
            // 但当前正在展示的那个组件（active vnode）不能直接卸载
            // 先将 active vnode 的shapeFlag重置，等其后续正常卸载
            cache.forEach(cached => {
                const { subTree: vnode } = instance;
                if (isSameVNodeType(cached, vnode)) {
                    resetShapeFlag(vnode);
                    return;
                }
                unmount(cached);
            });
        });

        return () => {
            // 先重置pendingCacheKey
            pendingCacheKey = null;

            if (!slots.default) {
                return (current = null);
            }
            const children = slots.default();
            if (!children || !children.length) {
                return (current = null);
            }

            const vnode = children[0];  // 此处由于slots被规范化，故default拿到的是数组
            const comp = vnode.type;

            const { include, exclude, max } = props

            const key = vnode.key == null ? comp : vnode.key;
            const cachedVNode = cache.get(key);  // 从缓存中去key对应的vnode

            // 设置当前正在准备挂载的组件的key
            // 这样在组件挂在完成后，便能在cache中缓存其subtree
            // 见pendingCacheKey定义处
            pendingCacheKey = key;

            if (cachedVNode) {
                vnode.el = cachedVNode.el;
                vnode.component = cachedVNode.component;
                vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE // 避免该节点做初始化操作

                // 刷新缓存，保证该key位于set最新的地方，用于后续size超出max后的卸载
                keys.delete(key)
                keys.add(key)
            } else {
                keys.add(key);
                if (max && keys.size > parseInt(max, 10)) {
                    // 达到了最大缓存个数，删除最久未使用的
                    // .values() 拿到迭代器
                    // .next().value 拿到第一个
                    pruneCacheEntry(keys.values().next().value!);
                }
            }

            // 避免组件被卸载
            // renderer.ts里面删除时，会进行判断
            vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE;

            // 将当前正处于激活状态的组件赋值给current，
            // 用于防止当出现cache.size > max进行真正的unmount组件时，
            // 将当前正处于激活状态的组件给删了(见pruneCacheEntry函数)
            current = vnode;
            return vnode;
        }
    }

};

export const KeepAlive = KeepAliveImpl as unknown as {
    __isKeepAlive: true
    new(): {
        $props
        $slots: {
            default()
        }
    }
};

export function onActivated(
    hook,
    target?,
): void {
    registerKeepAliveHook(hook, LifecycleHooks.ACTIVATED, target);
}

export function onDeactivated(
    hook,
    target?,
): void {
    registerKeepAliveHook(hook, LifecycleHooks.DEACTIVATED, target);
}

/**
 * 将用户定义的 KeepAlive 钩子注册到实例上
 */
function registerKeepAliveHook(
    hook,
    type,
    target = currentInstance,
) {
    const wrappedHook = () => {
        // 只有当 target 不位于 deactivated 分支上，才会进行钩子调用
        // 所以后续在调用本钩子时，就从本钩子所在实例网上找，
        // 如果找到了一个父实例是 deactivated，就直接返回，不执行用户传入的钩子
        let current = target;
        while (current) {
            if (current.isDeactivated) {
                return;
            }
            current = current.parent;
        }
        return hook();
    };

    // 将包装过后的钩子放到当前实例(即正在执行 setup 的组件实例)上
    // injectHook 函数也就是组件其他生命钩子的注入函数
    injectHook(type, wrappedHook, target); 

    // 将钩子注入到对应 KeepAlive 组件的根组件中去，这样后续只用遍历根组件的钩子数组依次进行调用即可
    if (target) {
        let current = target.parent
        while (current && current.parent) {
            if (isKeepAlive(current.parent.vnode)) {
                // 如果父组件是 KeepAlive 组件，则说明当前组件是根组件
                injectToKeepAliveRoot(wrappedHook, type, target, current)
            }
            current = current.parent
        }
    }
}

/**
 * 将KeepAlive相关钩子注入到KeepAlive的根组件中
 */
function injectToKeepAliveRoot(
    hook,
    type,
    target,
    keepAliveRoot,
) {
    // 需要往钩子列表的头部插入该钩子函数(即prepend为true)
    // 钩子函数的执行是从钩子数组的开始往后执行的，并且钩子函数的注入顺序是先父组件再子组件
    // 当KeepAlive的根组件注册了onActivate，其子组件也注册了该钩子
    // 如果不往钩子列表头部插入钩子，就会导致钩子触发时根组件先于子组件被调用
    // 但这是不符合要求的，因为子组件的更新是先于根组件的，
    // 对应的 onActivate 也应该是子组件先于父组件被调用
    // 注意：子组件定义 KeepAlive 相关钩子时，
    // 其只会在对应 KeepAlive 根组件发生 activate 或 inactivate 时才会被触发
    // (参见components.html对应处的注意事项)
    const injected = injectHook(type, hook, keepAliveRoot, true);
    onUnmounted(() => {
        const i = keepAliveRoot[type]!.indexOf(injected);
        if (i > -1) {
            keepAliveRoot[type]!.splice(i, 1);
        }
    }, target);
}

/**
 * 移除组件shapeFlag中与KeepAlive相关的值
 */
function resetShapeFlag(vnode) {
    vnode.shapeFlag &= ~ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
    vnode.shapeFlag &= ~ShapeFlags.COMPONENT_KEPT_ALIVE
}
