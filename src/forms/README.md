# Form Services

This document seeks to outline how the form services work.

## Expression Resolver

Form fields, particularly in the processors for schemas, can have "dynamic" fields that need to be resolved.  
For this, we make use of an expression resolver, located in `./expression-resolver.service.ts`.

An example processor that leverages an expression resolver is as follows:

```json
  "processors": [
    {
      "type": "email",
      "config": {
        "to": "{{db:project-protege-mentor:admin_email}}",
        "subject": "New Project Protege Mentor Registration - {{formData.personal.firstName}} {{formData.personal.lastName}}",
        "template": "project-protege-mentor"
      }
    },
  ]
```

Here, the `to` field will make a call to the database, checking the table `project-protege-mentor`, and accessing the field called `admin_email`, extracting the related value.

The `subject` field leverages a provided context state called `formData`, which will be populated with the data submitted to the form. In this case, the `subject` title will have the `personal.firstName` and `personal.lastName` fields evaluated to the submitted values.

The expression resolver leverages context referred to as `ExpressionContext`, that is passed along with each expression to evaluate.

This `ExpressionContext` has the following structure:

```ts
interface ExpressionContext {
  formId: string;
  formData?: Record<string, any>;
  secrets?: Map<string, string>;
  configRepository?: Repository<FormConfig>;
}
```

Where:

- `formId`: is the ID of the form
- `formData` is the submitted response
- `secrets`: is (insert brief description)
- `configRepository`: is (insert brief description)

### Types of Expressions

Currently, there are 3 types of expressions that the expression resolver resolves.

1. Database calls
1. Form Data retrieval
1. Constant Data Retrieval

All expressions are presented in double curly braces: `{{example expression}}`

#### Database Calls

There are times when a processor will need to access a value from the database, to use as a value.
For example, accessing an `admin_email` to use as a `to` value in an email processor.

```json
{
  "type": "email",
  "config": {
    "to": "{{db:project-protege-mentor:admin_email}}"
  }
}
```

As mentioned prior, you can access a value from the database by providing an expression that matches the format `{{db:table-name:column-name}}`.

This will retrieve the value from the database, and replace the expression with that value.

#### Form Data Retrieval

There will be times when a processor will need a value from the submitted form response, to perform some action.

For example:

```json
{
    "id": "some-form-id",
    "name": "Example Form Name",
    "description": "",
    "fields": [
        {
            "name": "email",
            "type": "string"
        }
        {
            "name": "applicant",
            "type": "object",
            "fields": [
                {
                    "name": "firstName",
                    "type": "string"
                }
            ]
        }
    ],
    "processors": [
        {
            "type": "email",
            "config": {
                "to": "{{formData.email}}",
                "subject": "Hello {{formData.applicant.firstName}}"
            }
        }
    ]
}
```

Accessing response data can be done by having an expression in the following format: `{{formData.fieldName}}`, where `fieldName` can be any object defined in the schema, derived from the `name` attributes.

#### External Data Retrieval

There are some situations where we might need to access an external value dependent on some submitted value.

For this purpose, we provide `./src/common/constants.ts`, which is a file containing constants that can be accessed by a processor.

Each value in the `constants.ts` is a key-value pair (`KVPair`).

> [!NOTE]
> I will definitely look to rename this at some point... maybe to External Data? Or something.

`constants.ts` exports a constant known as `constantData`, which contains a mapping of strings, to `KVPair`s defined.

To access this external data from a processor, we use the format of `{{constants:constantDataKey:kvpairKey}}`, where:

- `constantDataKey`: Is the key to access the `KVPair` containing the values we want
- `kvpairKey`: Is the key to access the value stored within the `KVPair`.

For example, `constants.ts` may look as follows:

```ts
// Type definitions above here
const myKVPair: KVPair = {
    "my-key": "my-value",
    "my-key-2": "my-value-2"
}

export const constantData: Record<string, KVPair> = {
    "myKVPair": myKVPair
}
```

Now, if we wanted to access the value `my-value-2` from the above example, for the subject of an email (for example), our expression would look like:  
`{{constants:myKVPair:my-key-2}}`.

An example processor could be:

```json
{
    "type": "email",
    "config": {
        "subject": "The value is: {{constants:myKVPair:my-key-2}}"
    }
}
```

### Combining Expressions

Expressions can be combined in the same expression `{{.*}}`, for more dynamic expression resolution, based on the order in which they are resolved.

For example, say we wanted to access an external value using a value provided from the user's form response, we could have an expression like:

`{{constants:myKVPair:formData.fieldName}}`, where `formData.fieldName` will get evaluated and resolved first, and then it's result will be used as `{{constants:myKVPair:submittedValue}}`.

The expression resolver resolves expressions in the following order:

1. Database access
1. Form Data value resolution
1. External / constant data access
