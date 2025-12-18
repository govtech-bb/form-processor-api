import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DepartmentMappingService {
  private readonly logger = new Logger(DepartmentMappingService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Get the API key for a given department
   */
  getApiKeyForDepartment(department: string): string {
    const departmentApiKeys = this.configService.get('ezpay.departmentApiKeys');

    if (!departmentApiKeys) {
      this.logger.warn(
        'Department API keys not configured, falling back to default',
      );
      return this.configService.get<string>('ezpay.apiKey');
    }

    const apiKey = departmentApiKeys[department];

    if (!apiKey) {
      this.logger.warn(
        `No API key configured for department: ${department}, using default`,
      );
      return (
        departmentApiKeys.default ||
        this.configService.get<string>('ezpay.apiKey')
      );
    }

    this.logger.log(`Using API key for department: ${department}`);
    return apiKey;
  }

  /**
   * Get all available departments and their API key status
   */
  getAvailableDepartments(): {
    department: string;
    hasApiKey: boolean;
  }[] {
    const departmentApiKeys =
      this.configService.get('ezpay.departmentApiKeys') || {};

    return Object.keys(departmentApiKeys).map((department) => ({
      department,
      hasApiKey: !!departmentApiKeys[department],
    }));
  }

  /**
   * Validate if a department has a configured API key
   */
  isDepartmentConfigured(department: string): boolean {
    const departmentApiKeys = this.configService.get('ezpay.departmentApiKeys');
    return !!(departmentApiKeys && departmentApiKeys[department]);
  }
}
