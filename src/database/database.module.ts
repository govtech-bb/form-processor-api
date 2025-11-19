import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormConfig } from './entities';
import { dataSource } from './datasource';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        return {};
      },
      dataSourceFactory: () => dataSource.initialize(),
    }),
    TypeOrmModule.forFeature([FormConfig]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
