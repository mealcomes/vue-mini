import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp';

import { createRenderer } from '@vue/runtime-core';

// 将节点操作和属性操作合并在一起
export const rendererOptions = Object.assign({ patchProp }, nodeOps);
let renderer;

function ensureRenderer() {
    return (
        renderer ||
        (renderer = createRenderer(rendererOptions))
    )
}

// 创建渲染器
export const render = (...args) => {
    ensureRenderer().render(...args);
}

export * from './components/Transition'
export * from '@vue/runtime-core';
