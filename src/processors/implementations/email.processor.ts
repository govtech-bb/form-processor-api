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
      throw new Error('Email processor requires "to" field in config');
    }

    if (!subject) {
      throw new Error('Email processor requires "subject" field in config');
    }

    if (!template && !html && !text) {
      throw new Error(
        'Email processor requires either "template", "html", or "text" field in config',
      );
    }

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
  }
}
