export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 3000,
    apiPrefix: process.env.API_PREFIX || 'api',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'forms_processor_db',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    ses: {
      fromEmail:
        process.env.AWS_SES_FROM_EMAIL || 'no-reply@notify.dev.alpha.gov.bb',
      configurationSet: process.env.SES_CONFIGURATION_SET,
      tagKey: process.env.SES_TAG_KEY || 'ses:configuration-set',
      tagValue: process.env.SES_TAG_VALUE || 'prod',
    },
  },
  email: {
    templatesDir: process.env.EMAIL_TEMPLATES_DIR || 'src/email/templates',
  },
  forms: {
    schemasDir: process.env.FORM_SCHEMAS_DIR || 'schemas',
  },
  ezpay: {
    apiKey: process.env.EZPAY_API_KEY || 'HWqgTn5EXIHLAzVjXtGpB2mIjgQgj0Ql',
    baseUrl: process.env.EZPAY_BASE_URL || 'https://test.ezpay.gov.bb',
    webhookSecret: process.env.EZPAY_WEBHOOK_SECRET,
  },
});
