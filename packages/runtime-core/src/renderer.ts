import { invokeArrayFns, PatchFlags, ShapeFlags } from "@vue/shared";
import { Fragment, isSameVNodeType, normalizeVNode } from "./vnode";
import { Text, Comment } from "./vnode";
import { isRef, ReactiveEffect } from "@vue/reactivity";
import { queueJob } from "./scheduler";
import { createComponentInstance, setupComponent } from "./component";
import { shouldUpdateComponent, updateProps } from "./componentProps";
import { renderComponentRoot } from "./componentRenderUtils";
import { updateSlots } from "./componentSlots";
import { isKeepAlive } from "./components/KeepAlive";


// dom 元素的移动类型
export enum MoveType {
    ENTER,   // 新节点进入
    LEAVE,   // 旧节点离开
    REORDER, // 节点在容器中重新排序
}

/*
render ==> patch
(根据不同类型进行不同的处理，例如Element、Text等,。其中Element 中可能包含子节点，此时调用mountChildren进行递归渲染)
*/
export function createRenderer(options) {
    const {
        insert: hostInsert,
        remove: hostRemove,
        patchProp: hostPatchProp,
        createElement: hostCreateElement,
        createText: hostCreateText,
        createComment: hostCreateComment,
        setText: hostSetText,
        setElementText: hostSetElementText,
        parentNode: hostParentNode,
        nextSibling: hostNextSibling,
    } = options;

    // 递归渲染子节点
    const mountChildren = (children: Array<any>, container, anchor, parentComponent) => {
        // 数组扁平化，避免嵌套
        // children = children.flat();  // 此处不能直接扁平化，意外扁平化获得的数组是一个新的数组，
        // 此时如果有一个children为text，那么最终children中不能对应变为vnode类型

        for (let i = 0; i < children.length; i++) {
            // 规范化子节点(需要对原children进行规范，例如Text类型变为Vnode类型)
            // 例如 <div>hello</div> 中的 hello 规范化为
            // { type: Symbol(v-txt), props: null, children: 'hello', shapeFlag: 8 }
            const child = (children[i] = normalizeVNode(children[i]));
            patch(null, child, container, anchor, parentComponent);
        }
    }

    const mountElement = (vnode, container, anchor, parentComponent) => {
        const { type, props, shapeFlag, transition } = vnode;

        // 第一次渲染时，让 vnode.el 指向真实的 DOM 元素
        let el = (vnode.el = hostCreateElement(type));

        // 属性设置 
        // {
        //     style: {
        //         color: 'red',
        //     },
        //     class: 'container',
        // }
        if (props) {
            for (const key in props) {
                if (key !== 'value' && key !== 'ref' && key !== 'key') {
                    hostPatchProp(el, key, null, props[key]);
                }
            }
        }

        // 处理文本类型的子节点
        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            hostSetElementText(el, vnode.children);
        }
        // 处理数组类型的子节点
        else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            mountChildren(vnode.children, el, anchor, parentComponent);
        }

        if (transition) {
            transition.beforeEnter(el);
        }

        hostInsert(el, container, anchor);

        if (transition) {
            transition.enter(el);
        }
    }

    // 结合index.html#8,#9
    const mountComponent = (vnode, container, anchor, parentComponent) => {
        const instance = (vnode.component = createComponentInstance(vnode, parentComponent))

        // 如果是KeepAlive组件，便将dom操作API注入到ctx中
        if (isKeepAlive(vnode)) {
            (instance.ctx as any).renderer = internals;
        }

        // 初始化instance.props和instance.attrs
        setupComponent(instance);

        // 组件与数据绑定
        setupRenderEffect(instance, vnode, container, anchor);
    }

    // 将组件的渲染和响应式数据进行绑定
    const setupRenderEffect = (instance, vnode, container, anchor,) => {
        // 组件更新函数
        const componentUpdateFn = () => {
            if (!instance.isMounted) {
                const { bm, m } = instance;

                // 执行beforeMount钩子
                if (bm) {
                    invokeArrayFns(bm);
                }

                const subTree = renderComponentRoot(instance);

                patch(null, subTree, container, anchor, instance);
                instance.subTree = subTree;
                instance.isMounted = true;

                // 执行Mounted钩子
                if (m) {
                    invokeArrayFns(m);
                }
            }
            else {
                const { next, bu, u } = instance;
                if (next) {
                    // 更新属性和插槽 见本文件createRenderer中的updateComponent函数
                    updateComponentPreRender(instance, next);
                }

                // 执行beforeUpdate钩子
                // 因为第一次到达这里时，next为null，然后在下面patch中会将next置为新的vnode，然后再次进入本函数，从而进入next逻辑
                // 所以bu是在此处执行
                if (bu) {
                    invokeArrayFns(bu)
                }
                const subTree = renderComponentRoot(instance);

                // 基于状态的组件更新
                patch(instance.subTree, subTree, container, anchor, instance);
                instance.subTree = subTree

                // 执行updated钩子
                if (u) {
                    invokeArrayFns(u)
                }
            }
        }

        // 将组件更新函数变为ReactiveEffect，从而达到数据更新，派发组件的更新
        const effect = new ReactiveEffect(componentUpdateFn,
            () => queueJob(update));  // 异步更新组件，避免一次更改多个数据导致组件频繁更新

        const update = (instance.update = () => effect.run());

        update();
    }

    const processText = (n1, n2, container, anchor) => {
        if (n1 == null) {
            hostInsert(
                (n2.el = hostCreateText(n2.children as string)),
                container,
                anchor
            )
        } else {
            const el = (n2.el = n1.el!)
            if (n2.children !== n1.children) {
                hostSetText(el, n2.children as string)
            }
        }
    }

    const processCommentNode = (n1, n2, container, anchor) => {
        if (n1 == null) {
            hostInsert(
                (n2.el = hostCreateComment((n2.children as string) || '')),
                container,
                anchor
            );
        } else {
            n2.el = n1.el;
        }
    }

    const processFragment = (n1, n2, container, anchor, parentComponent) => {
        if (n1 == null) {
            mountChildren(n2.children, container, anchor, parentComponent);
        }
        else {
            patchChildren(n1, n2, container, anchor, parentComponent);
        }
    }

    const processElement = (n1, n2, container, anchor, parentComponent) => {
        if (n1 == null) {
            mountElement(n2, container, anchor, parentComponent);
        }
        // n1已经存在(container上已经存在dom)，需要进行比对进行diff
        else {
            patchElement(n1, n2, parentComponent);
        }
    }

    const processComponent = (n1, n2, container, anchor, parentComponent) => {
        if (n1 == null) {
            if (n2.shapeFlag & ShapeFlags.COMPONENT_KEPT_ALIVE) {
                // 如果是KeepAlive组件的子组件，则走activate
                // 此时parentComponent便是KeepAlive组件本身
                // 其在KeepAlive.ts的setup中为其子组件加入了ShapeFlags.COMPONENT_KEPT_ALIVE
                parentComponent!.ctx.activate(n2, container, anchor);
            } else {
                // 组件渲染
                mountComponent(
                    n2,
                    container,
                    anchor,
                    parentComponent
                )
            }
        } else {
            // 组件更新
            updateComponent(n1, n2);
        }
    }

    const updateComponent = (n1, n2) => {
        // 组件实例复用是复用component(subTree)即复用的是dom(元素复用的是el)
        const instance = (n2.component = n1.component);
        if (shouldUpdateComponent(n1, n2)) {
            if (
                instance.asyncDep &&
                !instance.asyncResolved
            ) {
                // TODO 异步组件
                updateComponentPreRender(instance, n2);
            }
            else {
                // 普通组件更新
                instance.next = n2;  // 将新的vnode赋值给instance.next
                instance.update();    // 调用组件的更新函数，见本文件createRenderer中的setupRenderEffect函数
            }
        }
        else {
            // TODO 注释
            n2.el = n1.el;
            instance.vnode = n2;
        }
    }

    // 复用虚拟节点(需要将新的VNode的component指向旧的)，更新虚拟节点props
    const updateComponentPreRender = (
        instance, // prevVNode.instance
        nextVNode
    ) => {
        nextVNode.component = instance;  // 新VNode的实例变为旧的instance
        const prevProps = instance.vnode.props;  // 拿到旧的vnode的props，注意不是旧的组件的props
        instance.vnode = nextVNode;   // 进行虚拟节点复用
        instance.next = null;  //清空next
        updateProps(instance, nextVNode.props, prevProps);
        updateSlots(instance, nextVNode.children);
    }

    const patchProps = (oldProps, newProps, el) => {
        if (oldProps !== newProps) {
            // 覆盖旧的属性或新添加属性
            for (let key in newProps) {
                hostPatchProp(el, key, oldProps[key], newProps[key]);
            }

            // 老的多余的属性全都需要删除
            for (let key in oldProps) {
                if (!(key in newProps)) {
                    hostPatchProp(el, key, oldProps[key], null);
                }
            }
        }
    }

    const unmountChildren = (children, parentComponent) => {
        for (let i = 0; i < children.length; i++) {
            unmount(children[i], parentComponent);
        }
    }

    // 全量diff算法
    const patchKeyedChildren = (c1, c2, el, parentAnchor, parentComponent) => {
        let i = 0; // 开始比对的索引
        let e1 = c1.length - 1; // c1的尾部索引
        let e2 = c2.length - 1; // c2的尾部索引

        // 1. sync from start
        // (a b) c
        // (a b) d e
        while (i <= e1 && i <= e2) {
            const n1 = c1[i];
            const n2 = (c2[i] = normalizeVNode(c2[i]));
            if (isSameVNodeType(n1, n2)) {
                // 当n1和n2相同时，更新当前节点的属性和儿子(递归比较子节点)
                // 最终进入了 `patchElement` 函数第一行的 `let el = (n2.el = n1.el);` 
                // 即进行了真实dom复用
                patch(n1, n2, el);
            } else {
                break;
            }
            // 尾节点不动，i自增
            i++;
        }

        // 2. sync from end
        // a (b c)
        // d e (b c)
        while (i <= e1 && i <= e2) {
            const n1 = c1[e1];
            const n2 = (c2[e2] = normalizeVNode(c2[e2]));
            if (isSameVNodeType(n1, n2)) {
                // 同上
                patch(n1, n2, el);
            } else {
                break;
            }
            // i 不动，尾节点自减
            e1--;
            e2--;
        }

        // 3. common sequence + mount(新的多，老的少)
        // (a b)
        // (a b) c
        // i = 2, e1 = 1, e2 = 2 (e1 < i <= e2)
        // 或者
        // (a b)
        // c (a b)
        // i = 0, e1 = -1, e2 = 0 (e1 < i <= e2)
        if (i > e1) {
            if (i <= e2) {
                // 说明c2有多余的节点需要挂载
                // 获取位置e2的下一个节点
                // 如果有，则说明是多于节点是挂载在最前面  (a b) ==> c (a b)
                // 如果没有，则说明是挂载在最后面 (a b) ==> (a b) c
                const nextPos = e2 + 1; // 下一个需要挂载的位置
                const anchor = c2[nextPos]?.el; // 下一个需要挂载的锚点
                while (i <= e2) {
                    patch(null, c2[i] = normalizeVNode(c2[i]), el, anchor);
                    i++;
                }
            }
        }

        // 4. common sequence + unmount(老的多，新少)
        // (a b) c
        // (a b)
        // i = 2, e1 = 2, e2 = 1 (e2 < i <= e1)
        // 或者
        // a (b c)
        // (b c)
        // i = 0, e1 = 0, e2 = -1 (e2 < i <= e1)
        else if (i > e2) {
            // 说明c1有多余的节点需要卸载
            // 获取位置e1的下一个节点
            // 如果有，则说明是多于节点是卸载在最前面  (a b) c ==> (a b)
            // 如果没有，则说明是卸载在最后面 (a b) c ==> c (a b)
            while (i <= e1) {
                unmount(c1[i], parentComponent);
                i++;
            }
        }

        /*
        以上确认不变化的节点，并且对插入和移除进行了特殊处理
        (a b) [c d e  ] (f g)  ==>  [i ... e1] (i = 2, e1 = 4)
                ||
                ||
                ||/
        (a b) [e c d h] (f g)  ==>  [i ... e2] (i = 2, e1 = 5)
        */

        else {
            const s1 = i; // 记录开始比对的索引
            const s2 = i; // 记录开始比对的索引

            const toBePatched = e2 - s2 + 1  // 倒序插入的个数
            // 新的(c2)里面的元素在老的(c1)中的索引，为0代表该节点需要创建
            const newIndexToOldIndexMap = new Array(toBePatched).fill(0);  // [0,0,0,0]

            // 做一个映射表用于快速查找，看老的是否在新的中仍有，没有就删除，有的话就更新
            const keyToNewIndexMap: Map<PropertyKey, number> = new Map()
            for (let i = s2; i <= e2; i++) {
                const nextChild = (c2[i] = normalizeVNode(c2[i]));
                if (nextChild.key != null) {
                    keyToNewIndexMap.set(nextChild.key, i);
                }
            }

            // 首先处理老的，
            // 如果老的里面在新的有，则复用真实dom(新vnode指向老vnode对应的真实dom)，同时记录新的vnode在老的中的index
            // 否则删除老的真实dom
            for (let i = s1; i <= e1; i++) {
                const preChild = c1[i];
                let newIndex;
                if (preChild.key != null) {
                    newIndex = keyToNewIndexMap.get(preChild.key);
                }

                // 如果新的里面找不到，则说明老的有的要删除
                if (newIndex == undefined) {
                    unmount(preChild, parentComponent);
                }
                // 否则，就进行dom复用，patch中会比较复用dom节点的差异，更新属性并递归更新儿子
                else {
                    newIndexToOldIndexMap[newIndex - s2] = i + 1; // i + 1是为了保证不与0冲突
                    patch(preChild, c2[newIndex], el);  // 复用
                }
            }

            // 此时新的vnodes中，除了新出现的vnode(待创建dom)，其他的vnode都指向了老的vnode对应的dom
            // 即此时场上存在的dom都同时被新vnode和老vnode指向了
            // 但由于这些dom顺序仍为老顺序，所以需要进行顺序调整，保证dom顺序为新的顺序
            // 为了最大程度减少移动次数，我们获取新的dom在老的dom中的index的最长递增子序列
            // 例如：[c d e  ] anchor ==> [e c d h] anchor  (本例下标从1开始)
            // 此时c d的顺序是不用调整的，即最长的为 c d，我们只需要将e对应的dom插入到c对应的dom
            // newIndexToOldIndexMap为 [3(e在老的index为3), 1, 2, 0(0代表h是新建节点)]
            // 最长递增子序列为 1 2
            // 故increasingNewIndexSequence为 [2, 3] (存的是最长递增子序列在newIndexToOldIndexMap中对应的index)
            // 我们从后往前遍历
            // 如果遇到的是全新的vnode，我们就直接进行patch(null, newVnode, anchor)，在patch函数中会创建newVnode对应的真实dom并进行插入
            // 否则为复用的vnode，该vnode指向了 对应旧vnode指向的 dom，
            // 若该vnode属于最长序列，则无需调整其dom顺序，否则便需要进行dom顺序的调整
            // ① 首先我们设置一个j = increasingNewIndexSequence.length - 1，此时j肯定是对应的最右边的vnode，同时倒序遍历[e c d h]
            // ② 这里我们先遇到了h，由于在newIndexToOldIndexMap中h对应的为0，即其为全新vnode，我们直接patch(null, h, anchor)
            // ③ 接着是d，d在newIndexToOldIndexMap中的index为3，而increasingNewIndexSequence[j]中的值也为3，说明d的属于最长序列的一员，故其不用移动，我们跳过并将j--
            // ④ 接着是c，同d
            // ⑤ 最后是e，c在newIndexToOldIndexMap中的index为1，而此时j变为了-1，即我们已经遍历完了所有存在于最长序列中的vnode、e不属于最长序列，
            //   因此我们需要对新e对应的dom进行移动，即将旧e对应的dom(此时新e也指向了该dom)插入到c对应的dom前 hostInsert(e, parent, c)

            // 获取新的vnode在老的中的index的最长递增子序列在newIndexToOldIndexMap中对应的下标
            // 被包含在最长递增子序列中的vnode对应的真实dom相对顺序不用动
            const increasingNewIndexSequence = getSequence(newIndexToOldIndexMap)

            // 新的节点倒序插入
            // (insert(child, parent, anchor)代表的是在anchor之前插入，所以我们要倒序插入，保证有anchor)

            // [c d e  ] anchor ==> [e c d h] anchor
            // 此时dom指向如下(显然dom_e的顺序是不符合新的顺序)
            // c        d      e
            // |        |      |
            // dom_c  dom_d  dom_e
            //    \     \      |
            //     \     \     |
            //      \     \    |
            // e     c     d   |   h
            // |               |
            //  ———————————————
            // newIndexToOldIndexMap: [3, 1, 2, 0]
            // increasingNewIndexSequence: [2, 3](下标) ==> [1, 2](在newIndexToOldIndexMap中的值)
            // 记住，此时我们是对真实dom的顺序调整，因为上面进行dom复用后，虽然新的vnode指向了复用的dom，但是dom顺序仍旧是原来的顺序
            let j = increasingNewIndexSequence.length - 1;
            for (let i = toBePatched - 1; i >= 0; i--) {
                const nextIndex = s2 + i;
                const nextChild = c2[nextIndex]
                const anchor = c2[nextIndex + 1]?.el;

                if (newIndexToOldIndexMap[i] === 0) {   // (1) 首先是h，此时进入if，代表h是新创建的
                    patch(null, nextChild, el, anchor);
                }
                else {
                    if (j < 0 || i !== increasingNewIndexSequence[j]) {
                        // (3) e的时候j已经减到了-1，代表e不属于最长序列，需要进行移动，所以需要插入到c前面
                        // 此时nextChild.el为e对应的dom_e，anchor为a对应的dom_a，即将上面的图变为下面的
                        //  ————————————————————————
                        //  |                       |
                        //  |      c        d      e
                        //  |      |        |  
                        // dom_e  dom_c  dom_d    dom_h(新建的dom_h)
                        //  |      |       |       |
                        //  |      |       |       |
                        //  e      c       d       h
                        // 结束后旧的vnode便会被回收，对应的指向也会回收，我们便成功获取到了新的vnode及其顺序对应的dom
                        hostInsert(nextChild.el, el, anchor);
                    } else {
                        j--;                             // (2) c和d都属于最长序列的元素，所以对应j--
                    }
                }
            }
        }
    }

    /**
     * dynamicChildren 比对
     */
    const patchBlockChildren = (oldChildren, newChildren, fallbackContainer, parentComponent) => {
        for (let i = 0; i < newChildren.length; i++) {
            patch(oldChildren[i], newChildren[i], fallbackContainer, null, parentComponent);
        }
    }

    // 比对children进行diff
    // 进入该函数时，n1和n2的key与type一定是相同的
    const patchChildren = (n1, n2, container, anchor, parentComponent) => {
        const c1 = n1.children;
        const prevShapeFlag = n1 ? n1.shapeFlag : 0  // 拿到先前的类型
        const c2 = n2.children;
        const { shapeFlag } = n2

        if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
            // 新children是文本

            // 如果旧的是数组，则卸载旧的
            if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                unmountChildren(c1, parentComponent);
            }
            // 否则直接文本赋值(如果旧的是文本则会进行覆盖)
            if (c1 !== c2) {
                hostSetElementText(container, c2);
            }
        } else {
            if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                // 旧的是数组，新的是数组
                if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                    // 全量diff算法，两数组进行比对
                    patchKeyedChildren(c1, c2, container, anchor, parentComponent);
                }
                // 旧的是数组，新的不是数组也不是文本，直接卸载旧的
                else {
                    unmountChildren(c1, parentComponent);
                }
            } else {
                // 旧的不是数组

                // 如果旧的是文本，先清空
                if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
                    hostSetElementText(container, '')
                }
                // 新的是数组，进行挂载
                if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
                    mountChildren(c2, container, anchor, parentComponent);
                }
            }
        }
    }

    // 进入该函数时，n1和n2的key与type一定是相同的
    // 1. 比较元素的差异，尽可能复用dom元素
    // 2. 比较属性和元素的子节点
    const patchElement = (n1, n2, parentComponent) => {
        let el = (n2.el = n1.el);  // dom 复用
        let { patchFlag, dynamicChildren } = n2;  // 用于模板编译-靶向更新

        let oldProps = n1.props || {};
        let newProps = n2.props || {};

        if (dynamicChildren) {
            // 存在 dynamicChildren(模板编译-靶向更新，见compiler-improve.html)
            patchBlockChildren(n1.dynamicChildren!, dynamicChildren, el, parentComponent);
        } else {
            // 直接比对子节点(第三个参数传的是el而不是container)
            patchChildren(n1, n2, el, null, parentComponent);
        }

        if (patchFlag) {
            // 有 patchFlag, 就根据其进行比对

            // 如果是比对全部的 props, 则依旧全量比对 patchProps
            if (patchFlag & PatchFlags.FULL_PROPS) {
                patchProps(oldProps, newProps, el);
            } else {
                // class 是响应式的
                // <span :class="item"></span>
                if (patchFlag & PatchFlags.CLASS) {
                    if (oldProps.class !== newProps.class) {
                        hostPatchProp(el, 'class', null, newProps.class);
                    }
                }
                // style 是响应式的
                // <span :style="item"></span>
                if (patchFlag & PatchFlags.STYLE) {
                    hostPatchProp(el, 'style', oldProps.style, newProps.style)
                };
                // 其他属性是响应式的
                if (patchFlag & PatchFlags.PROPS) {
                    const propsToUpdate = n2.dynamicProps!;
                    for (let i = 0; i < propsToUpdate.length; i++) {
                        const key = propsToUpdate[i];
                        const prev = oldProps[key];
                        const next = newProps[key];
                        // #1471 force patch value
                        if (next !== prev || key === 'value') {
                            hostPatchProp(el, key, prev, next);
                        }
                    }
                }
            }
            // 文本是响应式的
            // <span>{{ name }}</span>
            if (patchFlag & PatchFlags.TEXT) {
                if (n1.children !== n2.children) {
                    hostSetElementText(el, n2.children as string)
                }
            }
        } else {
            // 直接全量比对props
            patchProps(oldProps, newProps, el);
        }
    }

    const patch = (n1, n2, container, anchor = null, parentComponent = null) => {
        if (n1 === n2) {
            return
        }

        if (n1 && !isSameVNodeType(n1, n2)) {
            // 如果类型不同，则卸载旧节点
            unmount(n1, parentComponent);
            // n1 赋为null，走新的渲染逻辑
            n1 = null;
        }

        const { type, shapeFlag, ref } = n2;
        switch (type) {
            // 文本节点
            // 例如 <div>hello</div> 中的 hello
            case Text:
                processText(n1, n2, container, anchor);
                break;
            case Comment:
                processCommentNode(n1, n2, container, anchor);
                break;
            case Fragment:
                processFragment(n1, n2, container, anchor, parentComponent);
                break;
            default:
                if (shapeFlag & ShapeFlags.ELEMENT) {
                    processElement(n1, n2, container, anchor, parentComponent);
                } else if (shapeFlag & ShapeFlags.TELEPORT) {
                    type.process(
                        n1,
                        n2,
                        container,
                        anchor,
                        parentComponent,
                        internals
                    )
                } else if (shapeFlag & ShapeFlags.COMPONENT) {
                    // 对组件处理
                    processComponent(n1, n2, container, anchor, parentComponent);
                }

                break;
        }

        const setRef = (rawRef, vnode) => {
            let value = vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT
                ? vnode.component.exposed || vnode.component.proxy
                : vnode.el;
            if (isRef(rawRef)) {
                rawRef.value = value;
            }
        }
        // 设置ref 见index.html下ref原理相关代码
        // 此处为简易模拟
        if (ref != null) {
            setRef(ref, n2);
        }
    }

    const unmount = (vnode, parentComponent) => {
        const { shapeFlag, transition, el } = vnode;

        if (shapeFlag & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE) {
            parentComponent!.ctx.deactivate(vnode);
            return
        }

        if (vnode.type === Fragment) {
            unmountChildren(vnode.children, parentComponent);
        } else if (shapeFlag & ShapeFlags.TELEPORT) {
            // TELEPORT组件卸载则调用其内部的remove函数
            vnode.type.remove(
                vnode,
                internals
            )
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
            const { bum, um } = vnode.component;

            // 执行beforeUnmount钩子
            if (bum) {
                invokeArrayFns(bum);
            }

            // 组件的卸载是删除subTree
            unmount(vnode.component.subTree, parentComponent);

            // 执行Unmounted钩子
            if (um) {
                invokeArrayFns(um);
            }
        } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
            // 当类型为ARRAY_CHILDREN且children中包含Teleport组件的时候，
            // 如果不通过这种方式进行移除，会导致Teleport内部的组件无法被正常卸载
            unmountChildren(vnode.children, parentComponent);
        } else {
            const performRemove = () => {
                hostRemove(el!)
                if (transition && transition.afterLeave) {
                    transition.afterLeave()
                }
            }
            if (transition) {
                transition.leave(el, performRemove);
            } else {
                performRemove();
            }
        }
    }

    // 将组件或者dom元素移动到指定位置
    const move = (vnode, container, anchor) => {
        const { el, type, children, shapeFlag } = vnode

        // 如果是移动组件类型的话，就移动其subTree
        if (shapeFlag & ShapeFlags.COMPONENT) {
            move(vnode.component!.subTree, container, anchor)
            return
        }

        // 如果是移动Teleport组件类型的话，就调用Teleport的move
        if (shapeFlag & ShapeFlags.TELEPORT) {
            type.move(vnode, container, anchor, internals)
            return
        }

        if (type === Fragment) {
            hostInsert(el!, container, anchor)
            for (let i = 0; i < children.length; i++) {
                move(children[i], container, anchor)
            }
            hostInsert(vnode.anchor!, container, anchor)
            return
        }

        // 到这里就是单个的dom元素，直接进行移动，其实就是将dom元素插入到新的container中
        hostInsert(el!, container, anchor);
    }

    // Teleport.process传参
    const internals = {
        p: patch,
        um: unmount,
        m: move,
        // r: remove,
        mt: mountComponent,
        mc: mountChildren,
        pc: patchChildren,
        // n: getNextHostNode,
        o: options,
    }

    // 将虚拟节点变为真实节点进行渲染
    const render = (vnode, container) => {
        console.log(vnode, container);

        // 当vnode为null时，表示需要卸载组件
        if (vnode == null) {
            if (container._vnode) {
                // 如果vnode为null，说明需要卸载组件
                unmount(container._vnode, null);
            }
        }
        else {
            patch(
                container._vnode || null,  // 多次渲染时，n1为上一次的虚拟节点
                vnode,
                container
            );
        }

        container._vnode = vnode
    }

    return {
        render,
    };
}

function getSequence(arr: number[]): number[] {
    const p = arr.slice();
    const result = [0];  // 存的的是index
    let i, j, left, right, mid;
    const len = arr.length;
    for (i = 0; i < len; i++) {
        const arrI = arr[i];
        if (arrI !== 0) {   // 排除为0的情况(为0说明需要创建节点)
            j = result[result.length - 1];
            if (arr[j] < arrI) {
                p[i] = j;
                result.push(i);
                continue;
            }

            // 二分查找比arrI大的最小值的index
            left = 0;
            right = result.length - 1;
            while (left < right) {
                mid = (left + right) >> 1;
                if (arr[result[mid]] < arrI) {
                    left = mid + 1;
                } else {
                    right = mid;
                }
            }

            if (arrI < arr[result[left]]) {
                if (left > 0) {
                    p[i] = result[left - 1];
                }
                result[left] = i;
            }
        }
    }
    // 创建一个前驱节点，倒叙追溯，
    left = result.length;
    right = result[left - 1];
    while (left-- > 0) {
        result[left] = right;
        right = p[right];
    }
    return result;
}

