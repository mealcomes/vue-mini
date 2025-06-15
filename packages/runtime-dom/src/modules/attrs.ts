
export function patchAttr(
    el: Element,
    key: string,
    value: any,
): void {
    if (!value) {
        el.removeAttribute(key);
    }
    else {
        el.setAttribute(key, value);
    }
}
