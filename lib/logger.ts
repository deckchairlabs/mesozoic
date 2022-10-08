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

export class Logger extends log.Logger {
  /**
   * @param levelName
   * @param name
   */
  constructor(levelName: log.LevelName, name: string) {
    const loggerName = gradient(`[${name}]`);

    super(name, levelName, {
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

  success(message: string) {
    return this.info(crayon.green(`✔ ${message}`));
  }
}
