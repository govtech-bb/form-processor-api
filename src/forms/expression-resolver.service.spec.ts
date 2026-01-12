import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  ExpressionResolverService,
  ExpressionContext,
} from './expression-resolver.service';
import { FormConfig } from '../database/entities';

describe('ExpressionResolverService', () => {
  let service: ExpressionResolverService;
  let mockConfigRepository: jest.Mocked<Repository<FormConfig>>;

  // Helper function to create mock FormConfig
  const createMockFormConfig = (
    id: string,
    formId: string,
    key: string,
    value: string,
    description: string | null = null,
  ): FormConfig => ({
    id,
    formId,
    key,
    value,
    description,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(async () => {
    // Mock ConfigService
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          TEST_FORM_ADMIN_EMAIL: 'admin@test.com',
          TEST_FORM_PAYMENT_CODE: 'PAY123',
        };
        return config[key] || defaultValue;
      }),
    };

    // Mock FormConfig Repository
    mockConfigRepository = {
      findOne: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpressionResolverService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ExpressionResolverService>(ExpressionResolverService);
  });

  describe('resolveExpression - Simple Cases', () => {
    it('should return non-string values as-is', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
      };

      expect(await service.resolveExpression(123, context)).toBe(123);
      expect(await service.resolveExpression(0, context)).toBe(0);
      expect(await service.resolveExpression(null as any, context)).toBe(null);
    });

    it('should return strings without expressions as-is', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
      };

      expect(await service.resolveExpression('plain text', context)).toBe(
        'plain text',
      );
      expect(await service.resolveExpression('no brackets here', context)).toBe(
        'no brackets here',
      );
    });
  });

  describe('resolveExpression - Single formData References', () => {
    it('should resolve single formData field reference', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          firstName: 'John',
        },
      };

      const result = await service.resolveExpression(
        '{{formData.firstName}}',
        context,
      );
      expect(result).toBe('John');
    });

    it('should resolve nested formData field reference', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          applicant: {
            firstName: 'Jane',
            lastName: 'Doe',
          },
        },
      };

      expect(
        await service.resolveExpression(
          '{{formData.applicant.firstName}}',
          context,
        ),
      ).toBe('Jane');
      expect(
        await service.resolveExpression(
          '{{formData.applicant.lastName}}',
          context,
        ),
      ).toBe('Doe');
    });

    it('should resolve deeply nested formData references', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          personal: {
            contact: {
              address: {
                street: '123 Main St',
              },
            },
          },
        },
      };

      const result = await service.resolveExpression(
        '{{formData.personal.contact.address.street}}',
        context,
      );
      expect(result).toBe('123 Main St');
    });

    it('should handle missing formData fields gracefully', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          firstName: 'John',
        },
      };

      const result = await service.resolveExpression(
        '{{formData.lastName}}',
        context,
      );
      expect(result).toBe('0'); // Default fallback for missing fields
    });
  });

  describe('resolveExpression - Multiple Embedded Expressions', () => {
    it('should resolve multiple formData expressions in a string', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          applicant: {
            firstName: 'John',
            lastName: 'Smith',
          },
        },
      };

      const result = await service.resolveExpression(
        'New Death Certificate Application - {{formData.applicant.firstName}} {{formData.applicant.lastName}}',
        context,
      );
      expect(result).toBe('New Death Certificate Application - John Smith');
    });

    it('should resolve multiple expressions with text in between', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          personal: {
            firstName: 'Alice',
            lastName: 'Johnson',
          },
          age: 30,
        },
      };

      const result = await service.resolveExpression(
        'Hello {{formData.personal.firstName}} {{formData.personal.lastName}}, you are {{formData.age}} years old',
        context,
      );
      expect(result).toBe('Hello Alice Johnson, you are 30 years old');
    });

    it('should resolve birth registration subject line', async () => {
      const context: ExpressionContext = {
        formId: 'register-birth-form',
        formData: {
          child: {
            firstNames: 'Emma Grace',
            lastName: 'Williams',
          },
        },
      };

      const result = await service.resolveExpression(
        'New Birth Registration - {{formData.child.firstNames}} {{formData.child.lastName}}',
        context,
      );
      expect(result).toBe('New Birth Registration - Emma Grace Williams');
    });

    it('should resolve marriage certificate subject line', async () => {
      const context: ExpressionContext = {
        formId: 'get-marriage-certificate',
        formData: {
          applicant: {
            firstName: 'Michael',
            lastName: 'Brown',
          },
        },
      };

      const result = await service.resolveExpression(
        'New Marriage Certificate Application - {{formData.applicant.firstName}} {{formData.applicant.lastName}}',
        context,
      );
      expect(result).toBe(
        'New Marriage Certificate Application - Michael Brown',
      );
    });

    it('should resolve exit survey subject with single field', async () => {
      const context: ExpressionContext = {
        formId: 'exit-survey',
        formData: {
          difficultyRating: 'Easy',
        },
      };

      const result = await service.resolveExpression(
        'New Exit Survey Submission - {{formData.difficultyRating}} Experience',
        context,
      );
      expect(result).toBe('New Exit Survey Submission - Easy Experience');
    });

    it('should handle expressions at the start and end of string', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          greeting: 'Hello',
          name: 'World',
        },
      };

      const result = await service.resolveExpression(
        '{{formData.greeting}} there, {{formData.name}}',
        context,
      );
      expect(result).toBe('Hello there, World');
    });

    it('should handle three or more expressions in a string', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          title: 'Mr',
          firstName: 'John',
          middleName: 'Michael',
          lastName: 'Doe',
        },
      };

      const result = await service.resolveExpression(
        '{{formData.title}}. {{formData.firstName}} {{formData.middleName}} {{formData.lastName}}',
        context,
      );
      expect(result).toBe('Mr. John Michael Doe');
    });
  });

  describe('resolveExpression - Database References', () => {
    it('should resolve database reference with form-id:key format', async () => {
      mockConfigRepository.findOne.mockResolvedValue(
        createMockFormConfig(
          '1',
          'test-form',
          'admin_email',
          'admin@example.com',
        ),
      );

      const context: ExpressionContext = {
        formId: 'test-form',
        configRepository: mockConfigRepository,
      };

      const result = await service.resolveExpression(
        '{{db:test-form:admin_email}}',
        context,
      );
      expect(result).toBe('admin@example.com');
    });

    it('should resolve database reference with key-only format (uses current formId)', async () => {
      mockConfigRepository.findOne.mockResolvedValue(
        createMockFormConfig('1', 'test-form', 'payment_code', 'PAY456'),
      );

      const context: ExpressionContext = {
        formId: 'test-form',
        configRepository: mockConfigRepository,
      };

      const result = await service.resolveExpression(
        '{{db:payment_code}}',
        context,
      );
      expect(result).toBe('PAY456');
    });

    it('should fallback to environment variable if database lookup fails', async () => {
      mockConfigRepository.findOne.mockResolvedValue(null);

      const context: ExpressionContext = {
        formId: 'test-form',
        configRepository: mockConfigRepository,
      };

      const result = await service.resolveExpression(
        '{{db:test-form:admin_email}}',
        context,
      );
      expect(result).toBe('admin@test.com');
    });

    it('should resolve database reference in embedded string', async () => {
      mockConfigRepository.findOne.mockResolvedValue(
        createMockFormConfig(
          '1',
          'test-form',
          'department_name',
          'Revenue Authority',
        ),
      );

      const context: ExpressionContext = {
        formId: 'test-form',
        configRepository: mockConfigRepository,
        formData: {
          applicant: {
            firstName: 'John',
          },
        },
      };

      const result = await service.resolveExpression(
        'Application from {{formData.applicant.firstName}} to {{db:department_name}}',
        context,
      );
      expect(result).toBe('Application from John to Revenue Authority');
    });
  });

  describe('resolveExpression - Mathematical Expressions', () => {
    it('should evaluate simple multiplication', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          order: {
            numberOfCopies: 3,
          },
        },
      };

      const result = await service.resolveExpression(
        '{{formData.order.numberOfCopies * 25}}',
        context,
      );
      expect(result).toBe(75);
    });

    it('should evaluate formData field multiplied by database value', async () => {
      mockConfigRepository.findOne.mockResolvedValue(
        createMockFormConfig(
          '1',
          'get-death-certificate',
          'payment_amount',
          '50',
        ),
      );

      const context: ExpressionContext = {
        formId: 'get-death-certificate',
        configRepository: mockConfigRepository,
        formData: {
          order: {
            numberOfCopies: 2,
          },
        },
      };

      const result = await service.resolveExpression(
        '{{formData.order.numberOfCopies * db:get-death-certificate:payment_amount}}',
        context,
      );
      expect(result).toBe(100);
    });

    it('should evaluate addition', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          basePrice: 100,
          tax: 15,
        },
      };

      const result = await service.resolveExpression(
        '{{formData.basePrice + formData.tax}}',
        context,
      );
      expect(result).toBe(115);
    });

    it('should evaluate complex mathematical expression', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          quantity: 5,
          price: 20,
          discount: 10,
        },
      };

      const result = await service.resolveExpression(
        '{{(formData.quantity * formData.price) - formData.discount}}',
        context,
      );
      expect(result).toBe(90);
    });

    it('should handle division', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          total: 100,
          people: 4,
        },
      };

      const result = await service.resolveExpression(
        '{{formData.total / formData.people}}',
        context,
      );
      expect(result).toBe(25);
    });

    it('should handle subtraction', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          budget: 1000,
          spent: 350,
        },
      };

      const result = await service.resolveExpression(
        '{{formData.budget - formData.spent}}',
        context,
      );
      expect(result).toBe(650);
    });
  });

  describe('resolveObjectExpressions - Complex Objects', () => {
    it('should resolve expressions in nested objects', async () => {
      mockConfigRepository.findOne.mockResolvedValue(
        createMockFormConfig(
          '1',
          'test-form',
          'admin_email',
          'admin@example.com',
        ),
      );

      const context: ExpressionContext = {
        formId: 'test-form',
        configRepository: mockConfigRepository,
        formData: {
          applicant: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      };

      const input = {
        email: {
          to: '{{db:admin_email}}',
          subject:
            'Application from {{formData.applicant.firstName}} {{formData.applicant.lastName}}',
        },
      };

      const result = await service.resolveObjectExpressions(input, context);
      expect(result).toEqual({
        email: {
          to: 'admin@example.com',
          subject: 'Application from John Doe',
        },
      });
    });

    it('should resolve expressions in arrays', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          name: 'John',
          email: 'john@example.com',
        },
      };

      const input = [
        'Hello {{formData.name}}',
        'Your email is {{formData.email}}',
      ];

      const result = await service.resolveObjectExpressions(input, context);
      expect(result).toEqual(['Hello John', 'Your email is john@example.com']);
    });

    it('should resolve complete processor config', async () => {
      // Mock based on the key being requested
      mockConfigRepository.findOne.mockImplementation(async (options: any) => {
        const key = options.where.key;
        if (key === 'admin_email') {
          return createMockFormConfig(
            '1',
            'get-death-certificate',
            'admin_email',
            'death-certs@gov.bb',
          );
        } else if (key === 'payment_code') {
          return createMockFormConfig(
            '2',
            'get-death-certificate',
            'payment_code',
            'DEATH_CERT_001',
          );
        } else if (key === 'payment_amount') {
          return createMockFormConfig(
            '3',
            'get-death-certificate',
            'payment_amount',
            '75',
          );
        }
        return null;
      });

      const context: ExpressionContext = {
        formId: 'get-death-certificate',
        configRepository: mockConfigRepository,
        formData: {
          applicant: {
            firstName: 'Sarah',
            lastName: 'Johnson',
          },
          order: {
            numberOfCopies: 2,
          },
        },
      };

      const processorConfig = {
        payment: {
          provider: 'ezpay',
          department: 'revenue_authority',
          paymentCode: '{{db:payment_code}}',
          amount: '{{formData.order.numberOfCopies * db:payment_amount}}',
          description: 'Death Certificate Processing Fee (per copy)',
        },
        email: {
          to: '{{db:admin_email}}',
          subject:
            'New Death Certificate Application - {{formData.applicant.firstName}} {{formData.applicant.lastName}}',
          template: 'death-certificate',
        },
      };

      const result = await service.resolveObjectExpressions(
        processorConfig,
        context,
      );
      expect(result).toEqual({
        payment: {
          provider: 'ezpay',
          department: 'revenue_authority',
          paymentCode: 'DEATH_CERT_001',
          amount: 150,
          description: 'Death Certificate Processing Fee (per copy)',
        },
        email: {
          to: 'death-certs@gov.bb',
          subject: 'New Death Certificate Application - Sarah Johnson',
          template: 'death-certificate',
        },
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty formData', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {},
      };

      const result = await service.resolveExpression(
        '{{formData.name}}',
        context,
      );
      expect(result).toBe('0');
    });

    it('should handle undefined formData', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
      };

      const result = await service.resolveExpression(
        '{{formData.name}}',
        context,
      );
      expect(result).toBe('0');
    });

    it('should handle expressions with special characters in text', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          name: 'John',
        },
      };

      const result = await service.resolveExpression(
        'Email: {{formData.name}}@example.com',
        context,
      );
      expect(result).toBe('Email: John@example.com');
    });

    it('should handle consecutive expressions without space', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };

      const result = await service.resolveExpression(
        '{{formData.firstName}}{{formData.lastName}}',
        context,
      );
      expect(result).toBe('JohnDoe');
    });

    it('should handle numeric formData values', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          age: 25,
          score: 98.5,
        },
      };

      expect(
        await service.resolveExpression('Age: {{formData.age}}', context),
      ).toBe('Age: 25');
      expect(
        await service.resolveExpression('Score: {{formData.score}}', context),
      ).toBe('Score: 98.5');
    });

    it('should handle boolean formData values', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          isActive: true,
          isDeleted: false,
        },
      };

      expect(
        await service.resolveExpression(
          'Active: {{formData.isActive}}',
          context,
        ),
      ).toBe('Active: true');
      expect(
        await service.resolveExpression(
          'Deleted: {{formData.isDeleted}}',
          context,
        ),
      ).toBe('Deleted: false');
    });

    it('should handle null values in formData', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          middleName: null,
        },
      };

      const result = await service.resolveExpression(
        'Middle: {{formData.middleName}}',
        context,
      );
      expect(result).toBe('Middle: 0');
    });

    it('should not resolve malformed expressions', async () => {
      const context: ExpressionContext = {
        formId: 'test-form',
        formData: {
          name: 'John',
        },
      };

      // Missing closing braces
      expect(await service.resolveExpression('{{formData.name', context)).toBe(
        '{{formData.name',
      );

      // Missing opening braces
      expect(await service.resolveExpression('formData.name}}', context)).toBe(
        'formData.name}}',
      );

      // Single braces
      expect(await service.resolveExpression('{formData.name}', context)).toBe(
        '{formData.name}',
      );
    });
  });

  describe('Real-World Form Scenarios', () => {
    it('should resolve complete death certificate form submission', async () => {
      mockConfigRepository.findOne.mockResolvedValueOnce(
        createMockFormConfig(
          '1',
          'get-death-certificate',
          'admin_email',
          'registrar@gov.bb',
        ),
      );

      const context: ExpressionContext = {
        formId: 'get-death-certificate',
        configRepository: mockConfigRepository,
        formData: {
          applicant: {
            title: 'Mrs',
            firstName: 'Mary',
            lastName: 'Thompson',
            email: 'mary.thompson@example.com',
            telephoneNumber: '+12465551234',
          },
          deceased: {
            firstName: 'Robert',
            lastName: 'Thompson',
            dateOfDeath: '2024-01-15',
          },
          relationship: 'Spouse',
          order: {
            numberOfCopies: 1,
          },
        },
      };

      const emailConfig = {
        to: '{{db:admin_email}}',
        subject:
          'New Death Certificate Application - {{formData.applicant.firstName}} {{formData.applicant.lastName}}',
        template: 'death-certificate',
      };

      const result = await service.resolveObjectExpressions(
        emailConfig,
        context,
      );
      expect(result).toEqual({
        to: 'registrar@gov.bb',
        subject: 'New Death Certificate Application - Mary Thompson',
        template: 'death-certificate',
      });
    });

    it('should resolve birth registration form with multiple names', async () => {
      const context: ExpressionContext = {
        formId: 'register-birth-form',
        formData: {
          child: {
            firstNames: 'Emily Rose',
            middleName: 'Grace',
            lastName: 'Anderson',
          },
          mother: {
            firstName: 'Jennifer',
            lastName: 'Anderson',
          },
        },
      };

      const subject =
        'New Birth Registration - {{formData.child.firstNames}} {{formData.child.lastName}}';
      const result = await service.resolveExpression(subject, context);
      expect(result).toBe('New Birth Registration - Emily Rose Anderson');
    });

    it('should resolve project protege mentor registration', async () => {
      const context: ExpressionContext = {
        formId: 'project-protege-mentor',
        formData: {
          personal: {
            firstName: 'David',
            lastName: 'Martinez',
            email: 'david.martinez@example.com',
          },
          expertise: 'Software Engineering',
        },
      };

      const subject =
        'New Project Protege Mentor Registration - {{formData.personal.firstName}} {{formData.personal.lastName}}';
      const result = await service.resolveExpression(subject, context);
      expect(result).toBe(
        'New Project Protege Mentor Registration - David Martinez',
      );
    });
  });
});
