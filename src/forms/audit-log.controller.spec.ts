import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuditLogController } from './audit-log.controller';
import type { AuditLogService } from './audit-log.service';
import type { CreateAuditLogDto } from './dto';

jest.mock('../auth/cognito.guard', () => ({
  CognitoGuard: class MockCognitoGuard {},
}));

type MockAuditLogService = {
  create: jest.Mock;
  findAll: jest.Mock;
};

describe('AuditLogController', () => {
  let controller: AuditLogController;
  let service: MockAuditLogService;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
    };
    controller = new AuditLogController(service as unknown as AuditLogService);
  });

  it('creates audit entry using actor from cognito claims', async () => {
    const dto: CreateAuditLogDto = {
      serviceSlug: 'birth-certificate',
      scope: 'service',
      action: 'enable',
    };
    service.create.mockResolvedValue({ id: 'entry-1' });

    const request = {
      cognitoClaims: { email: 'auditor@example.com' },
    } as unknown as Request;

    await controller.create(dto, request);

    expect(service.create).toHaveBeenCalledWith(dto, 'auditor@example.com');
  });

  it('falls back to sub claim when email is unavailable', async () => {
    const dto: CreateAuditLogDto = {
      serviceSlug: 'passport',
      scope: 'subpage',
      action: 'disable',
      subpageSlug: 'payment',
    };
    service.create.mockResolvedValue({ id: 'entry-2' });

    const request = {
      cognitoClaims: { sub: 'user-sub-id' },
    } as unknown as Request;

    await controller.create(dto, request);

    expect(service.create).toHaveBeenCalledWith(dto, 'user-sub-id');
  });

  it('throws when cognito claims are missing', async () => {
    const dto: CreateAuditLogDto = {
      serviceSlug: 'passport',
      scope: 'service',
      action: 'enable',
    };

    await expect(controller.create(dto, {} as Request)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('passes pagination options to service', async () => {
    service.findAll.mockResolvedValue({
      entries: [],
      total: 0,
      limit: 50,
      offset: 0,
      hasMore: false,
    });

    await controller.findAll('passport', 25, 10);

    expect(service.findAll).toHaveBeenCalledWith({
      serviceSlug: 'passport',
      limit: 25,
      offset: 10,
    });
  });
});
