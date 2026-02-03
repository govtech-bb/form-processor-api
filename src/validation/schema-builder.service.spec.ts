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
    const requiredWhenOperatorFormSchema = (
      operator: string,
      message: string,
      value?: any,
    ) =>
      minimalSchema([
        { name: 'x', type: 'string', required: false },
        {
          name: 'conditionalField',
          type: 'string',
          required: {
            when: {
              all: [
                (value === undefined
                  ? { field: 'x', operator }
                  : { field: 'x', operator, value }) as any,
              ],
            },
            message,
          },
        },
      ]);

    it('empty', () => {
      const schema = service.buildZodSchema(
        requiredWhenOperatorFormSchema('empty', 'Required when x is empty'),
      );
      const resultFail = service.validateData(schema, {
        x: '',
        conditionalField: '',
      });
      expect(resultFail.success).toBe(false);
      expect(resultFail.errors).toHaveLength(1);
      expect(resultFail.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Required when x is empty',
        code: 'custom',
      });
      expect(
        service.validateData(schema, { x: 'a', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('notEmpty', () => {
      const schema = service.buildZodSchema(
        requiredWhenOperatorFormSchema(
          'notEmpty',
          'Required when x is not empty',
        ),
      );
      const resultFail = service.validateData(schema, {
        x: 'a',
        conditionalField: '',
      });
      expect(resultFail.success).toBe(false);
      expect(resultFail.errors).toHaveLength(1);
      expect(resultFail.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Required when x is not empty',
        code: 'custom',
      });
      expect(
        service.validateData(schema, { x: '', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('equals', () => {
      const schema = service.buildZodSchema(
        requiredWhenOperatorFormSchema(
          'equals',
          'Required when x is yes',
          'yes',
        ),
      );
      const resultFail = service.validateData(schema, {
        x: 'yes',
        conditionalField: '',
      });
      expect(resultFail.success).toBe(false);
      expect(resultFail.errors).toHaveLength(1);
      expect(resultFail.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Required when x is yes',
        code: 'custom',
      });
      expect(
        service.validateData(schema, { x: 'no', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('in', () => {
      const schema = service.buildZodSchema(
        requiredWhenOperatorFormSchema(
          'in',
          'Required when x is a or b',
          ['a', 'b'],
        ),
      );
      const resultFail = service.validateData(schema, {
        x: 'a',
        conditionalField: '',
      });
      expect(resultFail.success).toBe(false);
      expect(resultFail.errors).toHaveLength(1);
      expect(resultFail.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Required when x is a or b',
        code: 'custom',
      });
      expect(
        service.validateData(schema, { x: 'c', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('exists', () => {
      const schema = service.buildZodSchema(
        requiredWhenOperatorFormSchema('exists', 'Required when x exists'),
      );
      const resultFail = service.validateData(schema, {
        x: '',
        conditionalField: '',
      });
      expect(resultFail.success).toBe(false);
      expect(resultFail.errors).toHaveLength(1);
      expect(resultFail.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Required when x exists',
        code: 'custom',
      });
      expect(
        service.validateData(schema, { x: null, conditionalField: '' }).success,
      ).toBe(false);
      expect(
        service.validateData(schema, { conditionalField: '' }).success,
      ).toBe(true);
    });

    it('missing', () => {
      const schema = service.buildZodSchema(
        requiredWhenOperatorFormSchema('missing', 'Required when x is missing'),
      );
      const resultFail = service.validateData(schema, { conditionalField: '' });
      expect(resultFail.success).toBe(false);
      expect(resultFail.errors).toHaveLength(1);
      expect(resultFail.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Required when x is missing',
        code: 'custom',
      });
      expect(
        service.validateData(schema, { x: 'a', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('notEquals', () => {
      const schema = service.buildZodSchema(
        requiredWhenOperatorFormSchema(
          'notEquals',
          'Required when x is not no',
          'no',
        ),
      );
      const resultFail = service.validateData(schema, {
        x: 'yes',
        conditionalField: '',
      });
      expect(resultFail.success).toBe(false);
      expect(resultFail.errors).toHaveLength(1);
      expect(resultFail.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Required when x is not no',
        code: 'custom',
      });
      expect(
        service.validateData(schema, { x: 'no', conditionalField: '' }).success,
      ).toBe(true);
    });

    it('notIn', () => {
      const schema = service.buildZodSchema(
        requiredWhenOperatorFormSchema(
          'notIn',
          'Required when x is not in a,b',
          ['a', 'b'],
        ),
      );
      const resultFail = service.validateData(schema, {
        x: 'c',
        conditionalField: '',
      });
      expect(resultFail.success).toBe(false);
      expect(resultFail.errors).toHaveLength(1);
      expect(resultFail.errors![0]).toMatchObject({
        field: 'conditionalField',
        message: 'Required when x is not in a,b',
        code: 'custom',
      });
      expect(
        service.validateData(schema, { x: 'a', conditionalField: '' }).success,
      ).toBe(true);
    });
  });

  describe('Conditional validations (validations.condition)', () => {
    const conditionThenOnlyFormSchema = minimalSchema([
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

    it('condition true and then applied with invalid value yields one error with correct path and message', () => {
      const schema = service.buildZodSchema(conditionThenOnlyFormSchema);
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
      const schema = service.buildZodSchema(conditionThenOnlyFormSchema);
      const result = service.validateData(schema, {
        useId: 'yes',
        conditionalField: '',
      });
      expect(result.success).toBe(true);
    });

    const conditionThenElseFormSchema = minimalSchema([
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

    it('condition false skips then; when else present, else is applied', () => {
      const schema = service.buildZodSchema(conditionThenElseFormSchema);
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
      const conditionOperatorFormSchema = (
        operator: string,
        value: any,
        thenMessage: string,
      ) =>
        minimalSchema([
          { name: 'useId', type: 'string', required: false },
          {
            name: 'conditionalField',
            type: 'string',
            required: false,
            validations: {
              condition: {
                field: 'useId',
                operator: operator as any,
                value,
                then: { min: 2, message: thenMessage },
              },
            },
          },
        ]);

      it('equals', () => {
        const formSchema = conditionOperatorFormSchema(
          'equals',
          'yes' as any,
          'Min 2 when yes',
        );
        const schema = service.buildZodSchema(formSchema);
        const resultFail = service.validateData(schema, {
          useId: 'yes',
          conditionalField: 'x',
        });
        expect(resultFail.success).toBe(false);
        expect(resultFail.errors).toHaveLength(1);
        expect(resultFail.errors![0]).toMatchObject({
          field: 'conditionalField',
          message: 'Min 2 when yes',
          code: 'custom',
        });
        const resultPass = service.validateData(schema, {
          useId: 'no',
          conditionalField: 'x',
        });
        expect(resultPass.success).toBe(true);
      });

      it('notEquals', () => {
        const formSchema = conditionOperatorFormSchema(
          'notEquals',
          'no' as any,
          'Min 2 when not no',
        );
        const schema = service.buildZodSchema(formSchema);
        const resultFail = service.validateData(schema, {
          useId: 'yes',
          conditionalField: 'x',
        });
        expect(resultFail.success).toBe(false);
        expect(resultFail.errors).toHaveLength(1);
        expect(resultFail.errors![0]).toMatchObject({
          field: 'conditionalField',
          message: 'Min 2 when not no',
          code: 'custom',
        });
        const resultPass = service.validateData(schema, {
          useId: 'no',
          conditionalField: 'x',
        });
        expect(resultPass.success).toBe(true);
      });

      it('in', () => {
        const formSchema = conditionOperatorFormSchema(
          'in',
          ['a', 'b'],
          'Min 2 when a or b',
        );
        const schema = service.buildZodSchema(formSchema);
        const resultFail = service.validateData(schema, {
          useId: 'a',
          conditionalField: 'x',
        });
        expect(resultFail.success).toBe(false);
        expect(resultFail.errors).toHaveLength(1);
        expect(resultFail.errors![0]).toMatchObject({
          field: 'conditionalField',
          message: 'Min 2 when a or b',
          code: 'custom',
        });
        const resultPass = service.validateData(schema, {
          useId: 'c',
          conditionalField: 'x',
        });
        expect(resultPass.success).toBe(true);
      });

      it('notIn', () => {
        const formSchema = conditionOperatorFormSchema(
          'notIn',
          ['x'],
          'Min 2 when not x',
        );
        const schema = service.buildZodSchema(formSchema);
        const resultFail = service.validateData(schema, {
          useId: 'y',
          conditionalField: 'x',
        });
        expect(resultFail.success).toBe(false);
        expect(resultFail.errors).toHaveLength(1);
        expect(resultFail.errors![0]).toMatchObject({
          field: 'conditionalField',
          message: 'Min 2 when not x',
          code: 'custom',
        });
        const resultPass = service.validateData(schema, {
          useId: 'x',
          conditionalField: 'x',
        });
        expect(resultPass.success).toBe(true);
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
    const requiredChoiceFormSchema = minimalSchema([
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

    const conditionalFieldFormSchema = minimalSchema([
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

    it('required string with regex: empty string yields one required-style error', () => {
      const schema = service.buildZodSchema(requiredChoiceFormSchema);
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
      const schema = service.buildZodSchema(requiredChoiceFormSchema);
      const result = service.validateData(schema, {});
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        field: 'choice',
        code: 'invalid_type',
      });
    });

    it('required string with regex: non-empty invalid yields format error', () => {
      const schema = service.buildZodSchema(requiredChoiceFormSchema);
      const result = service.validateData(schema, { choice: 'invalid' });
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toMatchObject({
        field: 'choice',
        message: 'Must select an option',
      });
    });

    it('optional field with condition: value missing yields no conditional error', () => {
      const schema = service.buildZodSchema(conditionalFieldFormSchema);
      const result = service.validateData(schema, { trigger: 'yes' });
      expect(result.success).toBe(true);
    });

    it('optional field with condition: value provided and invalid yields then validation error', () => {
      const schema = service.buildZodSchema(conditionalFieldFormSchema);
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
