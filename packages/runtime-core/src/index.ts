// 不关心api的实现细节，可以跨平台
// 例如runtime-dom是为了浏览器环境而设计的渲染器

export * from './renderer'
export * from './h'
export * from './vnode'
export * from '@vue/reactivity'
export * from './apiLifecycle'
export * from './component'
export * from './apiInject'
export * from './components/Teleport'
export * from './components/BaseTransition'