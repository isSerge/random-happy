import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  RPC_URL: z.string().url(),
  PRIVATE_KEY: z.string().min(1),
  DRAND_ORACLE_ADDRESS: z.string().min(1),
  SEQUENCER_ORACLE_ADDRESS: z.string().min(1),
  RANDOMNESS_ORACLE_ADDRESS: z.string().min(1),
});

export const config = ConfigSchema.parse(process.env);
