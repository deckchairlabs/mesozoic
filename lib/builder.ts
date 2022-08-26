import {
  AbstractBuilder,
  BuildContext,
  BuildResult,
} from "./abstractBuilder.ts";
import { crayon, sprintf } from "./deps.ts";
import { MesozoicLogger } from "./logger.ts";
import { ISource } from "./source.ts";
import { SourceFileBag } from "./sourceFileBag.ts";

/**
 * A Builder with logging
 */
export class Builder extends AbstractBuilder {
  public logger: MesozoicLogger;

  constructor(context: BuildContext) {
    super(context);
    this.logger = new MesozoicLogger("DEBUG");
  }

  async build(sources: SourceFileBag): Promise<BuildResult> {
    this.logger.info("Building");
    const result = await super.build(sources);
    this.logger.info("✅ Build complete");

    return result;
  }

  async gatherSources(
    from: string = this.context.root,
  ): Promise<SourceFileBag> {
    this.logger.info(sprintf("Gathering sources from: %s", from));
    const sources = await super.gatherSources(from);
    this.logger.info("Gathered sources");

    return sources;
  }
  async cleanOutput() {
    this.logger.info(sprintf("Cleaning %s", this.context.output));
    await super.cleanOutput();
  }

  async vendorSources(sources: SourceFileBag) {
    this.logger.info(sprintf("Vendoring %d sources", sources.size));
    const vendored = await super.vendorSources(sources);
    this.logger.info(sprintf("Vendored %d dependencies", vendored.size));

    return vendored;
  }

  async copySources(
    sources: SourceFileBag,
    destination: string = this.context.output,
  ) {
    this.logger.info(sprintf("Copy %d sources", sources.size));
    const copied = await super.copySources(sources, destination);
    this.logger.info(sprintf("Copied %d sources", copied.size));

    return copied;
  }

  copySource(source: ISource, destination: string) {
    this.logger.info(
      sprintf("Copy %s -> %s", source.path(), destination),
    );
    return super.copySource(source, destination);
  }

  async compileSources(sources: SourceFileBag) {
    this.logger.info(sprintf("Compiling %d sources", sources.size));
    const compiled = await super.compileSources(sources);
    this.logger.info(sprintf("Compiled %d sources", compiled.size));

    return compiled;
  }

  async compileSource(source: ISource) {
    this.logger.info(sprintf("Compiling source: %s", source.path()));
    await super.compileSource(source);
    this.logger.info(sprintf("Compiled source: %s", source.path()));
    return source;
  }

  async buildModuleGraph(sources: SourceFileBag) {
    this.logger.info(
      sprintf("Building module graph for %d sources", sources.size),
    );
    const graph = await super.buildModuleGraph(sources);
    this.logger.info(sprintf("Built module graph"));

    return graph;
  }

  isEntrypoint(source: ISource, aliased = true): boolean {
    const value = super.isEntrypoint(source, aliased);
    this.logger.info(
      sprintf(
        "isEntrypoint: %s = %s",
        source.relativePath(),
        this.#formatBoolean(value),
      ),
    );
    return value;
  }

  isIgnored(source: ISource): boolean {
    const value = super.isIgnored(source);
    this.logger.info(
      sprintf(
        "isIgnored: %s = %s",
        source.relativePath(),
        this.#formatBoolean(value),
      ),
    );
    return value;
  }

  isCompilable(source: ISource): boolean {
    const value = super.isCompilable(source);
    this.logger.info(
      sprintf(
        "isCompilable: %s = %s",
        source.relativePath(),
        this.#formatBoolean(value),
      ),
    );
    return value;
  }

  isHashable(source: ISource): boolean {
    const value = super.isHashable(source);
    this.logger.info(
      sprintf(
        "isHashable: %s = %s",
        source.relativePath(),
        this.#formatBoolean(value),
      ),
    );
    return value;
  }

  isManifestExcluded(source: ISource): boolean {
    const value = super.isManifestExcluded(source);
    this.logger.info(
      sprintf(
        "isManifestExcluded: %s = %s",
        source.relativePath(),
        this.#formatBoolean(value),
      ),
    );
    return value;
  }

  #formatBoolean(value: boolean) {
    return value ? crayon.green("true") : crayon.red("false");
  }
}
