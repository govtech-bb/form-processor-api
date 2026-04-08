import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormConfig } from './entities';
import { createDataSource, dataSource } from './datasource';

const useSecretManager = !!process.env.DB_SECRET_ARN;

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        return {};
      },
      dataSourceFactory: async () => {
        if (useSecretManager) {
          const ds = await createDataSource();
          return ds.initialize();
        }
        return dataSource.initialize();
      },
    }),
    TypeOrmModule.forFeature([FormConfig]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
