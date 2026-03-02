import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SlackErrorContext {
  title?: string;
  formId?: string;
  submissionId?: string;
  processor?: string;
  error: string;
  fields?: Record<string, string | number>;
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly botToken?: string;
  private readonly channel?: string;
  private readonly apiUrl = 'https://slack.com/api/chat.postMessage';

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('slack.botToken');
    this.channel = this.configService.get<string>('slack.errorChannel');
  }

  async notifyError(context: SlackErrorContext): Promise<void> {
    if (!this.botToken || !this.channel) {
      return;
    }

    const title = context.title ?? 'Processing Error';

    const fields: { type: 'mrkdwn'; text: string }[] = [];

    if (context.processor) {
      fields.push({
        type: 'mrkdwn',
        text: `*Processor:*\n${context.processor}`,
      });
    }
    if (context.formId) {
      fields.push({ type: 'mrkdwn', text: `*Form:*\n\`${context.formId}\`` });
    }
    if (context.submissionId) {
      fields.push({
        type: 'mrkdwn',
        text: `*Submission:*\n\`${context.submissionId}\``,
      });
    }

    if (context.fields) {
      for (const [key, value] of Object.entries(context.fields)) {
        fields.push({ type: 'mrkdwn', text: `*${key}:*\n${value}` });
      }
    }

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🔴 ${title}`, emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Error:*\n${context.error}` },
      },
      ...(fields.length > 0 ? [{ type: 'section', fields }] : []),
      { type: 'divider' },
    ];

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.botToken}`,
        },
        body: JSON.stringify({ channel: this.channel, blocks }),
      });

      const body = (await response.json()) as { ok: boolean; error?: string };

      if (!body.ok) {
        this.logger.warn(`Slack API error: ${body.error}`);
      }
    } catch (err) {
      this.logger.warn('Failed to send Slack notification', err);
    }
  }
}
