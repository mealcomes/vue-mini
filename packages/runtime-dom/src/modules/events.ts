
export function addEventListener(
  el: Element,
  event: string,
  handler: EventListener,
  options?: EventListenerOptions,
): void {
  el.addEventListener(event, handler, options)
}

export function removeEventListener(
  el: Element,
  event: string,
  handler: EventListener,
  options?: EventListenerOptions,
): void {
  el.removeEventListener(event, handler, options)
}

const veiKey: unique symbol = Symbol('_vei')

// onclick="fn1"   ===>   onClick="fn2"
// 通过 click="() => invoker.value()"，将invoker.value 由 fn1 ===> fn2
// 避免需要移除fn1再添加fn2，优化性能
function createInvoker(value) {
  const invoker = (e) => invoker.value(e);
  invoker.value = value;
  return invoker;
}

export function patchEvent(
  el,
  rawName: string,
  nextValue,
): void {
  const invokers = el[veiKey] || (el[veiKey] = {})
  const name = rawName.slice(2).toLocaleLowerCase();
  const existingInvoker = invokers[rawName];

  if (nextValue && existingInvoker) {
    // 事件换绑
    existingInvoker.value = nextValue;
  }
  else {
    if (nextValue) {
      // 以前没有事件，现在有
      const invoker = (invokers[rawName] = createInvoker(nextValue));
      addEventListener(el, name, invoker);
    }
    else if (existingInvoker) {
      // 现在没有事件，以前有事件
      removeEventListener(el, name, existingInvoker);
      invokers[rawName] = undefined;
    }
  }
}

