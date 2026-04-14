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
   * Legacy client field.
   * The backend ignores this and derives the authoritative actor from Cognito claims.
   */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  performedBy?: string;

  /** Human-readable display name from the client's ID token profile. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  performedByName?: string;
}
