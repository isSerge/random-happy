import { HttpCachingChain, HttpChainClient, fetchBeacon, watch } from 'drand-client';
import { config } from './config';
import { logger } from './logger';

/**
 * Fetches randomness from the drand service and yields new randomness beacons.
 * @param abortController The abort controller to cancel the fetch request
 * @returns An async generator that yields randomness beacons
 */
export async function* fetchDrandRandomness(abortController: AbortController) {
  const options = {
    disableBeaconVerification: false,
    noCache: false,
  };

  const chain = new HttpCachingChain(config.DRAND_HTTP_URL, options);
  const drandClient = new HttpChainClient(chain, options);

  // Fetch the latest randomness
  const latestBeacon = await fetchBeacon(drandClient);
  logger.info(`Drand service: Fetched randomness: ${latestBeacon.randomness} for round: ${latestBeacon.round}`);
  yield latestBeacon;

  // Watch for new randomness beacons
  for await (const beacon of watch(drandClient, abortController)) {
    logger.info(`Drand service: Fetched randomness: ${beacon.randomness} for round: ${beacon.round}`);
    yield beacon;
  }
}
