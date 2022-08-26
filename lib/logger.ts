import { crayon, log, sprintf } from "./deps.ts";
import { SourceFile } from "./sourceFile.ts";
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

  added(source: SourceFile) {
    this.debug(sprintf(crayon.green("Add: %s"), source.path()));
  }

  resolved(source: SourceFile) {
    this.debug(sprintf(crayon.green("Resolved: %s"), source.path()));
  }

  copied(from: SourceFile, source: SourceFile) {
    this.info(
      sprintf(
        crayon.green("Copied: %s -> %s"),
        from.path(),
        source.path(),
      ),
    );
  }

  compiled(source: SourceFile) {
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
