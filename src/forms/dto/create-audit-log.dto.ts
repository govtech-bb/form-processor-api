import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

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

  /**
   * Legacy client field — ignored by the backend.
   * The authoritative actor is always derived from verified Cognito claims.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  performedBy?: string;

  /**
   * Accepted for backwards compatibility with existing clients but never used.
   * The backend derives the display name from verified Cognito token claims.
   * whitelist: true strips this before it reaches the controller.
   */
  @IsOptional()
  @IsString()
  performedByName?: string;
}
