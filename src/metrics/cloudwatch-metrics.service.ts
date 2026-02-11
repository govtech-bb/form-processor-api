import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CloudWatchClient,
  PutMetricDataCommand,
  PutMetricDataCommandInput,
} from '@aws-sdk/client-cloudwatch';
import { MetricStatus } from './interfaces/metric-types';

@Injectable()
export class CloudWatchMetricsService {
  private readonly logger = new Logger(CloudWatchMetricsService.name);
  private readonly cloudWatchClient: CloudWatchClient;
  private readonly enabled: boolean;
  private readonly namespace: string;
  private readonly environment: string;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('aws.region', 'us-east-1');

    this.enabled = this.configService.get<boolean>('metrics.enabled', true);
    this.namespace = this.configService.get<string>(
      'metrics.namespace',
      'FormsProcessor/Submissions',
    );
    this.environment = this.configService.get<string>(
      'metrics.environment',
      'development',
    );

    this.cloudWatchClient = new CloudWatchClient({
      region,
    });

    if (!this.enabled) {
      this.logger.warn('CloudWatch metrics disabled via configuration');
    }
  }

  /**
   * Emit a form submission metric to CloudWatch
   * @param formId - The form identifier (e.g., 'get-birth-certificate')
   * @param status - The submission status ('received', 'success', or 'failed')
   */
  async emitFormSubmissionMetric(
    formId: string,
    status: MetricStatus,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const metricData: PutMetricDataCommandInput = {
        Namespace: this.namespace,
        MetricData: [
          {
            MetricName: 'FormSubmission',
            Dimensions: [
              {
                Name: 'FormId',
                Value: formId,
              },
              {
                Name: 'Status',
                Value: status,
              },
              {
                Name: 'Environment',
                Value: this.environment,
              },
            ],
            Value: 1,
            Unit: 'Count',
            Timestamp: new Date(),
          },
        ],
      };

      const command = new PutMetricDataCommand(metricData);
      await this.cloudWatchClient.send(command);

      this.logger.debug(`CloudWatch metric emitted: ${formId}/${status}`, {
        formId,
        status,
        environment: this.environment,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to emit CloudWatch metric (continuing silently): ${error.message}`,
        {
          formId,
          status,
          error: error.stack,
        },
      );
    }
  }
}
