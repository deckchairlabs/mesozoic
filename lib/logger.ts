import { crayon, log } from "./deps.ts";

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

  #formatMilliseconds(value: number) {
    return crayon.dim(
      `(${String(Math.round(value))}ms)`,
    );
  }
}
