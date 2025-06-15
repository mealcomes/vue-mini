
// 主要是对节点元素的增删改查
export const nodeOps = {
    // 插入dom元素
    insert: (child, parent, anchor) => {
        // 将child插入在parent中的anchor元素前面
        // 当anchor为空时，等价于parent.appendChild(child)
        parent.insertBefore(child, anchor || null)
    },

    // 移除dom元素
    remove: (child) => {
        const parent = child.parentNode
        if (parent) {
            parent && parent.removeChild(child)
        }
    },

    createElement: (type) => {
        return document.createElement(type);
    },

    createText: text => document.createTextNode(text),

    createComment: text => document.createComment(text),

    setText: (node, text) => {
        node.nodeValue = text;
    },

    setElementText: (el, text) => {
        el.textContent = text;
    },

    parentNode: node => node.parentNode,

    nextSibling: node => node.nextSibling,

    querySelector: selector => document.querySelector(selector),

    setScopeId(el, id) {
        el.setAttribute(id, '')
    },
}