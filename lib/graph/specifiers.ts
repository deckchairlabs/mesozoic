export function isRemoteSpecifier(specifier: string) {
  return [
    specifier.startsWith("http://"),
    specifier.startsWith("https://"),
  ].some((condition) => condition === true);
}

export function isRelativeSpecifier(specifier: string) {
  return [
    specifier.startsWith("./"),
    specifier.startsWith("../"),
  ].some((condition) => condition === true);
}

export function isLocalSpecifier(specifier: string) {
  return specifier.startsWith("file://");
}

export function isBareSpecifier(specifier: string) {
  return [
    isRelativeSpecifier(specifier),
    isRemoteSpecifier(specifier),
    isLocalSpecifier(specifier),
  ].every((condition) => condition === false);
}
