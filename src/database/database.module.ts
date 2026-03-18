import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormConfig, ServiceAccess } from './entities';
import { dataSource } from './datasource';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        return {};
      },
      dataSourceFactory: () => dataSource.initialize(),
    }),
    TypeOrmModule.forFeature([FormConfig, ServiceAccess]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
