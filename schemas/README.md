# Form Schemas

This directory contains JSON schema definitions for all available forms in the system.

## Schema Structure

Each form schema follows this structure:

```json
{
  "id": "unique-form-id",
  "name": "Human Readable Form Name",
  "description": "Description of the form's purpose",
  "fields": [...],
  "processors": [...]
}
```

### Field Types

- `string` - Text input
- `email` - Email address (with built-in validation)
- `number` - Numeric input
- `boolean` - Checkbox/toggle
- `date` - Date input
- `textarea` - Multi-line text
- `select` - Dropdown selection

### Validations

Fields support these validation rules:

- `min` - Minimum value/length
- `max` - Maximum value/length
- `regex` - Regular expression pattern
- `message` - Custom error message

### Processors

Processors are executed after successful validation:

- `email` - Send email notifications

### Secret Variables

Use `{{db:key}}` or `{{db:formId:key}}` to reference database secrets:

```json
{
  "type": "email",
  "config": {
    "to": "{{db:admin_email}}",
    "from": "{{db:sender_email}}"
  }
}
```
