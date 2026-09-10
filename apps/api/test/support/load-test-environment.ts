import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

loadDotenv({
  path: [resolve(__dirname, '../../.env'), resolve(__dirname, '../../../../.env')],
  quiet: true,
});

if (!process.env.MONGODB_TEST_URI) {
  process.env.MONGODB_TEST_URI =
    'mongodb://localhost:27017/equipment_ledger_test?replicaSet=rs0&directConnection=true';
}
