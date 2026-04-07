import * as path from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Signer } from '@aws-sdk/rds-signer';

// Load environment variables
config();

const dbHost = process.env.DB_HOST || 'localhost';
const isLocalDatabase = dbHost === 'localhost' || dbHost === '127.0.0.1';
const useIamAuth = process.env.DB_USE_IAM_AUTH === 'true' && !isLocalDatabase;

/**
 * Generate an IAM auth token for RDS.
 * Tokens expire after 15 minutes — this function is passed as a reference
 * to TypeORM/pg so a fresh token is generated for each new connection.
 */
async function getPassword(): Promise<string> {
  if (useIamAuth) {
    const region = process.env.AWS_REGION || 'us-east-1';
    const username = process.env.DB_USERNAME || 'iam_db_user';
    console.log(
      `IAM auth: generating token for ${username}@${dbHost}:5432 region=${region}`,
    );
    const signer = new Signer({
      hostname: dbHost,
      port: 5432,
      region,
      username,
    });
    const token = await signer.getAuthToken();
    console.log(`IAM auth: token generated (length=${token.length})`);
    return token;
  }
  return process.env.DB_PASSWORD || 'postgres';
}

/**
 * Creates a DataSource with IAM token auth when DB_USE_IAM_AUTH=true.
 * The password callback is passed via `extra.password` so it reaches the
 * pg driver directly (TypeORM spreads `extra` into the pg Pool config,
 * overriding the base `password` field). A fresh 15-min token is generated
 * for every new connection automatically.
 */
export async function createDataSource(): Promise<DataSource> {
  const initialPassword = await getPassword();

  return new DataSource({
    type: 'postgres',
    host: dbHost,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: initialPassword,
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
    ...(useIamAuth && {
      extra: {
        password: () => getPassword(),
      },
    }),
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
