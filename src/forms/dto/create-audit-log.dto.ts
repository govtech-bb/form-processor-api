import { IsIn, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

export class CreateAuditLogDto {
  @IsString()
  @IsNotEmpty()
  serviceSlug: string;

  @ValidateIf((dto: CreateAuditLogDto) => dto.scope === 'subpage')
  @IsString()
  @IsNotEmpty()
  subpageSlug?: string;

  @IsIn(['service', 'subpage'])
  scope: 'service' | 'subpage';

  @IsIn(['enable', 'disable'])
  action: 'enable' | 'disable';
}
