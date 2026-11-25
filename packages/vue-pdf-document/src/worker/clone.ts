import { isRef, toRaw } from 'vue'

const PASS_THROUGH = [Date, RegExp, ArrayBuffer, Blob, Error]

const fail = (path: string, what: string): never => {
  throw new Error(`[vue-pdf-document] Prop "${path}" can't be sent to a worker: ${what} can't be cloned.`)
}

const join = (path: string, key: string): string => (path ? `${path}.${key}` : key)

const walk = (input: unknown, path: string, seen: WeakMap<object, unknown>): unknown => {
  const value = toRaw(isRef(input) ? input.value : input)
  if (typeof value === 'function') return fail(path, 'a function')
  if (typeof value === 'symbol') return fail(path, 'a symbol')
  if (typeof value !== 'object' || value === null) return value
  if (typeof Node !== 'undefined' && value instanceof Node) return fail(path, 'a DOM node')
  if (seen.has(value)) return seen.get(value)
  if (ArrayBuffer.isView(value) || PASS_THROUGH.some((type) => value instanceof type)) return value

  if (Array.isArray(value)) {
    const copy: unknown[] = []
    seen.set(value, copy)
    value.forEach((item, index) => copy.push(walk(item, `${path}[${index}]`, seen)))
    return copy
  }
  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>()
    seen.set(value, copy)
    for (const [key, item] of value) copy.set(walk(key, path, seen), walk(item, `${path}[${String(key)}]`, seen))
    return copy
  }
  if (value instanceof Set) {
    const copy = new Set<unknown>()
    seen.set(value, copy)
    for (const item of value) copy.add(walk(item, path, seen))
    return copy
  }
  const copy: Record<string, unknown> = {}
  seen.set(value, copy)
  for (const [key, item] of Object.entries(value)) copy[key] = walk(item, join(path, key), seen)
  return copy
}

/**
 * Returns a plain copy of `props` that `postMessage` can clone: refs and reactive proxies are
 * unwrapped at any depth. Throws an error naming the path of the first function, symbol or
 * DOM node, instead of the browser's generic `DataCloneError`.
 */
export const toCloneable = (props: unknown): unknown => walk(props, '', new WeakMap())
