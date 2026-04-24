import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiResponse } from '../common/dto';
import { CognitoGuard } from '../auth/cognito.guard';
import { CognitoUserService } from '../auth/cognito-user.service';
import { ServiceAccessService } from './service-access.service';
import { FeatureFlagDto } from './dto';

@Controller('services')
export class ServicesController {
  private readonly logger = new Logger(ServicesController.name);

  constructor(
    private readonly serviceAccessService: ServiceAccessService,
    private readonly cognitoUserService: CognitoUserService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllServiceAccess() {
    const configs = await this.serviceAccessService.findAll();
    this.logger.log(
      `GET /services → returning ${configs.length} service config(s)`,
    );
    return ApiResponse.success(configs, 'Service access configs retrieved');
  }

  @Get(':serviceSlug')
  @HttpCode(HttpStatus.OK)
  async getServiceAccess(@Param('serviceSlug') serviceSlug: string) {
    const config = await this.serviceAccessService.findConfigForService(
      serviceSlug,
    );

    if (!config) {
      this.logger.log(
        `GET /services/${serviceSlug} → 404 (no DB entry, treated as unprotected)`,
      );
      throw new NotFoundException(
        `No access config found for service: ${serviceSlug}`,
      );
    }

    this.logger.log(
      `GET /services/${serviceSlug} → returning service slug: ${serviceSlug}`,
    );
    return ApiResponse.success(config, 'Service access config retrieved');
  }

  /**
   * Toggles the service-level feature flag (isProtected) for a service.
   *
   * Requires a valid Cognito access token — this is the only write endpoint
   * on the services resource. Read endpoints remain open for the frontend.
   */
  @Patch(':serviceSlug/feature-flag')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CognitoGuard)
  async updateFeatureFlag(
    @Param('serviceSlug') serviceSlug: string,
    @Body() dto: FeatureFlagDto,
    @Req() request: Request,
  ) {
    const { actor, actorName } = await this.cognitoUserService.resolveActor(request);
    const updated = await this.serviceAccessService.upsertFeatureFlag(
      serviceSlug,
      dto,
      actor,
      actorName,
    );

    this.logger.log(
      `PATCH /services/${serviceSlug}/feature-flag → isProtected=${dto.isProtected}`,
    );

    return ApiResponse.success(updated, 'Feature flag updated');
  }

  /**
   * Toggles the feature flag for a specific subpage of a service.
   *
   * Allows a subpage to be protected independently of the service-level flag,
   * e.g. the /form subpage can be hidden while /start remains public.
   */
  @Patch(':serviceSlug/subpages/:subpageSlug/feature-flag')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CognitoGuard)
  async updateSubpageFeatureFlag(
    @Param('serviceSlug') serviceSlug: string,
    @Param('subpageSlug') subpageSlug: string,
    @Body() dto: FeatureFlagDto,
    @Req() request: Request,
  ) {
    if (!subpageSlug) {
      throw new BadRequestException('subpageSlug must not be empty');
    }

    const { actor, actorName } = await this.cognitoUserService.resolveActor(request);
    const updated = await this.serviceAccessService.upsertSubpageFeatureFlag(
      serviceSlug,
      subpageSlug,
      dto,
      actor,
      actorName,
    );

    this.logger.log(
      `PATCH /services/${serviceSlug}/subpages/${subpageSlug}/feature-flag → isProtected=${dto.isProtected}`,
    );

    return ApiResponse.success(updated, 'Subpage feature flag updated');
  }

}
