import pino from 'pino';

export const logger = pino({
  name: 'midnight-service',
  level: process.env.LOG_LEVEL ?? 'info',
});
