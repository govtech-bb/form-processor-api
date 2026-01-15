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
  ): Promise<void> {
    this.logger.log(`Executing email processor for form: ${context.formId}`);

    const { to, from, subject, template, html, text } = config;

    if (!to) {
      this.logger.warn(
        `Email processor skipped: "to" field is missing in config for submission: ${context.submissionId}`,
      );
      return;
    }

    if (!subject) {
      this.logger.warn(
        `Email processor skipped: "subject" field is missing in config for submission: ${context.submissionId}`,
      );
      return;
    }

    if (!template && !html && !text) {
      this.logger.warn(
        `Email processor skipped: "template", "html", or "text" field is missing in config for submission: ${context.submissionId}`,
      );
      return;
    }

    try {
      await this.emailService.sendEmail({
        to,
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
    } catch (error) {
      this.logger.warn(
        `Email processor encountered an error but continuing (email service may be unavailable): ${error.message}`,
      );
      // Continue without throwing - email failures should not block form submission
    }
  }
}
