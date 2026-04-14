import { BadRequestException } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import type { CreateAuditLogDto } from './dto';
import type { FeatureFlagAuditLog } from '../database/entities';

type MockRepository = {
  create: jest.Mock;
  save: jest.Mock;
  findAndCount: jest.Mock;
};

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repository: MockRepository;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findAndCount: jest.fn(),
    };
    service = new AuditLogService(repository as never);
  });

  it('creates a service-scope entry with null subpage slug', async () => {
    const dto: CreateAuditLogDto = {
      serviceSlug: 'birth-certificate',
      scope: 'service',
      action: 'enable',
    };

    const createdEntry = { id: '1' } as FeatureFlagAuditLog;
    repository.create.mockReturnValue(createdEntry);
    repository.save.mockResolvedValue(createdEntry);

    const result = await service.create(dto, 'auditor@example.com');

    expect(repository.create).toHaveBeenCalledWith({
      serviceSlug: 'birth-certificate',
      subpageSlug: null,
      scope: 'service',
      action: 'enable',
      performedBy: 'auditor@example.com',
      performedByName: null,
    });
    expect(result).toBe(createdEntry);
  });

  it('rejects subpageSlug for service scope', async () => {
    const dto: CreateAuditLogDto = {
      serviceSlug: 'birth-certificate',
      scope: 'service',
      action: 'disable',
      subpageSlug: 'form',
    };

    await expect(service.create(dto, 'auditor@example.com')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('requires subpageSlug for subpage scope', async () => {
    const dto: CreateAuditLogDto = {
      serviceSlug: 'birth-certificate',
      scope: 'subpage',
      action: 'disable',
    };

    await expect(service.create(dto, 'auditor@example.com')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns paginated audit logs with metadata', async () => {
    const entries = [{ id: '1' }, { id: '2' }] as FeatureFlagAuditLog[];
    repository.findAndCount.mockResolvedValue([entries, 12]);

    const result = await service.findAll({
      serviceSlug: 'birth-certificate',
      limit: 2,
      offset: 4,
    });

    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: { serviceSlug: 'birth-certificate' },
      order: { performedAt: 'DESC' },
      take: 2,
      skip: 4,
    });
    expect(result).toEqual({
      entries,
      total: 12,
      limit: 2,
      offset: 4,
      hasMore: true,
    });
  });

  it('caps limit at 200 entries', async () => {
    repository.findAndCount.mockResolvedValue([[], 0]);

    await service.findAll({
      serviceSlug: undefined,
      limit: 1000,
      offset: 0,
    });

    expect(repository.findAndCount).toHaveBeenCalledWith({
      where: undefined,
      order: { performedAt: 'DESC' },
      take: 200,
      skip: 0,
    });
  });
});
