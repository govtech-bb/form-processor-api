import { Controller, Post, Query, UploadedFile } from '@nestjs/common';
import { ApiFile } from '../common/decorators';
import { ParseFile } from '../common/pipes';
import { ApiResponse } from '../common/dto';
import { FileService } from './file.service';

@Controller('file')
export class FileController {
  constructor(private readonly filesService: FileService) {}

  @Post('upload')
  @ApiFile('file')
  async uploadFile(
    @UploadedFile(ParseFile) file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    const data = await this.filesService.uploadFile(file, folder);
    return ApiResponse.success(data, 'File uploaded successfully');
  }
}
