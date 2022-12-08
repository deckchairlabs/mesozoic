export { copy, emptyDir, ensureDir, walk } from "https://deno.land/std@0.164.0/fs/mod.ts";
export { cache } from "https://deno.land/x/cache@0.2.13/mod.ts";
export { crayon } from "https://deno.land/x/crayon@3.3.2/mod.ts";
export * as log from "https://deno.land/std@0.164.0/log/mod.ts";
export { deepMerge } from "https://deno.land/std@0.164.0/collections/deep_merge.ts";
export {
  init as initModuleLexer,
  parse as parseModule,
} from "https://esm.sh/es-module-lexer@1.0.3/es-module-lexer.js";
export type { ImportSpecifier } from "https://esm.sh/v95/es-module-lexer@1.0.3/types/lexer.d.ts";
export {
  parse as parseImportMap,
  resolve as importMapResolve,
} from "https://esm.sh/@import-maps/resolve@1.0.1/resolve.js";

export { sprintf } from "https://deno.land/std@0.164.0/fmt/printf.ts";

export {
  basename,
  dirname,
  extname,
  fromFileUrl,
  globToRegExp,
  isAbsolute,
  join,
  normalize,
  relative,
  resolve,
  SEP,
  toFileUrl,
} from "https://deno.land/std@0.164.0/path/mod.ts";
