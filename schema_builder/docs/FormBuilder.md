# Form Builder

If you haven't, please refer to the [Recipe Information](./RecipeInformation.md) for context about what we're doing here.

Now that we have outlined the modules that can be compose a Form Recipe, next is determining how the server should take the modulated schema, and apply the modulations.

These Recipes, should be built, and stored in the `schema_builder/recipes/` directory.

Given that the initial schema can be written using what we will refer to as "Recipe Notation", we need to first resolve all the references, apply the values, and create the final shareable schema.

For example, if we have a form defined as:

```yaml
formId: validFormId
title: Valid Form Title
elements:
  ref: components/IdNumber
```

Then this should be evaluated to be:

```yaml

formId: validFormId
title: Valid Form Title
elements:
  - type: component
    meta:
     extends: fields/text
     id: "id-number"
    content:
     label: "ID Number"
     placeholder: "XXXXXX-XXXX"
    validation:
     pattern: "^[0-9]{6}-[0-9]{4}$"
     skipIfHasValue: "passportNumber"
    ui:
     width: "short"
```

Then, we can turn the components into fields, giving:

```yaml

formId: validFormId
title: Valid Form Title
elements:
  - type: fields/text
    meta:
     htmlType: text
     id: "idNumber"
    content:
     label: "ID Number"
     placeholder: "XXXXXX-XXXX"
    validation:
      required: true
     pattern: "^[0-9]{6}-[0-9]{4}$"
     skipIfHasValue: "passportNumber"
    ui:
     width: "short"
```

Essentially, the process is to go from blocks -> components -> fields, applying any context variable substitutions.

## Handling IDs

Field IDs are a curious sort, given their optionally generated nature. As such, we will need to have rules that govern how they are created, and accessed.

Note: IDs should ALWAYS be camelCase.

In this system, how Field IDs are accessed will differ based on whether the form they are being used in is a single page (using elements), or consists of multiple pages (using pages).

In a single page form, IDs will be as they are defined / generated. However, in forms with multiple pages, field IDs will be prepended with the ID of the page the fields are on.

For example:

```yaml
formId: myForm
title: My Form
pages:
  - pageId: applicant
    elements:
      - ref: fields/text
        meta:
          id: firstName
  - pageId: reference
    elements:
      - ref: fields/text
        meta:
          id: firstName
```

The first `firstName` field would be accessed as: `applicant.firstName`, and the second would be referred to as `reference.firstName`.

When receiving a payload from a client, this relationship should be expressed as a nested object, for example:

```json
{
  "applicant": {
    "firstName": "Value for name"
  },
  "reference": {
    "firstName": "Value for name"
  }
}
```

### Setting IDs

These IDs can be applied as meta values for either a component, or a field directly. Recall, the purpose of the builder is to take blocks and components to become fields, as such, the id defined at the component level, will be the ID given to the field.

For example:

```yaml
---
type: component
meta:
 componentName: idNumber
 extends: fields/text
 id: theIDNumber
```

Will evaluate into a field structured as:

```yaml
---
type: field
meta:
 htmlType: text
 id: theIDNumber
```

### Rules for IDs

IDs must satisfy the expression: `^[a-z][a-zA-Z0-9]*$`.
That is, the first character must be a lowercase alphabetical character, and subsequent characters can be alphanumerical. No special symbols such as hyphens, underscores, etc., are allowed. Ideally, IDs should also be camelCased.

### Generating IDs

To reduce the need for redundant rewriting, at the expense of potentially introducing ambiguity, if no meta.id value is provided at any level (component or field), or an empty string is passed for meta.id, then the id for the field is generated using the label field, converting the space delimited text, into camelCase. For example:

```
formId: myForm
elements:
  - ref: components/idNumber
    meta:
     id: ""
    content:
```

Since we explicitly pass an empty string as the meta.id value, we are essentially telling the builder to use a camel cased "ID Number" (that being idNumber) as the id for the field. However, ideally, we would want IDs to be implemented at the component level. For example:

```
type: component
meta:
 componentName: idNumber
 id: "idNumber"
```

And if necessary, explicitly overridden.
The only time these should be overridden however, is in the situation where multiple of the same component are used on the same page, since on different pages, they will be identified as `pageId.fieldId`.

For example:

```
formId: myForm
elements:
  - ref: components/userName
    meta:
     id: firstName
    content:
     label: "First Name"
  - ref: components/userName
    meta:
     id: lastName
    content:
     label: "Last Name"
```

In this case, we use the `userName` component, a component that wraps `fields/text`, and provides simple name validation rules, twice. As such, we explicitly defined the meta.id for each of the fields.
However, generic validation components such as userName, should be defined as follows:

```
type: component
meta:
 componentName: userName
 id: ""
validation:
 pattern: "^[a-zA-Z- ]$"
```

Notice how id is set to an empty string. This means that when using the component, instead of explicitly defining the id and the label, we can only provide the label, and have the ID be generated for it. This turns our earlier example into:

```
formId: myForm
elements:
  - ref: components/userName
    content:
     label: "First Name"
  - ref: components/userName
    content:
     label: "Last Name"
```

Resulting in the IDs being generated to be "firstName" and "lastName".
However, as you may imagine, this may also introduce ambiguity for the human or AI building forms, as it requires you to check whether component.meta.id, and by extension field.meta.id is set to an empty value / not defined.
As such, when using components, always explicitly set an ID, or explicitly set the meta.id to an empty string.
Of course, this is only for schema building purposes, as once the schema is built, interactions proceed programmatically.

### ID Prefixes

In some cases, we may want to have multiple of the same block on the same page. I'm not sure of a usecase, but we will cover that possibility regardless.

Blocks will have support for an `idPrefix` field defined in their meta information.

This will be a string value, and will be prefixed to the ids of all elements of the block, BEFORE page prefixes are applied.

For example:

```yaml
---
type: block
meta:
  blockName: SampleBlock
  idPrefix: sample_
elements:
  - ref: fields/text
    meta:
      id: myField
```

The field with id `myField`, will have its id value updated to be `idPrefix_id`, in this case, that will give us `sample_myField`.

> [!NOTE]
> idPrefixes should end with an underscore, to make it still reading friendly, and compatible with being the id of an HTML field.

Now, as we will examine later, blocks and components are all flattened to be their `field` form, when the schema is created from the recipe.

However, it is to be noted, that this will require a payload to be sent as follows:

```json
{
  "myPage": {
    "sample_myField": "my value"
  }
}
```

The reason I choose this method, is because you currently cannot change the ID of a specific component when using a `ref` to a block.

## Context and Template Strings

Fields, Components, and Blocks all have support for template strings.
These are string values assigned to fields, that are meant to be replaced with a value.

There are currently three (3) types of these template strings.

- Context
- Field
- Processor

Context template strings look like `{!Variable}`, uniquely identified by the presence of the `!` right after the `{`. These strings get their values from a `context` property provided to the block, component, or field.

For example, a component defined as:

```yaml
type: component
meta:
  componentName: address
  extends: fields/text
content:
  label: '{!PERSON} address'
```

Can be used, and a value provided, for example, as follows:

```yaml
type: block
elements:
  - ref: component/address
    context:
      PERSON: "Your father's"
```

On form schema generation, the `{!PERSON}` will be replaced with the provided value, setting the label to be "Your father's address". Context template strings will be resolved as soon as they appear.

Field template strings contain values that will be replaced by the value of a property defined on the current object.

As such, they will only be applied once the object is in its `field` form.

Field template strings are denoted with `{#Variable#}`. Note the enclosing `{##}`.

A good example for field template strings, are for error messages. For example:

```yaml
type: field
meta:
  fieldName: numericText
  htmlType: text
validation:
  pattern: '^[0-9]$'
  errorMessage: '{#content.label#} only accepts digits'
```

This will then look for and apply the value of `content.label`. For example, given:

```yaml
type: component
meta:
  extends: field/numericText
content:
  label: ID Number
```

When the builder builds the component, into its field form, and then evaluates the field template string, then the `errorMessage` will become "ID Number only accepts digits."

Lastly, Processor template strings are denoted with `{{}}`.

Processor template strings gain access to communicating with pre-defined external interfaces, such as a database, along with accessing values from the submitted payload.

As such, processor template strings are not evaluated at all, until a processor processes them.
Similarly, they are only present in the `processors` part (section dedicated to form post-processors) of a form recipe.

## Post Processors

Once a form has been successfully submitted, and the data passes validation, post-processors are applied.

These are additional functionality that can be performed once a submitted form's information is correct.

For example, sending an email to the applicant.

```yaml
formId: myForm
elements: []
processors:
  - ref: processors/email
    config:
      to: '{{formData.contactDetails.email}}'
      subject: 'My Form - Submission Received'
```

Processors are defined in `registry/processors`.

Also present in `schema_builder/registry/processors`, is `confirmation`, which defines a reusable template for confirmation screens.

Similar to other components, the values are overridden by including it again as follows:

```yaml
formId: myForm
elements: []
processors: []
confirmation:
  description: 'This will override the default value.'
```

## Creating the Form Schema

So far, we would have been working with Form Recipes, identifiable by keywords such as `ref` and `extends`.

However, this recipe is only for our convenience as form builders.
We now need a schema that can actually be sent to a client, such that the client can implement it, and send us back a payload.

The primary purpose of this Form Builder, is to turn a Recipe into a JSON schema, that can be shared.

A Form Schema should only consist of fields, meaning that all components, and blocks will be evaluated down to their field forms.

For example, given the following recipe:

```yaml
---
formId: myForm
elements:
  - ref: components/userName
    content:
      label: 'First Name'
  - ref: components/email
    content:
      label: 'Email Address'
```

The builder should turn it into the following JSON schema:

```json
{
  "formId": "myForm",
  "fields": [
    {
      "htmlType": "text",
      "id": "firstName",
      "content": {
        "label": "First Name"
      },
      "validation": {
        "pattern": "^[a-Z]$"
      }
    },
    {
      "htmlType": "text:email",
      "id": "emailAddress",
      "content": {
        "label": "Email Address"
      },
      "validation": {
        "pattern": "^.*@.*..*$"
      }
    }
  ]
}
```

In this section, we will outline the rules for how the form builder will go from Recipe to Schema.

This will be broken into the following steps (until a field is obtained):

1. If using `pages`, the following steps are applied to each page.
1. Store any `context` values, for context template substitutions.
1. Apply all substitutions for any context template strings with their values.
1. Evaluate each `Block`:
1. If a `Block` is the only entry for a page, then set `pageTitle` and `pageDescription` to `block.content.pageTitle` and `block.content.pageDescription` (if applicable).
1. If a `Block` has `repeatable` meta information, apply that to the entire page, if no `repeatable` meta information for the page is explicitly set.
1. Evaluate each of the `Block`'s `element`s, converting them into their `Component` form, including nested blocks.
1. With only components and / or fields left in the recipe, apply all template substitions, if any are left.
1. Evaluate each component, converting them into fields, and applying their values.
1. With only fields left, apply all substitutions if any are left.
1. Process each field.
1. If the id value for a field is empty, then generate the ID from a camelCased `label`.


    - If no `label` is provided, then throw an exception indicating that a field without an ID is illegal

1. If `options` are present, and the value matches `constants/fileName`, then fetch the values from that file, and set them as KV pairs.
1. If `options` are present, but is an array of strings, then convert the array of strings, into an array of 2-key objects, where `label` is the provided string, and `value` is `label`, but lowercased, without any special characters (except spaces), and then with spaces replaced with hyphens (-).
1. Apply any field substitutions.
1. For the final pass, move the properties inside `meta`, to be at the root of their field object.
1. Convert `elements` to `fields`.

Note: Blocks can contain blocks, components, or fields, and components may only contain fields. Similarly, a block may not contain a nested reference to itself. However, two of the same blocks con exist on the same page, given an `idPrefix` is applied in the meta field of the block.

Once Recipes are converted into schemas, these schemas are stored in `/schema_builder/schemas/`

## Running the Service

The Form Builder is implemented as a TypeScript CLI service that transforms YAML/JSON recipes into JSON schemas.

Note: This is currently setup to be run from the `/schema_builder` directory.

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

```bash
npm install
```

### Available Commands

#### Validate a Recipe

Check if a recipe file is valid without building it:

```bash
npm run validate -- <recipe-file>
```

Example:

```bash
npm run validate -- recipes/permission-to-remove-tree.yaml
```

#### Build a Single Recipe

Transform a recipe into a JSON schema:

```bash
npm run build-recipe -- <recipe-file> [options]
```

Options:

- `-o, --output <path>` - Output file path (default: stdout)
- `-r, --registry <path>` - Registry directory path (default: ./registry)
- `-v, --verbose` - Enable verbose output

Examples:

```bash
# Build and output to file
npm run build-recipe -- recipes/my-form.yaml -o schemas/my-form.json

# Build with verbose output
npm run build-recipe -- recipes/my-form.yaml -o schemas/my-form.json -v

# Build with custom registry
npm run build-recipe -- recipes/my-form.yaml -r ./custom-registry -o schemas/my-form.json
```

#### Build All Recipes

Build all recipes in the recipes directory:

```bash
npm run build-all
```

This will process all `.yaml`, `.yml`, and `.json` files in the `recipes/` directory and output schemas to the `schemas/` directory.

### Development Mode

For development with automatic reloading:

```bash
npm run dev
```

### Project Structure

```
schema_builder/
├── recipes/              # Input recipe files (YAML/JSON)
├── registry/             # Registry of reusable components
│   ├── fields/          # Base field definitions
│   ├── components/      # Component definitions (extend fields)
│   ├── blocks/          # Block/section definitions
│   ├── constants/       # Constant values (options for selects)
│   └── processors/      # Post-processor definitions
├── schemas/             # Output JSON schemas
└── src/                 # Source code
    ├── cli.ts          # CLI entry point
    ├── builder/        # Builder modules
    ├── parser/         # YAML/JSON parsers
    ├── registry/       # Registry loader
    ├── types/          # TypeScript types
    └── utils/          # Utility functions
```

### Build Pipeline

The builder processes recipes through the following pipeline:

1. **Parse** - Parse YAML/JSON recipe files
2. **Load Registry** - Load fields, components, blocks, and constants
3. **Resolve References** - Resolve `ref:` to actual definitions
4. **Process Context** - Substitute `{!variable}` context templates
5. **Expand Components** - Merge components with their base fields
6. **Generate IDs** - Generate IDs from labels when not provided
7. **Process Field Templates** - Substitute `{#field#}` templates
8. **Resolve Options** - Load constants and convert string arrays to KV pairs
9. **Assemble Schema** - Flatten to final JSON schema format

### Error Handling

The builder provides clear error messages for common issues:

- **Missing context variables** - Warning is issued, replaced with empty string
- **Missing field labels/IDs** - Error with field location details
- **Circular references** - Detected and reported with reference chain
- **Invalid registry references** - Error indicating which reference failed

### Output Format

Single-page forms output a flat array:

```json
{
  "formId": "myForm",
  "type": "single",
  "fields": [
    { "id": "firstName", "htmlType": "text", ... }
  ]
}
```

Multipage forms output an array, with fields nested in pages:

```json
{
  "formId": "myForm",
  "type": "multi",
  "fields": [
    {
      "id": "Page ID",
      "title": "Page Title",
      "description": "Page description",
      "fields": [
        { "id": "page1.firstName", "htmlType": "text", ... },
        { "id": "page1.lastName", "htmlType": "text", ... }
      ]
    },
    {
      "id": "Page ID 2",
      "title": "Page Title",
      "description": "Page description",
      "fields": [{ "id": "page2.firstName", "htmlType": "text", ... }]
    }
  ]
}
```

Note: We also add a meta field called `type` to clearly indicate whether the form is a single page form, or a multipage form.

## Next Readings

For next readings, refer to [Form Processor](./FormProcessor.md)
