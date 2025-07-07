import { isArray, isFunction, isObject, isString } from "."

const isRef = (val: any): val is { value: unknown } => {
    return !!(val && val['__v_isRef'] === true)
}

export const toDisplayString = (val: unknown): string => {
    return isString(val)
        ? val
        : val == null
            ? ''
            : isArray(val) ||
                (isObject(val) &&
                    (val.toString === Object.prototype.toString || !isFunction(val.toString)))
                ? isRef(val)
                    ? toDisplayString(val.value)
                    : JSON.stringify(val)
                : String(val);
}
