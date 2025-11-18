import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as Handlebars from 'handlebars';

export interface EmailOptions {
  to: string | string[];
  from?: string;
  subject: string;
  template?: string;
  html?: string;
  text?: string;
  data?: Record<string, any>;
  configurationSet?: string;
  tags?: Array<{ name: string; value: string }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly sesClient: SESv2Client;
  private readonly defaultFromEmail: string;
  private readonly templatesDir: string;
  private readonly configurationSet?: string;
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get('aws.region', 'us-east-1');
    const accessKeyId = this.configService.get('aws.accessKeyId');
    const secretAccessKey = this.configService.get('aws.secretAccessKey');

    // Initialize AWS SES v2 client
    this.sesClient = new SESv2Client({
      region,
      ...(accessKeyId &&
        secretAccessKey && {
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        }),
    });

    this.defaultFromEmail = this.configService.get('aws.ses.fromEmail');
    this.configurationSet = this.configService.get('aws.ses.configurationSet');
    this.templatesDir = path.join(
      process.cwd(),
      this.configService.get('email.templatesDir'),
    );

    this.logger.log('EmailService initialized with AWS SES v2');
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const from = options.from || this.defaultFromEmail;
      const to = Array.isArray(options.to) ? options.to : [options.to];

      let htmlBody = options.html;
      let textBody = options.text;

      // If template is specified, render it
      if (options.template) {
        const rendered = await this.renderTemplate(
          options.template,
          options.data || {},
        );
        htmlBody = rendered;
        textBody = textBody || this.stripHtml(rendered);
      }

      // Build email tags for CloudWatch telemetry
      const emailTags: Array<{ Name: string; Value: string }> = [];
      if (options.tags) {
        emailTags.push(
          ...options.tags.map((tag) => ({
            Name: tag.name,
            Value: tag.value,
          })),
        );
      }

      const command = new SendEmailCommand({
        FromEmailAddress: from,
        Destination: {
          ToAddresses: to,
        },
        ...(this.configurationSet && {
          ConfigurationSetName:
            options.configurationSet || this.configurationSet,
          ...(emailTags.length > 0 && { EmailTags: emailTags }),
        }),
        Content: {
          Simple: {
            Subject: {
              Data: options.subject,
              Charset: 'UTF-8',
            },
            Body: {
              ...(htmlBody && {
                Html: {
                  Data: htmlBody,
                  Charset: 'UTF-8',
                },
              }),
              ...(textBody && {
                Text: {
                  Data: textBody,
                  Charset: 'UTF-8',
                },
              }),
            },
          },
        },
      });

      await this.sesClient.send(command);
      this.logger.log(`Email sent successfully to ${to.join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async renderTemplate(
    templateName: string,
    data: Record<string, any>,
  ): Promise<string> {
    try {
      let template = this.templateCache.get(templateName);

      if (!template) {
        const templatePath = path.join(
          this.templatesDir,
          `${templateName}.hbs`,
        );
        const templateContent = await fs.readFile(templatePath, 'utf-8');
        template = Handlebars.compile(templateContent);
        this.templateCache.set(templateName, template);
        this.logger.log(`Template loaded and cached: ${templateName}`);
      }

      // Add helper data like formatted timestamp
      const enrichedData = {
        ...data,
        processedAt: this.getBarbadosDateTime(),
      };

      return template(enrichedData);
    } catch (error) {
      this.logger.error(
        `Failed to render template ${templateName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get formatted Barbados datetime
   */
  private getBarbadosDateTime(): string {
    return new Date().toLocaleString('en-BB', {
      timeZone: 'America/Barbados',
    });
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  clearTemplateCache(): void {
    this.templateCache.clear();
    this.logger.log('Template cache cleared');
  }
}
