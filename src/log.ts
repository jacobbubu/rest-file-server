import winston = require('winston')
import { format, createLogger, transports } from 'winston'

const logger = createLogger({
  level: winston.level,
  format: format.combine(
    format.splat(),
    format.colorize({ level: true }),
    format.align(),
    format.printf((info) => `${info.level}: ${info.message}`)
  ),
  transports: [new transports.Console()],
})

export default logger

export function setLogLevel(level: string) {
  logger.transports[0].level = level
}
