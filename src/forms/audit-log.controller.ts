import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Query,
  ParseIntPipe,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiResponse } from '../common/dto';
import { CognitoGuard } from '../auth/cognito.guard';
import { AuditLogService } from './audit-log.service';
import { CreateAuditLogDto } from './dto';

@Controller('audit-logs')
@UseGuards(CognitoGuard)
export class AuditLogController {
  private readonly logger = new Logger(AuditLogController.name);

  constructor(private readonly auditLogService: AuditLogService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAuditLogDto, @Req() request: Request) {
    const actor = this.resolveActorFromRequest(request);
    const entry = await this.auditLogService.create(dto, actor);

    this.logger.log(
      `POST /audit-logs → ${dto.action} ${dto.scope} flag for ${dto.serviceSlug} by ${actor}`,
    );

    return ApiResponse.success(entry, 'Audit log entry created');
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('serviceSlug') serviceSlug?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const result = await this.auditLogService.findAll({
      serviceSlug,
      limit: limit ?? 50,
      offset: offset ?? 0,
    });

    this.logger.log(
      `GET /audit-logs → returning ${result.entries.length} entries (offset=${
        result.offset
      }, limit=${result.limit})${serviceSlug ? ` for ${serviceSlug}` : ''}`,
    );

    return ApiResponse.success(result, 'Audit log entries retrieved');
  }

  private resolveActorFromRequest(request: Request): string {
    const claims = (
      request as Request & { cognitoClaims?: Record<string, unknown> }
    ).cognitoClaims;

    if (!claims) {
      throw new UnauthorizedException('Missing Cognito claims in request');
    }

    const actor =
      this.readStringClaim(claims, 'email') ??
      this.readStringClaim(claims, 'username') ??
      this.readStringClaim(claims, 'cognito:username') ??
      this.readStringClaim(claims, 'sub');

    if (!actor) {
      throw new UnauthorizedException('No usable actor claim found in token');
    }

    return actor;
  }

  private readStringClaim(
    claims: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = claims[key];
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
