import * as path from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Signer } from '@aws-sdk/rds-signer';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

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
 * Fetch the database password from Secrets Manager (RDS managed master password).
 * Fallback path used during migration from Secrets Manager to IAM auth.
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
  console.log('DB auth: fetched credentials from Secrets Manager');
  return { username: secret.username, password: secret.password };
}

/**
 * Creates a DataSource using IAM authentication when DB_IAM_AUTH is set,
 * Secrets Manager when DB_SECRET_ARN is set, or falls back to env vars.
 */
export async function createDataSource(): Promise<DataSource> {
  let username: string;
  let password: string;

  if (process.env.DB_IAM_AUTH === 'true') {
    username = process.env.DB_IAM_USER || 'iam_db_user';
    password = await generateRdsAuthToken(username);
  } else {
    const creds = await fetchDbPassword();
    username = creds.username;
    password = creds.password;
  }

  return new DataSource({
    type: 'postgres',
    host: dbHost,
    port: dbPort,
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
