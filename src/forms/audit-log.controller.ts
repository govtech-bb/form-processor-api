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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiResponse } from '../common/dto';
import { CognitoGuard } from '../auth/cognito.guard';
import { CognitoUserService } from '../auth/cognito-user.service';
import { AuditLogService } from './audit-log.service';
import { CreateAuditLogDto } from './dto';

@Controller('audit-logs')
@UseGuards(CognitoGuard)
export class AuditLogController {
  private readonly logger = new Logger(AuditLogController.name);

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly cognitoUserService: CognitoUserService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAuditLogDto, @Req() request: Request) {
    const { actor, actorName } = await this.cognitoUserService.resolveActor(request);
    const entry = await this.auditLogService.create(dto, actor, actorName);

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

}
