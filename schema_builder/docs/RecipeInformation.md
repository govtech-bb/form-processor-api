# Recipe Information

This section seeks to outline the information and documentation about the Schema Builder.

The Schema builder, is a modular style of building form schemas, relying on Blocks, Components, and Fields to create Recipes, which will then be turned into shareable JSON schemas.

## What Is a Recipe

A recipe will be defined as a reusable, configurable schema, that can be applied across different forms.

For convenience recipes are built using three types of components, each representing different levels of abstraction.

This can be broken down as follows:

* Fields (Representing the smallest composable unit, that should map directly to an HTML input field, example input:text, input:file, input:radio, etc).
* Components (Representing a Field, that has additional information such as labels, hints, validation rules. For example: Phone Number, Address, user name)
* Block / Section (Represents a collection of Fields and/or Components that makes up a reusable section, such as ApplicantInformation, WorkExperience, etc)

A recipe will be built up of these components, by having references to each Field, Component, and Block, which will be defined in their own registry.

As such, before the form is fully usable, the final schema should be generated, which will be responsible for fetching the components and creating the output JSON schema to be consumed by the client. On composing, all Components, and Blocks / Sections will be translated down to Field representation, applying all properties defined on their level.

## Form Building Blocks

Most of the forms are multi-step forms, but many have overlapping pages.
The most used pages so far are:

* Applicant Information (15 schemas)
    * Fields: title, firstName, middleName, lastName, dateofBirth, idNumber, passportNumber, email, telephoneNumber
* Address Details (3 Schemas)
    * Fields: addressLine1, addressLine2, parish, postalCode
* Person / Subject Information (3 Schemas)
    * Fields: firstName, middleName, lastName, dateOfBirth, placeOfBirth, idNumber
* Parent Information (3 Schemas)
    * Fields: firstName, middleName, lastName, maidenSurname, occupation, idNumber, address
* Emergency Contact
    * Fields: title, firstName, lastName, relationship, address, email, telephoneNumber
* Referee / Testimonial
    * Fields: firstName, lastName, relationship, email, telephoneNumber, address
* Order Details (4 schemas)
    * Fields: numberOfCopies

From this, we can see that these could be the key Sections/Blocks to have in place.
Similarly, Components would include telephoneNumber, personName, dateOfBirth, address and Fields will include text, email and date.

### Fields

Fields are the base unit for this system, and are a schema that reflects a specific HTML type.

In defining fields, they should contain the bare minimum. 
All extra information, such as validation, should be applied on the Component level.

All fields are located in `schema_builder/registry/fields`.

A field should be defined with the following properties:

* type (string): (Field|Component|Section) Of course, for fields, this will have a value of `field`.
* meta (object containing meta information about the field)
    * htmlType (string): The type of HTML input field this Field represents. (Example: text:email, text:password, date, file)

However, a field should have support for the following properties, most of which, if not all, will be applied by the form builder evaluating Components):

* type (string): (Field|Component|section) Whether this is a field, Component or Block
* meta (object containing meta information about the field)
    * htmlType: The type of HTML input field this Field represents
    * id: ID of the field (would be used as the name attribute for HTML)
* content (object containing content for the field)
    * label: Text to display for the label. Can be used to generate the meta:id if no meta:id is explicitly provided
    * hint: Hint text to display.
    * placeholder: A placeholder to show for the field.
    * options `[select, radio]`: (For select and radio fields) Either a list of strings, or a list of key value pairs, with keys "label" and "value". If a list of strings, the provided strings will be used as labels, and the "value", will be generated from the label, by removing all non-alphanumeric characters, excluding spaces, then replacing all spaces with hyphens.
* validation (object containing validation rules)
    * minValue (int): the minimum numerical value to be accepted. Should coerce input to number, if input is numeric.
    * maxValue (int): Maximum numerical value to be accepted.
    * minLength (int): Minimum length of a string received as input.
    * maxLength (int): Maximum length of a string received as input.
    * pattern (string): Regular Expression based pattern to validate the input against.
    * fileTypes `[file]` (`list[string]`): List of MIME types.
    * required (bool): Determines whether the field needs a value, or not.
    * maxSize `[file]`(string): The maximum size for an uploaded file.
    * skipIfHasValue (string): ID of another field. If that field has a value, then skip validation of this field.
    * gt `[number, date]` (string): ID of another field. This field must be greater than the value in the field referenced.
    * eq (string): ID of another field. This field must have a case sensitive exact match to the value in the field referenced.
    * ieq (string): ID of another field. This field must have a case insensitive value to the value in the field being referenced.
    * errorMessage (string): Default error message. If not provided, will use generated messages per validation type.
* ui (object containing UI suggestions)
    * width (string): (short|medium|long) width of the field for a client to render.
    * disabled (bool): Whether the field should be disabled or not.
* context (Key-value pairs that can be used for run-time substitution)

### Components

Fields are the base unit for this system, and are a schema that reflects a specific HTML type.
Components are fields with more information defined.

All components are located in `schema_builder/registry/components`.

Components are able to provide values to the various field properties, to create reusable recipes.
A Component has the following unique fields:

* type (Field|Component|Section): Of course, for Components, this should have the value of [Feature]
* meta (meta information about the Component)
    * extends (string): A string value in the format field/fieldName indicating what field to use as the base.
    * componentName (string): Name for the component (can match the filename)

The other values are the same as defined in the full Field Structure.

The idea, is that if we wanted to make a reusable component to get a user's ID number, using a text field, the text field could be defined like:

```yaml

# in a file at fields/text.yaml
type: field
meta:
  htmlType: text
validation:
  required: true
  pattern: "^[a-zA-Z0-9]*$"
```

Now, our IDNumber component could look like:

```yaml

# in a file at components/idNumber.yaml
type: component
meta:
  extends: fields/text
  id: "idNumber"
content:
  label: "ID Number"
  placeholder: "XXXXXX-XXXX"
validation:
  pattern: "^[0-9]{6}-[0-9]{4}$"
  skipIfHasValue: "passportNumber"
ui:
  width: "short"
```

Similarly, our passportNumber component could look like:

```yaml

# in a file at components/passportNumber.yaml
type: component
meta:
  extends: fields/text
  id: "passportNumber"
content:
  label: "Passport Number"
validation:
  minLength: 6
  skipIfHasValue: "idNumber"
```

Components will pass values down, and override the default values provided by the extended field type.
This will be further referred to as "Builder Notation".

#### Using Context

Fields should support template strings, for dynamic passing down of values. These variables that will replace the values in the template strings, should be present in the context section. For example, we can have two components defined as:

```yaml

# components/targetName.json
type: component
  content:
   label: "{{Target}} Name"
  validation:
   errorMessage: "{{Target}} Name is invalid"

# components/targetAddress.json
type: component
  content:
   label: "{{Target}} Address"
  validation:
   errorMessage: "{{Target}} address is Invalid"
```

Now, we can compose these 2 into a block like:

```yaml

# blocks/referenceInfo.json
type: block
  meta:
   blockName: referenceInfo
  context:
   Target: "Reference"
  fields:
ref: components/targetName
ref: componentes/targetAddress
```

On build time, this will result in the ``{{Target}}`` being replaced with "Reference"

### Section / Block Structure

Fields are the base unit for this system, and are a schema that reflects a specific HTML type.
Components are fields with more information defined.
Sections / Blocks are a collection of Components that can be reused.

All blocks are located in `schema_builder/registry/blocks`.

(I personally prefer the name Blocks, but I feel Sections is more semantically correct...)

Blocks should be defined as follows:

type: Block
meta:
    blockName: Name for the block (Can match the filename)
    description: Meta description of the block, and when / where to use it.
    repeatable (bool): Whether this block should be repeatable or not.
    minItems (int): If block is repeatable, determines the min number of entries.
    maxItems (int): If block is repeatable, determines the max number of entries.
    exclude (`list[str]`): List of IDs to exclude from the block. (This information should be passed by a form recipe)
content:
    title (string): Title for the block. Can be used to display a title on a page for the block.
    description (string): Description for the block. Can be used to display a description on a page for the block.
elements: (List of Components and / or fields used for the block)
    ref: components/componentName or fields/fieldName
        can override values.

For example, let's say we wanted to have a block for getting Address information, containing the input fields addressLine1, addressLine2, parish, postcode.

We'll assume that we have components set up for address, parish and postcode, with sensible values and validation rules. Our block will then be defined as follows (writing in YAML for brevity and comments).

```yaml

---
type: block
meta:
  blockName: addressInformation
  content:
    title: What is your address information?
  elements:
    - ref: components/address # Reference to component
      meta:
        id: addressLine1
      content:
        label: Address Line 1
    - ref: components/address
      meta:
        id: addressLine2
      content:
        label: Address Line 2
      validation:
        required: false
    - ref: components/parish # Using default options
    - ref: components/postcode
```

### The Form Recipe

Now that we've looked at all the pieces that could make up a form, next is to examine how to actually put it all together to make a form!

Note: These Form Recipes will be made of references to components, and will not be usable by a client. The form builder is responsible for resolving these components, and creating a final JSON form schema that can be shared to a client.

Refer to [Form Builder](./formBuilder.md) for more details on the form builder.

Now, Form Recipes will have the following format:

formId (string): idOfTheForm
title (string): Title of the Form (If form has one page, this overrides any block.content.title)
description (string): Brief description of the form (if form has one pages, this overrides any block.content.description)
pages (`list[pageObject]`): // This is for if the form has multiple pages
    - pageId (string): id for the page.
      pageTitle (string): Title for the page. (Overrides block.content.title if present)
      pageDescription (string): Description for the page. (Overrides block.content.description if present)
      elements (`list[blocks|components|fields]`):
          - ref (string): blocks/blockName, components/componentName or fields/fieldName
            meta:
                repeatable (bool): Overrides block.meta.repeatable if present.
                minItems (int): Overrides block.meta.minItems if present.
                maxItems (int): Overrides block.meta.maxItems if present.
                exclude (`list[str]`): List of ids for components / fields that should be excluded. (Applies to blocks only)
                # Other meta fields override components / fields fields.
            content: {}
            ui: {} // (Only applied for components or fields, not to blocks)
elements: (If the form only has a single page, then this property should be used instead of `pages`)
    ref (string): blocks/blockName, components/componentName or fields/fieldName
     # Same rules apply, in terms of content, meta and ui
processors (`list[Processor]`):
    type (email|payment): Type of processor
    config (object): Configuration for processor

To demonstrate this, we can build a one page form that will use the components and blocks we defined before, along with a field by itself to get a user's first name, email address, ID number, and address information (but not the addressLine2).
Let's call it Applicant Information (YAML provided for comments):

```yaml

---
formId: applicantInformation
title: Applicant Information
description: Tell us a bit about yourself
elements: # Since we're only using one page.
  - ref: fields/text
    meta:
      id: firstName
    content:
      label: First name
      hint: What is your first name?
    validation:
      pattern: "^[a-zA-Z]*$"
  - ref: fields/email # Basic field with email validation.
    meta:
      id: emailAddress
    content:
      label: Email Address
  - ref: components/idNumber # Using the component we defined before
  - ref: blocks/addressInformation
    meta:
      exclude:
        - addressLine2 # Exclude this field from the block when rendering.
processors:
  - type: email
    config:
      to: "{{formData.emailAddress}}"
      from: "system@mail.com"
      subject: Applicant information received
      content: "Thank you!"
```

Now, if we wanted to, we could actually split this into 2 pages!

We can have the first name, email address, and ID number fields on the first page, and leave the second page to just have address information.

Note: Ideally, you want to avoid using fields directly, as updating rules later will mean having to go to each instance of the field. So for firstName, it'd be better to have it as a component, but this is just for demonstration purposes.
This can look as follows:

```yaml

--- # schemas/applicantInformation.yaml
formId: applicantInformation
title: Applicant Information
description: Tell us a bit about yourself
pages:
  - pageId: basicInformation
    pageTitle: Tell us some basic information!
    pageDescription: '' # No description message ot show on the page.
    elements:
      - ref: fields/text
        content:
          label: First Name
          hint: What is your first name?
        validation:
          pattern: "^[a-zA-Z]*$"
        ui:
          width: medium
      - ref: fields/email # ID will be generated from label as (emailAddress)
        content:
          label: Email Address
      - ref: components/idNumber
  - pageId: addressInformation
    # Leaving out pageTitle, so that it will use block.content.title
    elements:
      - ref: blocks/addressInformation
        meta:
          exclude:
            - addressLine2 # Exclude the addressLine2 block
processors:
  - type: email
    config:
      to: "{{formData.emailAddress}}"
      from: "system@mail.com"
      subject: Applicant information received
      content: "Thank you!"
```

For next readings, refer to [Form Builder](./FormBuilder.md) and [Form Processor](/docs/FormProcessor.md).
