import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Upload } from '@aws-sdk/lib-storage';
import {
  PutObjectCommandInput,
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import S3Presigner from '@aws-sdk/s3-request-presigner';
import { AttachmentDTO } from '../common/dto';

@Injectable()
export class FileService {
  constructor(private configService: ConfigService) {}

  async uploadFile(
    file: Express.Multer.File,
    folder = 'general',
  ): Promise<AttachmentDTO> {
    const result = await this.aws(file, folder.toLowerCase());

    if (!result.url) {
      throw new Error('File upload failed');
    }

    return {
      url: result.url,
      key: result.key,
      type: file.mimetype,
      name: file.originalname,
      size: file.size,
    };
  }

  private async aws(
    file: Express.Multer.File,
    folder = 'general',
  ): Promise<{ url: string; key: string }> {
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
    };

    await new Upload({
      client: s3,
      params,
    }).done();

    const url = await this.getSignedUrl(fileName, 7 * 24 * 3600); // 7 days

    return {
      url,
      key: fileName,
    };
  }

  private async getSignedUrl(
    fileKey: string,
    expiresIn = 3600,
  ): Promise<string> {
    const s3 = new S3Client({
      region: this.configService.get('aws.s3.bucketRegion'),
    });

    const command = new GetObjectCommand({
      Bucket: this.configService.get('aws.s3.bucketName'),
      Key: fileKey,
    });

    return S3Presigner.getSignedUrl(s3, command, { expiresIn });
  }
}
