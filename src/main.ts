import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters';
import { DataSource } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Run database migrations on startup
  try {
    const dataSource = app.get(DataSource);
    console.log('Running database migrations...');
    const migrations = await dataSource.runMigrations();
    console.log(`✓ Successfully ran ${migrations.length} migration(s)`);
  } catch (error) {
    console.error('Failed to run migrations:', error);
    throw error;
  }

  // Global prefix
  const apiPrefix = configService.get('app.apiPrefix');
  app.setGlobalPrefix(apiPrefix);

  // CORS
  app.enableCors({
    origin: true, // Configure based on your needs
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = configService.get('app.port');
  await app.listen(port);

  console.log(`
    🚀 Application is running on: http://localhost:${port}/${apiPrefix}
  `);
}
bootstrap();
