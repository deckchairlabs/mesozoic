export function isRemoteSpecifier(specifier: string | URL) {
  specifier = typeof specifier === "string" ? specifier : specifier.href;
  return specifier.startsWith("http");
}
