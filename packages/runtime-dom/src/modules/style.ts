
export function patchStyle(
  el,
  prev,
  next,
): void {
  let style = el.style;
  if (next == null) {
    // 如果没有新的样式，则清空样式
    el.removeAttribute('style');
    return;
  }

  if (prev) {
    // prev 是对象类型的样式
    if (typeof prev !== 'string') {
      for (let key in prev) {
        // 如果以前的属性现在没有，则需要删除掉
        if (next[key] == null) {
          style[key] = '';
        }
      }
    }
    // prev 是string类型的样式
    else {
      for (const prevStyle of prev.split(';')) {
        const key = prevStyle.slice(0, prevStyle.indexOf(':')).trim()
        if (next[key] == null) {
          style[key] = '';
        }
      }
    }
  }
  for (let key in next) {
    style[key] = next[key];  // 新样式全部生效
  }

}

