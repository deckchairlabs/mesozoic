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

  test(message: string, condition: boolean) {
    this.debug(
      sprintf(
        "%s = %s",
        condition ? crayon.green("true") : crayon.red("false"),
        message,
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

  copied(from: ISource, source: ISource) {
    this.info(
      sprintf(
        crayon.green("Copied: %s -> %s"),
        from.path(),
        source.path(),
      ),
    );
  }

  compiled(source: ISource) {
    this.info(
      sprintf(
        crayon.green("Compiled: %s"),
        source.path(),
      ),
    );
  }

  vendored(sources: SourceFileBag) {
    for (const source of sources.values()) {
      this.info(
        sprintf(
          crayon.green("Vendored: %s"),
          source.path(),
        ),
      );
    }
  }
}
