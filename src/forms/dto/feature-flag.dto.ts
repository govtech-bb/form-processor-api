import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class FeatureFlagDto {
  @IsBoolean()
  isProtected: boolean;

  /**
   * When provided, the same isProtected value is also applied to each listed
   * subpage slug in the same request. Used by the dashboard to cascade the
   * service-level toggle to all subpages in one atomic operation.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  subpageSlugs?: string[];
}
