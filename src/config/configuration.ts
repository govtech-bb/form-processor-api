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
      endpoint: process.env.AWS_SES_ENDPOINT, // Custom endpoint for local development (e.g., aws-ses-v2-local)
    },
    s3: {
      bucketName: process.env.BUCKET_NAME,
      bucketRegion:
        process.env.BUCKET_REGION || process.env.AWS_REGION || 'us-east-1',
    },
  },
  email: {
    templatesDir: process.env.EMAIL_TEMPLATES_DIR || 'src/email/templates',
  },
  forms: {
    schemasDir: process.env.FORM_SCHEMAS_DIR || 'schemas',
  },
  googleSheets: {
    awsSecretName:
      process.env.GOOGLE_SHEETS_AWS_SECRET_NAME || 'google-service-account-key',
    ...(() => {
    // Support full service account JSON via GOOGLE_SHEETS_CREDENTIALS
    // Can be raw JSON or base64-encoded JSON
    // Set using: cat service-account.json | jq -c . | base64
    const credentialsEnv = process.env.GOOGLE_SHEETS_CREDENTIALS;
    if (credentialsEnv) {
      try {
        let credentialsJson = credentialsEnv;

        // Check if it's base64-encoded (doesn't start with '{')
        if (!credentialsEnv.trim().startsWith('{')) {
          credentialsJson = Buffer.from(credentialsEnv, 'base64').toString(
            'utf-8',
          );
        }

        const credentials = JSON.parse(credentialsJson);
        return {
          clientEmail: credentials.client_email,
          privateKey: credentials.private_key,
        };
      } catch (e) {
        console.error('Failed to parse GOOGLE_SHEETS_CREDENTIALS:', e);
      }
    }

    // Fallback to separate environment variables
    const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    return {
      clientEmail: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      privateKey: key ? key.replace(/\\n/g, '\n') : undefined,
    };
  })(),
  },
  ezpay: {
    apiKey: process.env.EZPAY_API_KEY || 'HWqgTn5EXIHLAzVjXtGpB2mIjgQgj0Ql', // Default API key for backward compatibility
    baseUrl: process.env.EZPAY_BASE_URL || 'https://test.ezpay.gov.bb',
    webhookSecret: process.env.EZPAY_WEBHOOK_SECRET,
    // Department-specific API keys
    departmentApiKeys: {
      ministry_of_youth: process.env.EZPAY_MINISTRY_OF_YOUTH_API_KEY,
      town_and_country: process.env.EZPAY_TOWN_AND_COUNTRY_API_KEY,
      licensing_authority: process.env.EZPAY_LICENSING_AUTHORITY_API_KEY,
      immigration_department: process.env.EZPAY_IMMIGRATION_DEPARTMENT_API_KEY,
      ministry_of_transport_and_works:
        process.env.EZPAY_MINISTRY_OF_TRANSPORT_AND_WORKS_API_KEY,
      government_electrical_engineering_department:
        process.env.EZPAY_GOVERNMENT_ELECTRICAL_ENGINEERING_DEPARTMENT_API_KEY,
      revenue_authority: process.env.EZPAY_REVENUE_AUTHORITY_API_KEY,
      ministry_of_agriculture:
        process.env.EZPAY_MINISTRY_OF_AGRICULTURE_API_KEY,
      oag_registration: process.env.EZPAY_OAG_REGISTRATION_API_KEY,
      default: process.env.EZPAY_API_KEY || 'HWqgTn5EXIHLAzVjXtGpB2mIjgQgj0Ql',
    },
  },
});
