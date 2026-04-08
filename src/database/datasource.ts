import * as path from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// Load environment variables
config();

const dbHost = process.env.DB_HOST || 'localhost';
const isLocalDatabase = dbHost === 'localhost' || dbHost === '127.0.0.1';

/**
 * Fetch the database password from Secrets Manager (RDS managed master password).
 * Used by App Runner where IAM auth tokens from assumed roles are not supported.
 */
async function fetchDbPassword(): Promise<{ username: string; password: string }> {
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    return {
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };
  }

  const client = new SecretsManagerClient({
    region: process.env.AWS_REGION || 'us-east-1',
  });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  const secret = JSON.parse(response.SecretString);
  console.log(`DB auth: fetched credentials from Secrets Manager`);
  return { username: secret.username, password: secret.password };
}

/**
 * Creates a DataSource with credentials from Secrets Manager when DB_SECRET_ARN
 * is set, or falls back to DB_PASSWORD / DB_USERNAME env vars for local dev.
 */
export async function createDataSource(): Promise<DataSource> {
  const { username, password } = await fetchDbPassword();

  return new DataSource({
    type: 'postgres',
    host: dbHost,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username,
    password,
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
