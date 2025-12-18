import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Upload } from '@aws-sdk/lib-storage';
import { PutObjectCommandInput, S3Client } from '@aws-sdk/client-s3';
import { AttachmentDTO } from '../common/dto';

@Injectable()
export class FileService {
  constructor(private configService: ConfigService) {}

  async uploadFile(
    file: Express.Multer.File,
    folder = 'general',
  ): Promise<AttachmentDTO> {
    const url = await this.aws(file, folder.toLowerCase());

    if (!url) {
      throw new Error('File upload failed');
    }

    return {
      url,
      type: file.mimetype,
      name: file.originalname,
      size: file.size,
    };
  }

  private async aws(
    file: Express.Multer.File,
    folder = 'general',
  ): Promise<string> {
    const s3 = new S3Client({
      region: this.configService.get('aws.s3.bucketRegion'),
    });

    const fileName = `${folder}/${Date.now()}-${file.originalname}`.replace(
      /\s/g,
      '_',
    );

    const params: PutObjectCommandInput = {
      Bucket: this.configService.get('aws.s3.bucketName'),
      Key: fileName,
      Body: file.buffer,
      ACL: 'public-read',
    };

    const res = await new Upload({
      client: s3,
      params,
    }).done();

    return res.Location;
  }
}
