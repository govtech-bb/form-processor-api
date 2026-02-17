# Form Builder

If you haven't, please refer to the [README](./README.md) for context about what we're doing here.

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
ref: components/idNumber
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
ref: components/userName
  meta:
   id: firstName
  content:
   label: "First Name"
ref: components/userName
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
ref: components/userName
  content:
   label: "First Name"
ref: components/userName
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
      label: "First Name"
  - ref: components/email
    content:
      label: "Email Address"
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
        "pattern": "^.*@.*\..*$"
      }
    }
  ]
}
```

In this section, we will outline the rules for how the form builder will go from Recipe to Schema.

This will be broken into the following steps (until a field is obtained):

1. If using `pages`, the following steps are applied to each page.
1. Store any `context` values, for template substitutions.
1. Apply all substitutions for any template strings with the values.
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
1. For the final pass, move the properties inside `meta`, to be at the root of their field object.
1. Convert `elements` to `fields`.

Note: Blocks can contain blocks, components, or fields, and components may only contain fields. Similarly, a block may not contain a nested reference to itself. However, two of the same blocks con exist on the same page, given an `idPrefix` is applied in the meta field of the block.

Once Recipes are converted into schemas, these schemas are stored in `/schema_builder/schemas/`

## Next Readings

For next readings, refer to [Form Processor](./FormProcessor.md)
