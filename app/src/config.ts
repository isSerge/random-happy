import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  RPC_URL: z.string().url(),
  PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid private key"),
  DRAND_ORACLE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  SEQUENCER_ORACLE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  RANDOMNESS_ORACLE_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

export const config = ConfigSchema.parse(process.env);
