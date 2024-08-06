import { logger } from './logger';
import { config } from './config';

export function main() {
  logger.info(config);
}

main();
