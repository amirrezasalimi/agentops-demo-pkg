import winston, { transports, format } from 'winston';

const isBrowser = typeof window !== 'undefined';

const logger = winston.createLogger({
  level: 'info',
  format: format.combine(format.timestamp(), format.json()),
  transports: [],
});

if (isBrowser) {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    })
  );
} else {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    })
  );

  logger.add(
    new transports.File({
      filename: 'logs/app.log',
      level: 'info',
    })
  );
}

export default logger;
