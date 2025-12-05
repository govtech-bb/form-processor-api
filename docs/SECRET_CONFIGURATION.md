# Secret Configuration System

This document explains how the secret configuration system works in the Forms Processor API, including database table design, secret extraction mechanisms, and usage patterns.

## Overview

The secret configuration system allows forms to securely store and retrieve sensitive configuration values (like admin email addresses, API keys, etc.) from the database rather than hardcoding them in form schemas. This enables:

- **Security**: Sensitive values are stored in the database, not in version control
- **Environment-specific configs**: Different values for dev, staging, production
- **Dynamic updates**: Configuration can be changed without redeploying
- **Centralized management**: All secrets managed in one place

## Database Table Design

### Form Configs Table

The `form_configs` table stores key-value pairs of configuration secrets for each form:

```sql
CREATE TABLE form_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    form_id VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(form_id, key)
);
```

#### Table Schema Details

| Column        | Type         | Description                                              |
| ------------- | ------------ | -------------------------------------------------------- |
| `id`          | UUID         | Primary key, auto-generated                              |
| `form_id`     | VARCHAR(255) | Identifier for the form (e.g., "project-protege-mentor") |
| `key`         | VARCHAR(255) | Configuration key name (e.g., "admin_email")             |
| `value`       | TEXT         | The actual secret value                                  |
| `description` | TEXT         | Optional description of what this config is for          |
| `created_at`  | TIMESTAMP    | When the config was created                              |
| `updated_at`  | TIMESTAMP    | When the config was last modified                        |

#### Unique Constraint

The table has a unique constraint on `(form_id, key)` combination, ensuring each form can only have one value per configuration key.

## Secret Extraction Mechanism

### Variable Replacement Process

The system processes secrets during form submission through the following flow:

1. **Form Schema Loading**: Form schemas are loaded from JSON files
2. **Secret Resolution**: When processing form submissions, secrets are resolved
3. **Variable Replacement**: Database secrets and form data are replaced in processor configs
4. **Processor Execution**: Processors run with fully resolved configurations

### Secret Pattern Syntax

The system supports two patterns for database secrets:

#### 1. Shorthand Pattern: `{{db:key}}`

Uses the current form's ID to look up the secret:

```json
{
  "to": "{{db:admin_email}}"
}
```

For form ID "project-protege-mentor", this resolves to the value stored with:

- `form_id`: "project-protege-mentor"
- `key`: "admin_email"

#### 2. Full Pattern: `{{db:formId:key}}`

Explicitly specifies both form ID and key:

```json
{
  "to": "{{db:project-protege-mentor:admin_email}}"
}
```

This allows referencing secrets from other forms.

### Implementation Details

The secret resolution is handled by the `FormUtilsService`:

```typescript
/**
 * Replace database secret patterns in a string
 */
private async replaceDbSecrets(formId: string, value: string): Promise<string> {
  const regex = /\{\{db:([^}]+)\}\}/g;
  let result = value;

  const matches = value.matchAll(regex);
  for (const match of matches) {
    const parts = match[1].split(':');
    let targetFormId: string;
    let targetKey: string;

    if (parts.length === 1) {
      // Shorthand: {{db:key}} - use current formId
      targetFormId = formId;
      targetKey = parts[0];
    } else {
      // Full format: {{db:formId:key}}
      targetFormId = parts[0];
      targetKey = parts[1];
    }

    const secretValue = await this.getSecret(targetFormId, targetKey);
    result = result.replace(match[0], secretValue);
  }

  return result;
}
```

### Database Query

Secrets are retrieved using TypeORM:

```typescript
private async getSecret(formId: string, key: string): Promise<string> {
  const config = await this.formConfigRepository.findOne({
    where: { formId, key },
  });

  if (!config) {
    this.logger.warn(`Secret not found: ${formId}:${key}`);
    return `{{db:${formId}:${key}}}`; // Return placeholder if not found
  }

  return config.value;
}
```

## Usage in Forms

### Form Schema Example

Here's how secrets are used in a form schema:

```json
{
  "id": "project-protege-mentor",
  "name": "Project Protege Mentor Registration",
  "processors": [
    {
      "type": "email",
      "config": {
        "to": "{{db:project-protege-mentor:admin_email}}",
        "subject": "New Mentor Registration - {{formData.personal.firstName}} {{formData.personal.lastName}}",
        "template": "project-protege-mentor"
      }
    },
    {
      "type": "email",
      "config": {
        "to": "{{formData.contact.email}}",
        "subject": "Application Received - Government of Barbados",
        "template": "project-protege-mentor-receipt"
      }
    }
  ]
}
```

### Processing Flow

1. **Form Submission**: User submits form data
2. **Validation**: Data is validated against form schema
3. **Secret Resolution**: `getSchemaWithSecrets()` is called to resolve database secrets
4. **Variable Replacement**: Both database secrets (`{{db:...}}`) and form data (`{{formData...}}`) are replaced
5. **Processor Execution**: Email processor receives fully resolved configuration

### Example Database Records

For the above form to work, you would need these database records:

| form_id                | key          | value          | description                           |
| ---------------------- | ------------ | -------------- | ------------------------------------- |
| project-protege-mentor | admin_email  | admin@gov.bb   | Email address for admin notifications |
| project-protege-mentor | sender_email | noreply@gov.bb | Default sender email address          |

## Form Data Variables

The system also supports form data variables alongside database secrets:

### Syntax: `{{formData.fieldName}}`

```json
{
  "subject": "New Registration - {{formData.personal.firstName}} {{formData.personal.lastName}}",
  "to": "{{db:admin_email}}"
}
```

### Nested Field Access

Supports dot notation for nested objects:

```json
{
  "body": "Contact: {{formData.contact.email}} from {{formData.contact.parish}}"
}
```

## Error Handling

### Missing Secrets

When a secret is not found in the database:

- A warning is logged
- The original placeholder is returned (e.g., `{{db:form-id:missing-key}}`)
- Processing continues (may cause processor failures)

### Missing Form Data

When form data fields are not found:

- A warning is logged
- The placeholder is removed from the string
- Processing continues

## Configuration Management

### Adding New Secrets

To add a new secret configuration:

1. **Direct Database Insert**:

```sql
INSERT INTO form_configs (form_id, key, value, description)
VALUES ('project-protege-mentor', 'admin_email', 'admin@gov.bb', 'Admin notification email');
```

2. **Via Application**: You would need to create an admin interface or migration script.

### Updating Secrets

```sql
UPDATE form_configs
SET value = 'new-admin@gov.bb', updated_at = CURRENT_TIMESTAMP
WHERE form_id = 'project-protege-mentor' AND key = 'admin_email';
```

### Environment-Specific Values

Different environments can have different database contents:

**Development**:

```sql
INSERT INTO form_configs VALUES
  (uuid_generate_v4(), 'project-protege-mentor', 'admin_email', 'dev-admin@localhost', 'Development admin email', NOW(), NOW());
```

**Production**:

```sql
INSERT INTO form_configs VALUES
  (uuid_generate_v4(), 'project-protege-mentor', 'admin_email', 'admin@gov.bb', 'Production admin email', NOW(), NOW());
```

## Monitoring and Troubleshooting

### Common Issues

1. **Secret Not Found**: Check if the record exists in `form_configs` table
2. **Wrong Form ID**: Verify the `form_id` matches the schema ID exactly
3. **Case Sensitivity**: Keys and form IDs are case-sensitive
4. **Typos in Placeholders**: Ensure proper syntax `{{db:key}}` or `{{db:formId:key}}`

## Best Practices

1. **Consistent Naming**: Use descriptive, consistent key names across forms
2. **Documentation**: Always include meaningful descriptions for secrets
3. **Environment Separation**: Never share secrets between environments
4. **Regular Audits**: Periodically review and clean up unused secrets
5. **Backup Strategy**: Include secret configurations in backup and disaster recovery plans
