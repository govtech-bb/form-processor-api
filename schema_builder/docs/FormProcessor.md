# Form Processor

If you haven't, please read [README](./README.md).

With an understanding that the final form schema will consist of only fields, we now need to determine the three key factors for form processing, these being how validation should be handled, what the submission payload should look like, and how any post-processors should be handled.

## Validation

Validation rules are defined within a nested `validation` object for a schema.
We will take consideration for two types of validation. These being:

* Individual field validation
* Dependent field validation.

Individual field validation refers to validations that will ensure that input for a given field, meets a set of predefined requirements. 

These will cover the following:

* required (bool): If true, then will ensure that input must be provided for this field. If false, then if a value is provided, then validation rules will be applied as per normal, however, if no value is provided, then no validation rules are applied.
* minValue (int): Typically for numeric fields, such as date, and numbers. Ensures that whatever numeric input is provided, is greater than or equal to the provided minValue.
* maxValue (int): Similar to minValue, but value provided must be less than or equal to the provided maxValue.
* minLength (int): Typically for string fields such as text, determining the minimum number of characters an input field must have.
* maxLength (int): Determines the maximum number of characters an input field must have.
* pattern (string): These are regular expression based patterns, that the input must satisfy.
* maxSize (string): For file fields only. This determines the maximum size of a file, based on meta information provided.
* fileTypes (list[string]): For file fields only. This determines the valid MIME types for submitted files. This should check header information, instead of just checking for file extensions.

Each validation type will have their own error messages, for when validation fails.

With individual field validations completed, next to cover is Dependent field validation. 

The values of some fields should depend on / interact with values of other fields, as part of their validation rules. 

Each of these validation rules, will accept the id of the field it needs to compare against.

These rules are outlined as follows:

* skipIfHasValue (fieldID): Fetches the value from the fieldID. If a nonempty value is obtained, then the current field is allowed to have an empty value. However, if the current field has a value, then validation rules will be applied as well. This essentially acts as a conditional required.
* gte (fieldID): Fetches the value from the field with id fieldID. Ensures that the value for the current field, is greater than or equal to the value obtained from the related field.
* eq (fieldID): Ensures that the value for the current field, exactly matches the value for another field.
* ieq (fieldID): Ensures that the value for the current field, matches the value for another field, but can be case insensitive.

Now, having validation rules is only one step. We also need to determine the order of which validation rules will be applied!

Rules should be applied in the following order:

1. skipIfHasValue
1. required
1. gte, eq, ieq
1. pattern
1. minValue, maxValue, minLength, maxLength
1. fileTypes
1. maxSize

## Payloads

Now that we have a better understanding of the structure of the schema, we need to also determine what a payload to the server should look like.

Given a schema defined as:

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

The payload should look like:

```json
{
  "firstName": "Value",
  "emailAddress": "value@mail.com"
}
```

As you can see, the id of the field, is used as the key for the field in the payload.

For multi-paged schemas, such as:

```json
{
  "formId": "myForm",
  "title": "My Form",
  "pages": [
    {
      "pageId": "aboutYou",
      "pageTitle": "Tell us about you.",
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
        }
      ]
    },
    {
      "pageId": "aboutFriend",
      "pageTitle": "Tell us about your friend",
      "fields": [
        {
          "htmlType": "text",
          "id": "firstName",
          "content": {
            "label": "Friend's first name"
          },
          "validation": {
            "pattern": "^[a-Z]$"
          }
        }
      ]
    }
  ]
}
```

A payload for this should look like:

```json
{
  "aboutYou": {
    "firstName": "Valid Name"
  },
  "aboutFriend": {
    "firstName": "Another valid name"
  }
}
```

Notice how the page name is the key, and the value is an object, where each key is the id of a field, mapping to its corresponding values.

## Processing Payloads

Now that we know what payloads look like, and how they match to the Form Schemas, we can now examine how processing should take place.

Earlier in this section, we discussed how validation rules should be applied.
Well, processing the payload, is essentially going through each field, and ensuring that the validation rules all pass.
This processing will also log any errors as they occur, and returning a response AFTER processing, that way the user gets a list of all, if any errors one time, instead of piece by piece.

Once the payload has been approved, then any post processors, such as email, or payment, can then be applied as laid out in the form schema.

## Responses

The Form Processor should then return responses based on the success status of the submission.

> [!NOTE]
> These are tentative, and will be updated based on contracts.

For validation errors, return a `400` response code, along with JSON in the following format:

```json
{
  "status": "failed",
  "errors": [
   {
    "fieldID": "id-for-field",
    "error": "error-message"
   }
  ]
}
```

For errors with processors, return a `400` response code, along with JSON in the following format:

```json
{
  "status": "failed",
  "reason": "Client appropriate reason for error."
}
```

On success, service should return a `200` response code, along with JSON in the following format:

```json
{
  "status": "success",
  "reason": "Success message"
}
```
