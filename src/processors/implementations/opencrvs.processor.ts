import { Injectable, Logger } from '@nestjs/common';
import { IProcessor, ProcessorContext } from '../interfaces';
import { OpenCRVSService, BirthRegistrationMapper } from '../../opencrvs';
import {
  OpenCRVSProcessorConfig,
  OpenCRVSProcessorResult,
} from '../../opencrvs/types';

/**
 * Processor for integrating birth registration form submissions with OpenCRVS
 *
 * This processor handles:
 * 1. Resolving location IDs (office, health facility, parish) from names or IDs
 * 2. Mapping form data to OpenCRVS BirthDeclaration format
 * 3. Creating the birth event in OpenCRVS
 * 4. Submitting the birth notification
 *
 * Note: Informant fields are not required per OpenCRVS Barbados configuration.
 */
@Injectable()
export class OpenCRVSProcessor implements IProcessor {
  readonly type = 'opencrvs';
  private readonly logger = new Logger(OpenCRVSProcessor.name);

  constructor(
    private readonly openCRVSService: OpenCRVSService,
    private readonly birthMapper: BirthRegistrationMapper,
  ) {}

  async execute(
    config: Record<string, unknown>,
    context: ProcessorContext,
  ): Promise<OpenCRVSProcessorResult> {
    this.logger.log(
      `Executing OpenCRVS processor for form: ${context.formId}, submission: ${context.submissionId}`,
    );

    const processorConfig = config as unknown as OpenCRVSProcessorConfig;

    try {
      // Validate event type
      if (processorConfig.eventType !== 'birth') {
        throw new Error(
          `Unsupported event type: ${processorConfig.eventType}. Only 'birth' is currently supported.`,
        );
      }

      // Resolve location IDs
      const { officeId, healthFacilityId, parishId } =
        await this.resolveLocations(processorConfig, context.data);

      // Map form data to OpenCRVS declaration format
      // Note: Informant fields are not required per OpenCRVS Barbados configuration
      const declaration = this.birthMapper.mapToBirthDeclaration(context.data, {
        parishId,
        healthFacilityId,
        defaultNationality: 'BRB',
      });

      // Create annotation (empty - OpenCRVS rejects custom fields)
      const annotation = this.birthMapper.createAnnotation(context.data);

      // Register the birth with OpenCRVS
      const result = await this.openCRVSService.registerBirth(
        declaration,
        officeId,
        annotation,
      );

      if (result.success) {
        this.logger.log(
          `Birth registration successful for ${context.submissionId}: eventId=${result.eventId}, trackingId=${result.trackingId}`,
        );
      } else {
        this.logger.error(
          `Birth registration failed for ${context.submissionId}: ${result.error}`,
        );
      }

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `OpenCRVS processor failed for ${context.submissionId}: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Resolve location IDs from configuration
   * Supports both direct IDs and name-based lookups
   */
  private async resolveLocations(
    config: OpenCRVSProcessorConfig,
    formData: Record<string, unknown>,
  ): Promise<{
    officeId: string;
    healthFacilityId?: string;
    parishId: string;
  }> {
    // Resolve CRVS Office ID
    let officeId = config.officeId;
    if (!officeId && config.officeName) {
      officeId = await this.openCRVSService.getLocationIdByName(
        config.officeName,
        'CRVS_OFFICE',
      );
    }
    if (!officeId) {
      // Default to main Registration Department
      officeId = await this.openCRVSService.getLocationIdByName(
        'Registration Department Records Branch',
        'CRVS_OFFICE',
      );
    }

    // Resolve Health Facility ID (optional - only needed if birth.placeOfBirth is health-facility)
    let healthFacilityId = config.healthFacilityId;
    if (!healthFacilityId && config.healthFacilityName) {
      healthFacilityId = await this.openCRVSService.getLocationIdByName(
        config.healthFacilityName,
        'HEALTH_FACILITY',
      );
    }

    // Resolve Parish ID from config first
    let parishId = config.parishId;
    if (!parishId && config.parishName) {
      parishId = await this.openCRVSService.getLocationIdByName(
        config.parishName,
        'ADMIN_STRUCTURE',
      );
    }

    // Try to get parish from mother's parish field in form data
    if (!parishId) {
      const motherData = formData.mother as { parish?: string } | undefined;
      const motherParish = motherData?.parish;

      if (motherParish) {
        try {
          parishId = await this.openCRVSService.getLocationIdByName(
            motherParish,
            'ADMIN_STRUCTURE',
          );
        } catch {
          this.logger.warn(
            `Could not resolve parish from mother's address: ${motherParish}`,
          );
        }
      }
    }

    // Default parish if still not resolved
    if (!parishId) {
      parishId = await this.openCRVSService.getLocationIdByName(
        'Christ Church',
        'ADMIN_STRUCTURE',
      );
    }

    return { officeId, healthFacilityId, parishId };
  }
}
