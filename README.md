# Forms Processor API

A flexible, schema-driven formdata processing system that validates submissions against JSON schemas and executes configurable processor pipelines.

## 📋 Architecture

```
┌─────────────────────────────────────────────────┐
│        Form Schema (JSON File)                  │
│  Defines fields, validations & processors       │
└───────────────┬─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────┐
│       POST /api/forms/:formId/submit            │
└───────────────┬─────────────────────────────────┘
                │
                ▼
        ┌───────────────┐
        │  Validation   │ (Zod Schema Builder)
        │    Engine     │
        └───────┬───────┘
                │
        ┌───────┴───────┐
        │               │
    ✅ Valid        ❌ Invalid
        │               │
        ▼               ▼
┌─────────────┐   ┌─────────────┐
│ Processors  │   │   Return    │
│  Pipeline   │   │   Errors    │
│ (Parallel)  │   └─────────────┘
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Email     │
│ Notification│
└─────────────┘
```

## 🛠️ Tech Stack

- **Framework**: NestJS 9.x
- **Database**: PostgreSQL
- **Validation**: Zod 4.x for schema validation
- **Email**: AWS SES v2 SDK
- **Templating**: Handlebars for HTML email templates
- **Language**: TypeScript 5.x

## 📦 Installation

### Prerequisites

- Node.js >= 20.x
- PostgreSQL
- AWS Account with SES configured

### Setup

1. **Clone and install dependencies**:

```bash
npm install
```

2. **Create environment file**:

```bash
cp .env.example .env
```

3. **Set up the database**:

```bash
# Create database
createdb forms_processor_db

# Run migrations
npm run migration:run

# Seed initial data
npm run seed:run
```

5. **Start the development server**:

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/api`

## 📝 API Usage

## 📋 Creating Form Schemas

Form schemas are JSON files in the `schemas/` directory. Here's a minimal example:

```json
{
  "id": "contact-form",
  "name": "Contact Form",
  "description": "Basic contact form",
  "fields": [
    {
      "name": "email",
      "type": "email",
      "required": true
    },
    {
      "name": "message",
      "type": "string",
      "required": true,
      "validations": {
        "min": 10,
        "max": 1000
      }
    }
  ],
  "processors": [
    {
      "type": "email",
      "config": {
        "to": "{{db:contact-form:admin_email}}",
        "subject": "New Contact Form Submission",
        "template": "contact-submission"
      }
    }
  ]
}
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Database Migrations

```bash
# Generate migration
npm run migration:generate -- -n MigrationName

# Run migrations
npm run migration:run

# Revert migration
npm run migration:revert
```

## 🤝 Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make your changes and test thoroughly
3. Commit with conventional commits: `feat: add new processor type`
4. Push and create a pull request

## 📄 License

MIT

## 🆘 Support

For issues and questions:

- Create an issue in the repository
- Contact the development team
