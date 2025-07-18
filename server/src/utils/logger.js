import pino from "pino";
import pretty from "pino-pretty";

const isDev = process.env.NODE_ENV !== "production";

const stream = isDev
  ? pretty({
      colorize: true,
      translateTime: "yyyy-mm-dd HH:MM:ss",
      ignore: "pid,hostname",
    })
  : undefined;

const logger = pino(
  {
    level: "info",
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  stream
);

export default logger;
