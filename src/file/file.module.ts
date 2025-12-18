import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FileService } from './file.service';
import { FileController } from './file.controller';

@Module({
  imports: [ConfigModule],
  providers: [FileService],
  controllers: [FileController],
  exports: [FileService],
})
export class FileModule {}
