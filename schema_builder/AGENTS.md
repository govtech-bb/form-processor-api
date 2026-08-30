# Form Recipe Builder

This document seeks to provide context for an AI agent, to be able to interact with the codebase to create a Recipe for a form, using proper recipe notation.

Recipes are the only thing you are allowed to build. Recipe Ingredients such as Fields, Components, Blocks, Processors and Constants are readonly and are to be used.

Each of these are configurable from within a recipe, and that is the only place where configuration should occur.

## Project Structure

The service is structured as follows:

- `./docs/`: Documentation containing information necessary to build a recipe.
- `./recipes/`: Location for JSON or YAML recipe files.
- `./registry/`: Registry for recipe ingredients.
- `./registry/blocks/`: Registry for reusable recipe Blocks.
- `./registry/components/`: Registry for reusable recipe components.
- `./registry/fields/`: Registry for reusable recipe fields.
- `./registry/constants/`: Registry for externally defined constants. (These are referenced in already defined components).
- `./registry/processors/`: Registry for reusable processor definitions.
- `./schemas/`: Location where Schema files generated from Recipes will be stored.

## Important Terminology

Before building Form Recipes, it is important to understand the following terminology:

- Recipe
- Field
- Component
- Blocks
- Processor
- Referencing
- Pages

This terminology is to provide context, however, you will be building recipes by using references, not creating new fields, components, and blocks.

### Recipe

A recipe refers to a YAML or JSON file, which uses recipe notation to define a user submittable form.
Recipes exist as a modular way to create forms consistently, by using smaller, predefined, configurable and reusable pieces, that can be shared amongst many forms, making updates to validations, or certain rules much easier to do.

An example recipe:

```json
{
  "formId": "camelCaseFormId",
  "title": "Title of the Form",
  "description": "Optional description / subtitle of the form",
  "pages": [
    {
      "pageId": "camelCasePageId",
      "pageTitle": "Title for the page",
      "pageDescription": "Optional description for the page.",
      "elements": [
        {
          "ref": "blocks/blockName"
        },
        {
          "ref": "components/componentName"
        }
      ]
    },
    {
      "pageId": "declaration",
      "pageTitle": "Declaration",
      "elements": [
        {
          "ref": "blocks/declaration"
        }
      ]
    }
  ],
  "processors": [
    {
      "ref": "processors/processorName",
      "config": {
        "key": "Value of config"
      }
    }
  ],
  "confirmation": {
    "title": "Thank you for your application",
    "description": "Sample subtitle for confirmation page.",
    "content": "Example confirmation message"
  }
}
```

As illustrated, a recipe is made up of the following components:

- formId that matches the filename
- title
- description
- pages: A list of objects that define a page / step in a multistep form.
- processors: List of actions that should be performed after a submitted form passes all validation requirements.
- confirmation: A page to show to the user once form was submitted successfully.

### Field

A field is the smallest ingredient for a Recipe, which is responsible for mapping directly to an HTML input element.
Note, you do NOT create fields, but simply reference them.

An example of a field:

```json
{
  "type": "field",
  "meta": {
    "htmlType": "text"
  },
  "validation": {
    "required": true,
    "maxLength": 200
  },
  "ui": {
    "width": "medium"
  }
}
```

Currently, the following fields are available:

- text: Represents a simple text field, with `maxLength = 200`.
- email: Represents an email field with simple validation.
- radio: Represents a radio field with options having values `yes` and `no`.
- select: Represents a select field.
- checkbox: Represents a checkbox field.
- file: Represents a file field
- number: Represents a field that only accepts numbers, with validation of `minValue = 0`.
- numericText: Represents a text field that accepts only numbers, with validation `pattern = "^[0-9]*$"`
- textArea: Represents a textarea with validation `maxLength = 400`.
- tel: Represents a telephone field, with simple validation.

Note: All fields have `validation.required = true`. Therefore, if a field is to be optional, `validation.required` must be set to `false` in the overriding information. Similarly, if a field is to be required, there is no need to explicitly set `validation.required`.

### Components

A component is a recipe ingredient that wraps a field, providing additional validation, meta, and content information.

Similarly, you are not to create any components, but simply reference them.

An example definition of a component:

```json
{
  "type": "component",
  "meta": {
    "extends": "fields/text",
    "componentName": "idNumber"
  },
  "content": {
    "label": "ID Number",
    "placeholder": "XXXXXX-XXXX"
  },
  "validation": {
    "pattern": "^[0-9]{6}-[0-9]{4}$"
  }
}
```

Currently, the following components are available to be referenced:

- accountType: A radio component with options with values: `checkings` and `savings`, to be used when requesting bank account information.
- address: Component that provides basic validation for addresses, with a default label of "Address". When using this component, the label should be overridden.
- country: A select field with the label "Country", and as options has the list of all countries. This can be used for Country and Nationality fields.
- dateOfBirth: Date field with validation ensuring the date is in the past.
- genericShortText: Text field with validations of `minLength=2;maxLength:20;pattern="^[a-z0-9]+$"`. Useful for fields that may need generic short text. (Label and ID MUST be set.)
- idNumber: Text field with validation for a Barbados ID Number.
- name: Text field with validations for names. This is to be used by overriding `id` and `label`, for the names of entities, such as First Name, Bank Name, etc.
- nisNumber: Text field with validation for a National Insurance (NIS) number.
- parish: Select field with options being all the parishes for Barbados.
- passportNumber: Text field with validation for a Passport Number.
- postcode: Text field with validation for a Barbadian Postal Code.
- sex: Select field with options with values `male`, `female` to use when requesting the gender/sex.
- tamisNumber: Text field with validation for a Barbadian Tax Identification (TAMIS) number.
- telephoneNumber: Text field with validation for a telephone number.
- title: Select field with options with values `mr`, `mrs`, `ms`.
- relationship: Select field with options outlining the different relationships between people.

Note, when a recipe is evaluated into a schema, all components are evaluated into their field forms, applying a deep merge. This will be explained further in the section titled references.

### Blocks

A block is the highest level of ingredient, and is typically a collection of components, designed to be used as is, or with less by way of the `meta.exclude field`.

Similarly, you are not to create blocks, but simply to reference them.

An example structure of a block is as follows:

```json
{
  "type": "block",
  "meta": {
    "blockName": "nameInformation"
  },
  "elements": [
    {
      "ref": "components/name",
      "meta": {
        "id": "firstName"
      },
      "content": {
        "label": "First name"
      }
    },
    {
      "ref": "components/name",
      "meta": {
        "id": "middleName"
      },
      "content": {
        "label": "Middle name(s)"
      },
      "validation": {
        "required": false
      }
    },
    {
      "ref": "components/name",
      "meta": {
        "id": "lastName"
      },
      "content": {
        "label": "Last name"
      }
    }
  ]
}
```

Current blocks available are:

- address: Block containing components with the following IDs `addressLine1`, `addressLine2`, `city`, `parish`, `country`, `postcode`. Note: addressLine2 has `required:false`.
- applicantIdentity: Contains components with ids `idNumber`, `passportNumber`, `nisNumber`, `tamisNumber`. Note, `idNumber` and `passportNumber` have `skipIfHasValue` on each other, meaning, that only one or the other is required.
- applicantInformation: Contains components with ids `title`, `dateOfBirth`, `sex`, `nationality`. Note `nationality` is a `country` component. This also contains a reference to the block `nameInformation`.
- bankInformation: Contains components with ids `accountHolderName`, `bankName`, `accountNumber`, `accountType`. Note, accountNumber is a `numericText` field.
- contact: Contains components with ids `email`, `homeTelephone`, `mobileTelephone`, `workTelephone`, `faxNumber`.
- criminalConvictions: Contains radio field with id `hasCriminalConvictions` and options with values `yes` and `no`.
- declaration: The final page of any form, that should stand alone.
- nameInformation: Contains components with the following IDs `firstName`, `middleName`, `lastName`. Note: `middleName` has `required=false`.
- otherInformation: Contains components with ids `firstName`, `middleName`, `lastName`, `idNumber`, `dateOfBirth`, `sex`, `relation`, `addressLine1`, `addressLine2`, `country`, `postcode`, `email`, `contactNumber`.
- simpleContact: Contains components with ids `email`, `telephoneNumber`

Note: Blocks can contain references to other blocks, however, components and fields, may NOT contain references to each other.

### Processors

When a form is submitted successfully, we may want to tell the server to perform additional actions, such as sending an email to the applicant, or requesting payment.

These postprocessing features, are accessed by defining `processors` on a recipe.

Example of a processor:

```json
{
  "type": "email",
  "config": {
    "to": "{{formData.applicant.email}}",
    "subject": "Form Submission",
    "body": "Body of email"
  }
}
```

Currently defined processors are:

- email: Used when an email needs to be sent.
- payment: Used when a payment needs to be made.

Processors consist of a type, and a config. However, for our purposes, you can just have a reference as follows, where config options will override the defaults:

```json
{
  "formId": "formId",
  "title": "",
  "description": "",
  "pages": [],
  "processors": [
    {
      "ref": "processors/email",
      "config": {}
    },
    {
      "ref": "processors/payment",
      "config": {}
    }
  ]
}
```

### Referencing

Recipes are built from ingredients, such as Fields, Components, and Blocks.

So far, we had examined how these ingredients are created, but not exactly how to use them in our recipe file.

To use ingredients, we make use of the `ref` keyword.

Example:

```json
{
  "formId": "exampleFormId",
  "title": "Title of the Form",
  "description": "Optional description / subtitle of the form",
  "pages": [
    {
      "pageId": "camelCasePageId",
      "pageTitle": "Title for the page",
      "pageDescription": "Optional description for the page.",
      "elements": [
        {
          "ref": "blocks/blockName"
        },
        {
          "ref": "components/componentName"
        },
        {
          "ref": "fields/fieldName"
        }
      ]
    },
    {
      "pageId": "declaration",
      "pageTitle": "Declaration",
      "elements": [
        {
          "ref": "blocks/declaration"
        }
      ]
    }
  ],
  "processors": [],
  "confirmation": {
    "title": "Thank you for your application",
    "description": "Sample subtitle for confirmation page.",
    "content": "Example confirmation message"
  }
}
```

A `ref` is made up of the `ingredientType/ingredientName`, where `ingredientType` is one of `fields`, `components`, `blocks`.

When referencing an ingredient, there are four categories of additional information that can be provided, referred to as `toppings`. These are:

- meta: Meta information
- content: This is visual information, like `options`, `label`, `hint`.
- validation: This contains validation rules.
- ui: This contains simple ui directives such as `width` and `disabled`.

For example, a field to get a user's favorite color:

```json
{
  "ref": "fields/text",
  "meta": {
    "id": "favoriteColor"
  },
  "content": {
    "label": "Your favorite color",
    "hint": "Enter your favorite color"
  },
  "validation": {
    "maxLength": 30,
    "required": true
  },
  "ui": {
    "width": "medium"
  }
}
```

When a recipe is converted to a schema, all blocks and components are taken down to their `field` form, using a deep merge strategy, applying the meta, content, validation, and ui properties.

#### Using Blocks

Blocks have support for the following properties that can be overridden for each `topping`.

Meta:

- exclude (list): List of IDs for components to exclude from the block when building.
- idPrefix (string): Prefix to prepend to the id of each component that makes up the block.

Content:

- title: Title for the block, that can be used as the page title.
- description: Description for the block that can be used as a subtitle.

#### Using Components and Fields

Components simply wrap fields, so when using them in recipes, they have the same properties that can be overridden for toppings.

Meta:

- id: ID the component / field should have and be referred to as.

Content:

- label: HTML Label to show for the field
- hint: Subtle hint text to display for a field.
- placeholder
- options: (For select and radio fields only).

Validation:

(Note: fieldID means that the value is the ID of another field.)

- minValue (int): the minimum numerical value to be accepted.
- maxValue (int): The maximum numerical value to be accepted.
- minLength (int): The minimum string length of an input.
- maxLength (int): The maximum string length of an input.
- pattern (string): Regular expression based pattern to validate input against.
- required (bool)
- fileTypes (string[]): List of mime types for a valid file upload.
- maxSize (int): Maximum size in MB for a file.
- dateIsPast (bool): For date fields, ensures that the provided date is in the past.
- dateIsFuture (bool): For date fields, ensures that the provided date must be in the future.
- dateIsPastOrToday (bool): For date fields, ensures that the provided date is before or on the current date.
- skipIfHasValue (fieldID): Will mark the field with this as not required, if the referenced field has a valid value.
- dependsOn (fieldID): Will perform comparisons of the submitted value with the value of the field being referenced.
- dependsGte (int): Ensures that the submitted value is greater than or equal to the value of the field referenced in `dependsOn`.
- dependsEq (string): Ensures the submitted value matches the value (case insensitive) of the field being referenced in `dependsOn`.
- dependsEqCase (string): Ensures the submitted value is a case sensitive match of the value of the field referenced in `dependsOn`.
- gte (fieldID): Ensures that the submitted value is greater than or equal to the value of the field whose id was provided.
- eqCase (fieldID): Ensures that the submitted value is a case sensitive match to the value of the field whose id was provided.
- eq (fieldID): Ensures that the submitted value is a case insensitive match to the value of the field whose id was provided.

### Pages

A page represents a collection of ingredients, that encapsulates information required for a stage / step of form submission. 

For example, a page requesting an applicant's first and last name:

```json
{
  "pageId": "applicantName",
  "pageTitle": "Applicant Name",
  "pageDescription": "Tell us your name",
  "elements": [
    {
      "ref": "components/name",
      "meta": {
        "id": "firstName"
      },
      "content": {
        "label": "First name"
      }
    },
    {
      "ref": "components/name",
      "meta": {
        "id": "lastName"
      },
      "content": {
        "label": "Last name"
      }
    }
  ]
}
```

A Recipe is typically made up of multiple pages:

```json
{
  "formId": "idOfTheForm",
  "title": "Title of the form",
  "description": "Subtitle of the form",
  "pages": [ ],
  "processors": [ ],
  "confirmation": {}
}
```

Where each page, is stored as an object in the `pages` property of a form.

## Building a Recipe

When building a recipe, the following steps should be followed:

1. Set the formId, to be a camelCased version of the supplied form name, and set the title and description appropriately.
2. Input should consist of information outlining what elements should be present on each page.
3. For each page, create the structure using references in the following order of priority:
  - Exact block matches
  - Block matches that have a majority of required elements, excluding others.
  - Components
  - Fields
4. The declaration page must always be by itself, and be the final page.
5. Add two email processors (with empty configs).
6. Add the confirmation information

That is, when building a form recipe, prioritize referencing exact block matches, then block matches with the `exclude` meta tag excluding unwanted fields, then referencing components, and if there is none that satisfy what is needed, then as a last resort, reference a field directly.

A "majority" match, will be like a block that has firstName, middleName and lastName, but you only want firstName and lastName. In this case, instead of making references to 2 components, simply use the `exclude` in the block like:

```json
{
  "ref": "blocks/nameInformation",
  "meta": {
    "excludes": [
      "middleName"
    ]
  }
}
```

Note: As meta information, each reference to a component or field, must contain `id`.

When written, recipes are stored in the `./recipes/`, as json files.
