// deno-lint-ignore no-explicit-any
export function wrapFn<T extends Array<any>, U>(
  fn: (...args: T) => U,
  before?: (...args: T) => void,
  after?: (result: U, ...args: T) => void,
) {
  return (...args: T): U => {
    before && before(...args);
    const result = fn(...args);
    after && after(result, ...args);
    return result;
  };
}
