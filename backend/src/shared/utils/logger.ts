import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    process.env.NODE_ENV === 'production'
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, stack }) => {
            return `${timestamp} ${level}: ${stack ?? message}`;
          }),
        ),
  ),
  transports: [new winston.transports.Console()],
});

/** Stream adapter for morgan — pipes HTTP request logs through Winston */
export const morganStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export { logger };
