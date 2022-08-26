import { extname, sprintf } from "./deps.ts";

export function getUniquePath(
  path: string,
  uniqueSet: Set<string>,
): string {
  let count = 2;

  while (uniqueSet.has(path.toLowerCase())) {
    path = pathWithStemSuffix(path, sprintf("_%d", count));
    count += 1;
  }

  return path;
}

export function pathWithStemSuffix(path: string, suffix: string) {
  const extension = extname(path);

  if (extension) {
    return path.replace(extension, sprintf(`%s%s`, suffix, extension));
  }

  return sprintf("%s%s", path, suffix);
}
