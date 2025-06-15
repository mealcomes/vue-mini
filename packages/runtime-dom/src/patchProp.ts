import { patchClass } from './modules/class'
import { patchStyle } from './modules/style'
import { patchAttr } from './modules/attrs'
import { patchEvent } from './modules/events'


// 对节点元素的属性操作 (class,style,event,普通属性)

// 存在diff
export const patchProp = (el, key, prevValue, nextValue) => {
    if (key === 'class') {
        patchClass(el, nextValue);
    }
    else if (key === 'style') {
        patchStyle(el, prevValue, nextValue);
    }
    else if (/^on[^a-z]/.test(key)) {
        // 添加事件监听器
        patchEvent(el, key, nextValue);
    }
    else {
        // 普通属性
        patchAttr(el, key, nextValue)
    }
}