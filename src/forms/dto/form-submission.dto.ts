import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class FormSubmissionDto {
  @IsNotEmpty()
  @IsString()
  formId: string;

  @IsNotEmpty()
  @IsObject()
  data: Record<string, any>;
}
