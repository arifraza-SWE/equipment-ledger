import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

export interface ApiEnvironment {
  mongoUri: string;
  port: number;
  webOrigin: string;
}

const REPO_ROOT_ENV = resolve(__dirname, '../../../../.env');

export function loadEnvironment(): ApiEnvironment {
  loadDotenv({ path: [resolve(process.cwd(), '.env'), REPO_ROOT_ENV], quiet: true });

  const mongoUri = requireVariable('MONGODB_URI');
  const port = Number.parseInt(process.env.API_PORT ?? '4000', 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`API_PORT must be a positive integer, got "${process.env.API_PORT}"`);
  }

  return {
    mongoUri,
    port,
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  };
}

export function requireVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Copy .env.example to .env at the repository root.`);
  }
  return value;
}
