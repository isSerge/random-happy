import dotenv from 'dotenv';
import { z } from 'zod';

import addresses from './deployed_addresses.json';

dotenv.config();

const AddressesSchema = z.object({
  DRAND_ORACLE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  SEQUENCER_ORACLE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  RANDOMNESS_ORACLE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

const addressesConfig = AddressesSchema.parse(addresses);

const EnvConfigSchema = z.object({
  PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid private key"),
  DRAND_HTTP_URL: z.string().url(),
});

const envConfig = EnvConfigSchema.parse(process.env);

export const config = {
  ...addressesConfig,
  ...envConfig,
};
