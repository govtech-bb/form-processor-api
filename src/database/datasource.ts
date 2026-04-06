import * as path from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { Signer } from '@aws-sdk/rds-signer';

// Load environment variables
config();

const dbHost = process.env.DB_HOST || 'localhost';
const isLocalDatabase = dbHost === 'localhost' || dbHost === '127.0.0.1';
const useIamAuth = process.env.DB_USE_IAM_AUTH === 'true' && !isLocalDatabase;

async function getPassword(): Promise<string> {
  if (useIamAuth) {
    const signer = new Signer({
      hostname: dbHost,
      port: 5432,
      region: process.env.AWS_REGION || 'us-east-1',
      username: process.env.DB_USERNAME || 'iam_db_user',
    });
    return signer.getAuthToken();
  }
  return process.env.DB_PASSWORD || 'postgres';
}

export async function createDataSource(): Promise<DataSource> {
  const password = await getPassword();

  return new DataSource({
    type: 'postgres',
    host: dbHost,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
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
    // For IAM auth, tokens expire after 15 min. TypeORM reconnects automatically
    // and will call this password function on reconnect.
    ...(useIamAuth && {
      extra: {
        // pg driver will call this before each new connection
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
