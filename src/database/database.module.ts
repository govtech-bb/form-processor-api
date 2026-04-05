import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormConfig } from './entities';
import { createDataSource, dataSource } from './datasource';

const useIamAuth = process.env.DB_USE_IAM_AUTH === 'true';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        return {};
      },
      dataSourceFactory: async () => {
        if (useIamAuth) {
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
