import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { FindOptionsWhere, Repository } from 'typeorm';
import { FeatureFlagAuditLog } from '../database/entities';
import type { CreateAuditLogDto } from './dto';

type AuditLogQueryOptions = {
  serviceSlug?: string;
  limit: number;
  offset: number;
};

type AuditLogListResult = {
  entries: FeatureFlagAuditLog[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(FeatureFlagAuditLog)
    private auditLogRepository: Repository<FeatureFlagAuditLog>,
  ) {}

  async create(
    dto: CreateAuditLogDto,
    performedBy: string,
  ): Promise<FeatureFlagAuditLog> {
    const normalizedSubpageSlug = this.resolveSubpageSlug(dto);

    const entry = this.auditLogRepository.create({
      serviceSlug: dto.serviceSlug,
      subpageSlug: normalizedSubpageSlug,
      scope: dto.scope,
      action: dto.action,
      performedBy,
      performedByName: dto.performedByName?.trim() ?? null,
    });

    return this.auditLogRepository.save(entry);
  }

  async findAll(options: AuditLogQueryOptions): Promise<AuditLogListResult> {
    const where: FindOptionsWhere<FeatureFlagAuditLog> | undefined =
      options.serviceSlug ? { serviceSlug: options.serviceSlug } : undefined;
    const safeLimit = this.resolveLimit(options.limit);
    const safeOffset = this.resolveOffset(options.offset);

    const [entries, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { performedAt: 'DESC' },
      take: safeLimit,
      skip: safeOffset,
    });

    return {
      entries,
      total,
      limit: safeLimit,
      offset: safeOffset,
      hasMore: safeOffset + entries.length < total,
    };
  }

  private resolveSubpageSlug(dto: CreateAuditLogDto): string | null {
    const trimmedSubpageSlug = dto.subpageSlug?.trim();

    if (dto.scope === 'service') {
      if (trimmedSubpageSlug) {
        throw new BadRequestException(
          'subpageSlug must be omitted when scope is "service"',
        );
      }
      return null;
    }

    if (!trimmedSubpageSlug) {
      throw new BadRequestException(
        'subpageSlug is required when scope is "subpage"',
      );
    }

    return trimmedSubpageSlug;
  }

  private resolveLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return Math.min(Math.floor(limit), 200);
  }

  private resolveOffset(offset: number): number {
    if (!Number.isFinite(offset) || offset < 0) {
      throw new BadRequestException('offset must be zero or greater');
    }
    return Math.floor(offset);
  }
}
