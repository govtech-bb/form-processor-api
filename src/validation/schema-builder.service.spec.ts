// command to runs tests => npm test -- --testPathPattern=schema-builder.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { SchemaBuilderService } from './schema-builder.service';
import { FormSchema } from '../forms/interfaces';

describe('SchemaBuilderService', () => {
  let service: SchemaBuilderService;

  const minimalSchema = (fields: FormSchema['fields']): FormSchema => ({
    id: 'test-form',
    name: 'Test Form',
    description: 'Test',
    fields,
    processors: [],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaBuilderService],
    }).compile();

    service = module.get<SchemaBuilderService>(SchemaBuilderService);
  });

  describe('Conditional required (required as object)', () => {
    const schemaWithConditionalRequired = (message?: string) =>
      minimalSchema([
        { name: 'trigger', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: {
              all: [{ field: 'trigger', operator: 'equals', value: 'yes' }],
            },
            ...(message !== undefined && { message }),
          },
        },
      ]);

    describe('condition met, value empty', () => {
      it('fails with custom message and correct path', () => {
        const schema = service.buildZodSchema(
          schemaWithConditionalRequired('Custom required message'),
        );
        const result = service.validateData(schema, {
          trigger: 'yes',
          conditionalField: '',
        });
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors![0]).toMatchObject({
          field: 'conditionalField',
          message: 'Custom required message',
          code: 'custom',
        });
      });

      it('fails with fallback message when message omitted', () => {
        const schema = service.buildZodSchema(schemaWithConditionalRequired());
        const result = service.validateData(schema, {
          trigger: 'yes',
          conditionalField: '',
        });
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors![0]).toMatchObject({
          field: 'conditionalField',
          message: 'conditionalField is required',
          code: 'custom',
        });
      });
    });

    describe('condition met, value non-empty', () => {
      it('passes', () => {
        const schema = service.buildZodSchema(
          schemaWithConditionalRequired('Custom required message'),
        );
        const result = service.validateData(schema, {
          trigger: 'yes',
          conditionalField: 'filled',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('condition not met', () => {
      it('skips required and allows empty', () => {
        const schema = service.buildZodSchema(
          schemaWithConditionalRequired('Custom required message'),
        );
        const result = service.validateData(schema, {
          trigger: 'no',
          conditionalField: '',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Nested path and parent presence', () => {
    const birthSchema = minimalSchema([
      {
        name: 'birth',
        type: 'object',
        fields: [
          { name: 'placeOfBirth', type: 'string', required: false },
          {
            name: 'healthFacility',
            type: 'string',
            required: {
              when: {
                all: [
                  {
                    field: 'birth.placeOfBirth',
                    operator: 'equals',
                    value: 'health-facility',
                  },
                ],
              },
              message: 'Health facility is required',
            },
          },
        ],
      },
    ]);

    it('evaluates required when parent exists (e.g. birth.healthFacility)', () => {
      const schema = service.buildZodSchema(birthSchema);
      const result = service.validateData(schema, {
        birth: {
          placeOfBirth: 'health-facility',
          healthFacility: '',
        },
      });
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        field: 'birth.healthFacility',
        message: 'Health facility is required',
        code: 'custom',
      });
    });

    it('skips required when parent is missing or null', () => {
      const schema = service.buildZodSchema(birthSchema);
      expect(service.validateData(schema, {}).success).toBe(true);

      const resultUndefined = service.validateData(schema, {
        birth: undefined,
      });
      if (!resultUndefined.success && resultUndefined.errors) {
        const healthFacilityError = resultUndefined.errors.find(
          (e) => e.field === 'birth.healthFacility' && e.code === 'custom',
        );
        expect(healthFacilityError).toBeUndefined();
      }
    });
  });

  describe('when.all / when.any', () => {
    it('when.all: all rules must pass for required to apply', () => {
      const formSchema = minimalSchema([
        { name: 'a', type: 'string', required: false },
        { name: 'b', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: {
              all: [
                { field: 'a', operator: 'equals', value: '1' },
                { field: 'b', operator: 'equals', value: '2' },
              ],
            },
            message: 'Required when a=1 and b=2',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      const resultBothMet = service.validateData(schema, {
        a: '1',
        b: '2',
        conditionalField: '',
      });
      expect(resultBothMet.success).toBe(false);
      expect(resultBothMet.errors).toHaveLength(1);
      expect(resultBothMet.errors![0].field).toBe('conditionalField');

      const resultOneNotMet = service.validateData(schema, {
        a: '1',
        b: '3',
        conditionalField: '',
      });
      expect(resultOneNotMet.success).toBe(true);
    });

    it('when.any: at least one rule must pass', () => {
      const formSchema = minimalSchema([
        { name: 'a', type: 'string', required: false },
        { name: 'b', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: {
              any: [
                { field: 'a', operator: 'equals', value: 'yes' },
                { field: 'b', operator: 'equals', value: 'yes' },
              ],
            },
            message: 'Required when a or b is yes',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      const resultOneMet = service.validateData(schema, {
        a: 'no',
        b: 'yes',
        conditionalField: '',
      });
      expect(resultOneMet.success).toBe(false);
      expect(resultOneMet.errors).toHaveLength(1);
      expect(resultOneMet.errors![0].field).toBe('conditionalField');

      const resultNoneMet = service.validateData(schema, {
        a: 'no',
        b: 'no',
        conditionalField: '',
      });
      expect(resultNoneMet.success).toBe(true);
    });
  });

  describe('Operators (evaluateRule / evaluateWhen)', () => {
    it('empty', () => {
      const formSchema = minimalSchema([
        { name: 'x', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: { all: [{ field: 'x', operator: 'empty' }] },
            message: 'Required when x is empty',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      expect(
        service.validateData(schema, { x: '', conditionalField: '' }).success,
      ).toBe(false);
      expect(
        service.validateData(schema, { x: 'a', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('notEmpty', () => {
      const formSchema = minimalSchema([
        { name: 'x', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: { all: [{ field: 'x', operator: 'notEmpty' }] },
            message: 'Required when x is not empty',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      expect(
        service.validateData(schema, { x: 'a', conditionalField: '' }).success,
      ).toBe(false);
      expect(
        service.validateData(schema, { x: '', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('equals', () => {
      const formSchema = minimalSchema([
        { name: 'x', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: {
              all: [{ field: 'x', operator: 'equals', value: 'yes' }],
            },
            message: 'Required when x is yes',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      expect(
        service.validateData(schema, { x: 'yes', conditionalField: '' })
          .success,
      ).toBe(false);
      expect(
        service.validateData(schema, { x: 'no', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('in', () => {
      const formSchema = minimalSchema([
        { name: 'x', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: {
              all: [{ field: 'x', operator: 'in', value: ['a', 'b'] }],
            },
            message: 'Required when x is a or b',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      expect(
        service.validateData(schema, { x: 'a', conditionalField: '' }).success,
      ).toBe(false);
      expect(
        service.validateData(schema, { x: 'c', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('exists', () => {
      const formSchema = minimalSchema([
        { name: 'x', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: { all: [{ field: 'x', operator: 'exists' }] },
            message: 'Required when x exists',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      expect(
        service.validateData(schema, { x: '', conditionalField: '' }).success,
      ).toBe(false);
      expect(
        service.validateData(schema, { x: null, conditionalField: '' }).success,
      ).toBe(false);
      expect(
        service.validateData(schema, { conditionalField: '' }).success,
      ).toBe(true);
    });

    it('missing', () => {
      const formSchema = minimalSchema([
        { name: 'x', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: { all: [{ field: 'x', operator: 'missing' }] },
            message: 'Required when x is missing',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      expect(
        service.validateData(schema, { conditionalField: '' }).success,
      ).toBe(false);
      expect(
        service.validateData(schema, { x: 'a', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('notEquals', () => {
      const formSchema = minimalSchema([
        { name: 'x', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: {
              all: [{ field: 'x', operator: 'notEquals', value: 'no' }],
            },
            message: 'Required when x is not no',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      expect(
        service.validateData(schema, { x: 'yes', conditionalField: '' })
          .success,
      ).toBe(false);
      expect(
        service.validateData(schema, { x: 'no', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('notIn', () => {
      const formSchema = minimalSchema([
        { name: 'x', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: {
              all: [{ field: 'x', operator: 'notIn', value: ['a', 'b'] }],
            },
            message: 'Required when x is not in a,b',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      expect(
        service.validateData(schema, { x: 'c', conditionalField: '' }).success,
      ).toBe(false);
      expect(
        service.validateData(schema, { x: 'a', conditionalField: '' }).success,
      ).toBe(true);
    });
  });

  describe('Conditional validations (validations.condition)', () => {
    it('condition true and then applied with invalid value yields one error with correct path and message', () => {
      const formSchema = minimalSchema([
        { name: 'useId', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: false,
          validations: {
            condition: {
              field: 'useId',
              operator: 'equals',
              value: 'yes' as any,
              then: {
                regex: '^[0-9]+$',
                message: 'Must be digits only',
              },
            },
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);
      const result = service.validateData(schema, {
        useId: 'yes',
        conditionalField: 'abc',
      });
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Must be digits only',
        code: 'custom',
      });
    });

    it('condition true and value empty yields no conditional validation error', () => {
      const formSchema = minimalSchema([
        { name: 'useId', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: false,
          validations: {
            condition: {
              field: 'useId',
              operator: 'equals',
              value: 'yes' as any,
              then: {
                regex: '^[0-9]+$',
                message: 'Must be digits only',
              },
            },
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);
      const result = service.validateData(schema, {
        useId: 'yes',
        conditionalField: '',
      });
      expect(result.success).toBe(true);
    });

    it('condition false skips then; when else present, else is applied', () => {
      const formSchema = minimalSchema([
        { name: 'useId', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: false,
          validations: {
            condition: {
              field: 'useId',
              operator: 'equals',
              value: 'yes' as any,
              then: {
                regex: '^[0-9]+$',
                message: 'Digits when yes',
              },
              else: {
                min: 2,
                message: 'Min 2 when no',
              },
            },
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);

      const resultElseInvalid = service.validateData(schema, {
        useId: 'no',
        conditionalField: 'x',
      });
      expect(resultElseInvalid.success).toBe(false);
      expect(resultElseInvalid.errors).toHaveLength(1);
      expect(resultElseInvalid.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Min 2 when no',
        code: 'custom',
      });

      const resultElseValid = service.validateData(schema, {
        useId: 'no',
        conditionalField: 'ab',
      });
      expect(resultElseValid.success).toBe(true);
    });

    describe('operators in condition (evaluateCondition)', () => {
      it('equals', () => {
        const formSchema = minimalSchema([
          { name: 'useId', type: 'string', required: false },
          {
            name: 'conditionalField',
            type: 'string',
            required: false,
            validations: {
              condition: {
                field: 'useId',
                operator: 'equals',
                value: 'yes' as any,
                then: { min: 2, message: 'Min 2 when yes' },
              },
            },
          },
        ]);
        const schema = service.buildZodSchema(formSchema);
        expect(
          service.validateData(schema, {
            useId: 'yes',
            conditionalField: 'x',
          }).success,
        ).toBe(false);
        expect(
          service.validateData(schema, {
            useId: 'no',
            conditionalField: 'x',
          }).success,
        ).toBe(true);
      });

      it('notEquals', () => {
        const formSchema = minimalSchema([
          { name: 'useId', type: 'string', required: false },
          {
            name: 'conditionalField',
            type: 'string',
            required: false,
            validations: {
              condition: {
                field: 'useId',
                operator: 'notEquals' as any,
                value: 'no' as any,
                then: { min: 2, message: 'Min 2 when not no' },
              },
            },
          },
        ]);
        const schema = service.buildZodSchema(formSchema);
        expect(
          service.validateData(schema, {
            useId: 'yes',
            conditionalField: 'x',
          }).success,
        ).toBe(false);
        expect(
          service.validateData(schema, {
            useId: 'no',
            conditionalField: 'x',
          }).success,
        ).toBe(true);
      });

      it('in', () => {
        const formSchema = minimalSchema([
          { name: 'useId', type: 'string', required: false },
          {
            name: 'conditionalField',
            type: 'string',
            required: false,
            validations: {
              condition: {
                field: 'useId',
                operator: 'in',
                value: ['a', 'b'],
                then: { min: 2, message: 'Min 2 when a or b' },
              },
            },
          },
        ]);
        const schema = service.buildZodSchema(formSchema);
        expect(
          service.validateData(schema, {
            useId: 'a',
            conditionalField: 'x',
          }).success,
        ).toBe(false);
        expect(
          service.validateData(schema, {
            useId: 'c',
            conditionalField: 'x',
          }).success,
        ).toBe(true);
      });

      it('notIn', () => {
        const formSchema = minimalSchema([
          { name: 'useId', type: 'string', required: false },
          {
            name: 'conditionalField',
            type: 'string',
            required: false,
            validations: {
              condition: {
                field: 'useId',
                operator: 'notIn' as any,
                value: ['x'],
                then: { min: 2, message: 'Min 2 when not x' },
              },
            },
          },
        ]);
        const schema = service.buildZodSchema(formSchema);
        expect(
          service.validateData(schema, {
            useId: 'y',
            conditionalField: 'x',
          }).success,
        ).toBe(false);
        expect(
          service.validateData(schema, {
            useId: 'x',
            conditionalField: 'x',
          }).success,
        ).toBe(true);
      });
    });

    it('nested path in condition.field (e.g. father.age) resolves from root data', () => {
      const formSchema = minimalSchema([
        {
          name: 'father',
          type: 'object',
          fields: [
            { name: 'idNumber', type: 'string', required: false },
            {
              name: 'age',
              type: 'string',
              required: false,
              validations: {
                condition: {
                  field: 'father.idNumber',
                  operator: 'equals',
                  value: '' as any,
                  then: {
                    regex: '^[0-9]+$',
                    message: 'Age digits when no id',
                  },
                },
              },
            },
          ],
        },
      ]);
      const schema = service.buildZodSchema(formSchema);
      const result = service.validateData(schema, {
        father: { idNumber: '', age: 'abc' },
      });
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        field: 'father.age',
        message: 'Age digits when no id',
        code: 'custom',
      });
    });
  });

  describe('Interaction with base schema', () => {
    it('required string with regex: empty string yields one required-style error', () => {
      const formSchema = minimalSchema([
        {
          name: 'choice',
          type: 'string',
          required: true,
          validations: {
            regex: '^(yes|no)$',
            message: 'Must select an option',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);
      const result = service.validateData(schema, { choice: '' });
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors![0]).toMatchObject({
        field: 'choice',
        message: 'This field is required',
        code: 'too_small',
      });
    });

    it('required string with regex: key missing yields one error', () => {
      const formSchema = minimalSchema([
        {
          name: 'choice',
          type: 'string',
          required: true,
          validations: {
            regex: '^(yes|no)$',
            message: 'Must select an option',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);
      const result = service.validateData(schema, {});
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        field: 'choice',
        code: 'invalid_type',
      });
    });

    it('required string with regex: non-empty invalid yields format error', () => {
      const formSchema = minimalSchema([
        {
          name: 'choice',
          type: 'string',
          required: true,
          validations: {
            regex: '^(yes|no)$',
            message: 'Must select an option',
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);
      const result = service.validateData(schema, { choice: 'invalid' });
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        field: 'choice',
        message: 'Must select an option',
      });
    });

    it('optional field with condition: value missing yields no conditional error', () => {
      const formSchema = minimalSchema([
        { name: 'trigger', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: false,
          validations: {
            condition: {
              field: 'trigger',
              operator: 'equals',
              value: 'yes' as any,
              then: {
                regex: '^[0-9]+$',
                message: 'Digits only',
              },
            },
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);
      const result = service.validateData(schema, { trigger: 'yes' });
      expect(result.success).toBe(true);
    });

    it('optional field with condition: value provided and invalid yields then validation error', () => {
      const formSchema = minimalSchema([
        { name: 'trigger', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: false,
          validations: {
            condition: {
              field: 'trigger',
              operator: 'equals',
              value: 'yes' as any,
              then: {
                regex: '^[0-9]+$',
                message: 'Digits only',
              },
            },
          },
        },
      ]);
      const schema = service.buildZodSchema(formSchema);
      const result = service.validateData(schema, {
        trigger: 'yes',
        conditionalField: 'abc',
      });
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Digits only',
        code: 'custom',
      });
    });
  });
});
