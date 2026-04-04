// ...existing code...
import winston from "winston";
import fs from "fs";
import path from "path";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ timestamp, level, message, stack }) => {
  const msg = stack ?? message;
  return `${timestamp} [${level}]: ${msg}`;
});

const level = process.env.NODE_ENV === "production" ? "info" : "debug";
const isServerless = process.env.VERCEL === "1" || process.env.VERCEL === "true";

const logger = winston.createLogger({
  level,
  format: combine(timestamp(), errors({ stack: true }), logFormat),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), errors({ stack: true }), logFormat),
    }),
  ],
  exitOnError: false,
});

// add file transports only for non-serverless production runtime
if (process.env.NODE_ENV === "production" && !isServerless) {
  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, "combined.log"),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    })
  );
}

// morgan compatible stream
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
// ...existing code...