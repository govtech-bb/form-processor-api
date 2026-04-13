import * as path from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Signer } from '@aws-sdk/rds-signer';

// Load environment variables
config();

const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = parseInt(process.env.DB_PORT, 10) || 5432;
const isLocalDatabase = dbHost === 'localhost' || dbHost === '127.0.0.1';

/**
 * Generate a short-lived IAM authentication token for RDS.
 * The token is valid for 15 minutes and is generated using the
 * App Runner instance role's credentials via SigV4 signing.
 */
async function generateRdsAuthToken(username: string): Promise<string> {
  const signer = new Signer({
    hostname: dbHost,
    port: dbPort,
    region: process.env.AWS_REGION || 'us-east-1',
    username,
  });
  const token = await signer.getAuthToken();
  console.log('DB auth: generated IAM auth token');
  return token;
}

/**
 * Creates a DataSource using IAM authentication when DB_IAM_AUTH is set,
 * or falls back to DB_PASSWORD / DB_USERNAME env vars for local dev.
 *
 * IAM auth tokens expire after 15 minutes but PostgreSQL only validates
 * the token at connection time — existing connections remain active.
 */
export async function createDataSource(): Promise<DataSource> {
  const username = process.env.DB_IAM_USER || 'iam_db_user';
  const token = await generateRdsAuthToken(username);

  return new DataSource({
    type: 'postgres',
    host: dbHost,
    port: dbPort,
    username,
    password: token,
    database: process.env.DB_DATABASE || 'forms_processor_db',
    entities: [path.join(__dirname, './entities/*.entity{.ts,.js}')],
    migrations: [path.join(__dirname, './migrations/*{.ts,.js}')],
    synchronize: false,
    logging: process.env.DB_LOGGING === 'true',
    ssl: { rejectUnauthorized: false },
  });
}

// Keep backward-compatible synchronous export for migration CLI
export const dataSource = new DataSource({
  type: 'postgres',
  host: dbHost,
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'forms_processor_db',
  entities: [path.join(__dirname, './entities/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, './migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  ssl: isLocalDatabase
    ? false
    : {
        rejectUnauthorized: false,
      },
});
