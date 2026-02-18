# Form Schema Builder

This document seeks to explain the overall structure of the form builder service, along with concepts to be understood.

## Document Structure

The docs folder consists of the following documents:

- RecipeInformation.md: Provides information on the concept of recipes, and how they work
- FormBuilder.md: Provides information for the rules governing how recipes should be evaluted into form schemas.

Also, refer to [Form Processor](/docs/FormProcessor.md) for information about how forms should be processed.

## Terminology

- Field: A JSON or YAML schema mapping directly to an HTML field.
- Component: A `field` that has additional validation and content rules applied to it for reusability.
- Block: A collection of ordered `component`s, that represent a reusable section.
- Recipe: A collection of Blocks, Components, and / or Fields
- Schema: A resultant schema built from a recipe, that represents a Form, that can then be shared to clients.
- Form Builder: Collection of code designed to turn convert a Recipe into a Schema.
