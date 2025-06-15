export * from './shapeFlags'

export function isObject(value: unknown) {
    return typeof value === 'object' && value !== null;
}

export function isFunction(target: unknown) {
    return typeof target === 'function';
}

export function isString(target: unknown): target is string {
    return typeof target === 'string';
}

export const isArray: typeof Array.isArray = Array.isArray
export const isSet = (val: unknown): val is Set<any> =>
    Object.prototype.toString.call(val) === '[object Set]'
export const isMap = (val: unknown): val is Map<any, any> =>
    Object.prototype.toString.call(val) === '[object Map]'
export const isPlainObject = (val: unknown): val is object =>
    Object.prototype.toString.call(val) === '[object Object]'
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'