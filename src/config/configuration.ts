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
      post_office: process.env.EZPAY_OAG_REGISTRATION_API_KEY, //TODO: Update when we get the correct API key
      default: process.env.EZPAY_API_KEY || 'HWqgTn5EXIHLAzVjXtGpB2mIjgQgj0Ql',
    },
  },
  opencrvs: {
    authBaseUrl:
      process.env.OPENCRVS_AUTH_URL || 'https://auth.barbados-qa.opencrvs.org',
    eventsBaseUrl:
      process.env.OPENCRVS_EVENTS_URL ||
      'https://register.barbados-qa.opencrvs.org',
    locationsBaseUrl:
      process.env.OPENCRVS_LOCATIONS_URL ||
      'https://gateway.barbados-qa.opencrvs.org',
    // Authentication credentials
    clientId: process.env.OPENCRVS_CLIENT_ID,
    clientSecret: process.env.OPENCRVS_CLIENT_SECRET,
    // Default location names (resolved to IDs at runtime)
    defaultOfficeName:
      process.env.OPENCRVS_DEFAULT_OFFICE ||
      'Registration Department Records Branch',
    defaultHealthFacilityName: process.env.OPENCRVS_DEFAULT_HEALTH_FACILITY,
    defaultParishName: process.env.OPENCRVS_DEFAULT_PARISH || 'Christ Church',
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    namespace: process.env.METRICS_NAMESPACE || 'FormsProcessor/Submissions',
    environment: process.env.NODE_ENV || 'development',
  },
});
