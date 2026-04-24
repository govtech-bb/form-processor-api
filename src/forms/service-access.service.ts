import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  type DataSource,
  type EntityManager,
  Not,
  type Repository,
} from 'typeorm';
import { ServiceAccess } from '../database/entities';
import type { FeatureFlagDto } from './dto';

export type SubpageAccessEntry = {
  slug: string;
  isProtected: boolean;
};

/**
 * The full protection config for a single service.
 *
 * isProtected  — controls whether the service is hidden from category listings
 * subpages     — per-subpage protection; absence of an entry means unprotected
 */
export type ServiceAccessSummary = {
  serviceSlug: string;
  isProtected: boolean;
  subpages: SubpageAccessEntry[];
};

@Injectable()
export class ServiceAccessService {
  /** Sentinel for a service-level row, which controls category listing visibility */
  private static readonly SERVICE_LEVEL_SLUG = '';

  constructor(
    @InjectRepository(ServiceAccess)
    private serviceAccessRepository: Repository<ServiceAccess>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * Returns the full protection config for every service that has at least one
   * entry in the database. Services absent from the DB are implicitly unprotected.
   */
  async findAll(): Promise<ServiceAccessSummary[]> {
    const rows = await this.serviceAccessRepository.find();

    const byService = new Map<string, ServiceAccess[]>();
    for (const row of rows) {
      const group = byService.get(row.serviceSlug) ?? [];
      group.push(row);
      byService.set(row.serviceSlug, group);
    }

    return Array.from(byService.entries()).map(([serviceSlug, group]) =>
      this.toSummary(serviceSlug, group),
    );
  }

  /**
   * Returns the full protection config for one service, or null if the service
   * has no entries in the database (implicitly unprotected).
   */
  async findConfigForService(
    serviceSlug: string,
  ): Promise<ServiceAccessSummary | null> {
    const rows = await this.serviceAccessRepository.find({
      where: { serviceSlug },
    });

    if (rows.length === 0) {
      return null;
    }

    return this.toSummary(serviceSlug, rows);
  }

  /** Returns false if no service-level row exists — absence means unprotected. */
  async isServiceProtected(serviceSlug: string): Promise<boolean> {
    const row = await this.serviceAccessRepository.findOne({
      where: {
        serviceSlug,
        subpageSlug: ServiceAccessService.SERVICE_LEVEL_SLUG,
      },
    });
    return row?.isProtected ?? false;
  }

  /** Returns false if no subpage-level row exists — absence means unprotected. */
  async isSubpageProtected(
    serviceSlug: string,
    subpageSlug: string,
  ): Promise<boolean> {
    const row = await this.serviceAccessRepository.findOne({
      where: { serviceSlug, subpageSlug },
    });
    return row?.isProtected ?? false;
  }

  async hasProtectedSubpages(serviceSlug: string): Promise<boolean> {
    const count = await this.serviceAccessRepository.count({
      where: {
        serviceSlug,
        subpageSlug: Not(ServiceAccessService.SERVICE_LEVEL_SLUG),
        isProtected: true,
      },
    });
    return count > 0;
  }

  /**
   * Sets the service-level isProtected flag for a service.
   *
   * When dto.subpageSlugs is provided, the same flag value is also applied to
   * each listed subpage in the same operation — allowing the dashboard to
   * cascade the service toggle to all subpages atomically.
   *
   * Returns the updated full config for the service.
   */
  async upsertFeatureFlag(
    serviceSlug: string,
    dto: FeatureFlagDto,
    performedBy: string,
    performedByName: string | null,
  ): Promise<ServiceAccessSummary> {
    const slugsToUpdate = [
      ServiceAccessService.SERVICE_LEVEL_SLUG,
      ...(dto.subpageSlugs ?? []),
    ];

    const allRows = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ServiceAccess);
      await this.setAuditActorForTransaction(manager, performedBy, performedByName);

      await Promise.all(
        slugsToUpdate.map((subpageSlug) =>
          this.upsertRow(repo, serviceSlug, subpageSlug, dto.isProtected),
        ),
      );

      return repo.find({ where: { serviceSlug } });
    });

    return this.toSummary(serviceSlug, allRows);
  }

  /**
   * Sets the isProtected flag for a specific subpage of a service.
   *
   * Creates the subpage row if one does not exist yet (upsert).
   * Returns the updated full config for the service.
   */
  async upsertSubpageFeatureFlag(
    serviceSlug: string,
    subpageSlug: string,
    dto: FeatureFlagDto,
    performedBy: string,
    performedByName: string | null,
  ): Promise<ServiceAccessSummary> {
    const allRows = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ServiceAccess);
      await this.setAuditActorForTransaction(manager, performedBy, performedByName);

      await this.upsertRow(repo, serviceSlug, subpageSlug, dto.isProtected);

      return repo.find({
        where: { serviceSlug },
      });
    });

    return this.toSummary(serviceSlug, allRows);
  }

  /** Shared upsert logic used by both service-level and subpage-level toggles. */
  private async upsertRow(
    repo: Repository<ServiceAccess>,
    serviceSlug: string,
    subpageSlug: string,
    isProtected: boolean,
  ): Promise<void> {
    await repo.upsert({ serviceSlug, subpageSlug, isProtected }, [
      'serviceSlug',
      'subpageSlug',
    ]);
  }

  private async setAuditActorForTransaction(
    manager: EntityManager,
    performedBy: string,
    performedByName: string | null,
  ): Promise<void> {
    await manager.query(`SELECT set_config('app.audit_actor', $1, true)`, [
      performedBy,
    ]);
    await manager.query(
      `SELECT set_config('app.audit_actor_name', $1, true)`,
      [performedByName ?? ''],
    );
  }

  private toSummary(
    serviceSlug: string,
    rows: ServiceAccess[],
  ): ServiceAccessSummary {
    const serviceRow = rows.find(
      (r) => r.subpageSlug === ServiceAccessService.SERVICE_LEVEL_SLUG,
    );
    const subpageRows = rows.filter(
      (r) => r.subpageSlug !== ServiceAccessService.SERVICE_LEVEL_SLUG,
    );

    return {
      serviceSlug,
      isProtected: serviceRow?.isProtected ?? false,
      subpages: subpageRows.map((r) => ({
        slug: r.subpageSlug,
        isProtected: r.isProtected,
      })),
    };
  }
}
