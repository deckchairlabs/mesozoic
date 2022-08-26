import { BuildContext } from "./builder.ts";
import { crayon, log, sprintf } from "./deps.ts";
import { ISource } from "./source.ts";
import { SourceFileBag } from "./sourceFileBag.ts";

export class MesozoicLogger extends log.Logger {
  constructor(levelName: log.LevelName) {
    super("mesozoic", levelName, {
      handlers: [
        new log.handlers.ConsoleHandler("DEBUG", {
          formatter: `${
            crayon.bold.blue("[{loggerName}]")
          } - {levelName} {msg}`,
        }),
      ],
    });
  }

  context(context: BuildContext) {
    this.debug(
      sprintf(
        "%s %s",
        crayon.bold.yellow("Context"),
        JSON.stringify(context, null, 2),
      ),
    );
  }

  cleaning(path: string) {
    this.info(
      sprintf(
        "%s %s",
        crayon.green("Cleaning"),
        path,
      ),
    );
  }

  test(message: string, condition: boolean) {
    this.info(
      sprintf(
        "%s %s = %s",
        crayon.green("Test"),
        message,
        condition ? crayon.green("true") : crayon.red("false"),
      ),
    );
    return condition;
  }

  added(source: ISource) {
    this.debug(sprintf(crayon.green("Add: %s"), source.path()));
  }

  resolved(source: ISource) {
    this.debug(sprintf(crayon.green("Resolved: %s"), source.path()));
  }

  copy(from: ISource, source: ISource, startTime: number) {
    const endTime = performance.now();
    this.info(
      sprintf(
        "%s %s %s %s %s",
        crayon.green("Copied"),
        from.relativePath(),
        crayon.bold.blue("to"),
        source.relativePath(),
        this.#formatMilliseconds(endTime - startTime),
      ),
    );
  }

  copied(sources: SourceFileBag, startTime: number) {
    const endTime = performance.now();
    this.info(
      sprintf(
        "%s %d files %s",
        crayon.green("Copied"),
        sources.size,
        this.#formatMilliseconds(endTime - startTime),
      ),
    );
  }

  compiled(source: ISource, startTime: number) {
    const endTime = performance.now();
    this.info(
      sprintf(
        "%s %s %s",
        crayon.green("Compiled"),
        source.relativePath(),
        this.#formatMilliseconds(endTime - startTime),
      ),
    );
  }

  vendored(sources: SourceFileBag, startTime: number) {
    const endTime = performance.now();
    for (const source of sources.values()) {
      this.info(
        sprintf(
          "%s %s",
          crayon.green("Vendor"),
          source.relativePath(),
        ),
      );
    }

    this.info(sprintf(
      "%s %s",
      crayon.green("Vendored"),
      this.#formatMilliseconds(endTime - startTime),
    ));
  }

  #formatMilliseconds(value: number) {
    return crayon.dim(
      `(${String(Math.round(value))}ms)`,
    );
  }
}
