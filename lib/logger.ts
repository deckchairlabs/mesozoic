import { crayon, log, sprintf } from "./deps.ts";

function gradient(string: string) {
  const chars: string[] = string.split("");

  for (const [index, char] of chars.entries()) {
    chars[index] = crayon.hsl(7 * index, 100, 50)(char);
  }

  return chars.join("");
}

function formatLevel(level: log.LevelName) {
  switch (level) {
    case "INFO":
      return crayon.bold.blue(level);

    case "DEBUG":
      return crayon.bold.magenta(level);

    case "WARNING":
      return crayon.bold.yellow(level);

    case "ERROR":
      return crayon.bold.red(level);

    case "CRITICAL":
      return crayon.bgRed.black.bold(level);

    default:
      return level;
  }
}

export type LoggerImpl = {
  info(message: string): string;
  debug(message: string): string;
  warning(message: string): string;
  error(message: string): string;
  critical(message: string): string;
  success(message: string): string;
};

export class Logger implements LoggerImpl {
  #logger: log.Logger;

  /**
   * @param levelName
   * @param name
   */
  constructor(levelName: log.LevelName, name: string) {
    const loggerName = gradient(`[${name}]`);

    this.#logger = new log.Logger(name, levelName, {
      handlers: [
        new log.handlers.ConsoleHandler("DEBUG", {
          formatter(record) {
            const level = formatLevel(record.levelName as log.LevelName);
            return sprintf(
              "%s - %s %s",
              loggerName,
              level,
              record.msg,
            );
          },
        }),
      ],
    });
  }

  info(message: string): string {
    return this.#logger.info(message);
  }

  debug(message: string): string {
    return this.#logger.debug(message);
  }

  warning(message: string): string {
    return this.#logger.warning(message);
  }

  error(message: string): string {
    return this.#logger.error(message);
  }

  critical(message: string): string {
    return this.#logger.critical(message);
  }

  success(message: string) {
    return this.info(crayon.green(`✔ ${message}`));
  }
}
