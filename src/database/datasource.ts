import * as path from 'path';
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

export const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'forms_processor_db',
  entities: [path.join(__dirname, './entities/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, './migrations/*{.ts,.js}')],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  ssl: {
    rejectUnauthorized: false,
  },
});
