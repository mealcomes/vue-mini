
export function patchClass(
    el,
    value,
): void {
    if (value === null) {
        el.removeAttribute("class");
    }
    else {
        el.className = value;
    }
}
