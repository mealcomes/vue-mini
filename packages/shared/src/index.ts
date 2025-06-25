export * from './shapeFlags'
export * from './normalizeProp'

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

export const isOn = (key: string): boolean =>
    key.charCodeAt(0) === 111 /* o */ &&
    key.charCodeAt(1) === 110 /* n */ &&
    (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97)

const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (value, key) => hasOwnProperty.call(value, key)


const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
    const cache: Record<string, string> = Object.create(null)
    return ((str: string) => {
        const hit = cache[str]
        return hit || (cache[str] = fn(str))
    }) as T
}
const hyphenateRE = /\B([A-Z])/g
export const hyphenate: (str: string) => string = cacheStringFunction(
    (str: string) => str.replace(hyphenateRE, '-$1').toLowerCase(),
)