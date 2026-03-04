import { Injectable, Logger } from '@nestjs/common';
import { IProcessor, ProcessorContext } from '../interfaces';
import { EmailService } from '../../email/email.service';

@Injectable()
export class EmailProcessor implements IProcessor {
  readonly type = 'email';
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {}

  async execute(
    config: Record<string, any>,
    context: ProcessorContext,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.log(`Executing email processor for form: ${context.formId}`);

    const { to, from, subject, template, html, text } = config;

    if (!to) {
      const error = `"to" field is missing in email config`;
      this.logger.warn(
        `Email processor skipped: ${error} for submission: ${context.submissionId}`,
      );
      return { success: false, error };
    }

    if (!subject) {
      const error = `"subject" field is missing in email config`;
      this.logger.warn(
        `Email processor skipped: ${error} for submission: ${context.submissionId}`,
      );
      return { success: false, error };
    }

    if (!template && !html && !text) {
      const error = `"template", "html", or "text" field is missing in email config`;
      this.logger.warn(
        `Email processor skipped: ${error} for submission: ${context.submissionId}`,
      );
      return { success: false, error };
    }

    await this.emailService.sendEmail({
      to: to.split(',').map((email: string) => email.trim()),
      from,
      subject,
      template,
      html,
      text,
      data: {
        formId: context.formId,
        submissionId: context.submissionId,
        ...context.data,
      },
    });

    this.logger.log(
      `Email sent successfully for submission: ${context.submissionId}`,
    );

    return { success: true };
  }
}
