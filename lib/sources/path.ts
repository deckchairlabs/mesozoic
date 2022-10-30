import { dirname, fromFileUrl, isAbsolute, join, toFileUrl } from "../deps.ts";

export class Path {
  #path: string;
  #root: string;

  constructor(path: string, root?: string) {
    path = path.startsWith("file:") ? fromFileUrl(path) : path;

    if (!root && !isAbsolute(path)) {
      throw new Error("path must be absolute if no root is provided.");
    }

    root = root?.startsWith("file:") ? fromFileUrl(root) : root;

    this.#root = root ?? dirname(path);
    this.#path = isAbsolute(path) ? path : join(this.#root, path);
  }

  path() {
    return this.#ensurePosix(this.#path);
  }

  relativePath() {
    return this.path().replace(this.root(), ".");
  }

  url() {
    return new URL(toFileUrl(this.path()));
  }

  root() {
    return this.#ensurePosix(this.#root);
  }

  #ensurePosix(path: string) {
    return path.replaceAll("\\", "/");
  }
}
