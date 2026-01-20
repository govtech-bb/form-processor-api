import { Injectable, Logger } from '@nestjs/common';
import {
  BirthDeclaration,
  Gender,
  PlaceOfBirth,
  BirthType,
  AttendantAtBirth,
  MaritalStatus,
  IdType,
  DomesticAddress,
  PersonName,
  AgeReference,
} from './types';

/**
 * Form data structure from register-birth-form.json schema
 * Updated to match the current schema structure
 */
export type BirthRegistrationFormData = {
  marriageStatus: 'yes' | 'no';
  includeFatherDetails?: 'yes' | 'no';

  father?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    age?: string;
    parish?: string;
    addressLine1?: string;
    addressLine2?: string;
    idNumber?: string; // National ID in format XXXXXX-XXXX
    passportNumber?: string;
    occupation?: string;
  };

  birth: {
    placeOfBirth: 'health-facility' | 'residential' | 'other';
    parish: string;
    streetAddress: string;
    numberOfBirths: 'single' | 'twins' | 'triplets' | 'more-than-triplets';
    attendantAtBirth: 'doctor' | 'midwife' | 'nurse' | 'relative' | 'none';
    liveBorn?: string;
    stillBorn?: string;
    totalStillAlive?: string;
    bornAlive?: string;
    stillborn?: string;
  };

  mother: {
    firstName: string;
    middleName?: string;
    lastName: string;
    maidenSurname?: string;
    parish: string;
    addressLine1: string;
    addressLine2?: string;
    idNumber?: string; // National ID in format XXXXXX-XXXX
    passportNumber?: string;
    occupation: string;
    telephoneNumber?: string;
  };

  child: {
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
    sexAtBirth: 'male' | 'female';
  };

  order: {
    numberOfCopies: number;
  };
};

/**
 * Configuration for the mapper
 */
type MapperConfig = {
  parishId: string;
  healthFacilityId?: string;
  defaultNationality?: string;
};

/**
 * Service to map form submission data to OpenCRVS BirthDeclaration format
 *
 * This mapper transforms the data structure from the Barbados birth registration
 * form into the format expected by the OpenCRVS API.
 *
 * Note: Informant fields are not required per OpenCRVS Barbados configuration.
 */
@Injectable()
export class BirthRegistrationMapper {
  private readonly logger = new Logger(BirthRegistrationMapper.name);

  /**
   * Map form data to OpenCRVS BirthDeclaration
   * Accepts Record<string, unknown> for flexibility with processor context
   */
  mapToBirthDeclaration(
    formData: BirthRegistrationFormData | Record<string, unknown>,
    config: MapperConfig,
  ): BirthDeclaration {
    const data = formData as BirthRegistrationFormData;

    this.logger.log('Mapping form data to OpenCRVS BirthDeclaration');

    // Map the form's place of birth to OpenCRVS PlaceOfBirth
    const openCRVSPlaceOfBirth = this.mapPlaceOfBirth(data.birth.placeOfBirth);

    const declaration: BirthDeclaration = {
      // Child information (required)
      'child.name': this.mapChildName(data.child),
      'child.gender': this.mapGender(data.child.sexAtBirth),
      'child.dob': this.formatDate(data.child.dateOfBirth),
      'child.placeOfBirth': openCRVSPlaceOfBirth,
      'child.birthType': this.mapBirthType(data.birth.numberOfBirths),
      'child.attendantAtBirth': this.mapAttendantAtBirth(
        data.birth.attendantAtBirth,
      ),

      // Set birth location based on place of birth
      ...(openCRVSPlaceOfBirth === 'HEALTH_FACILITY'
        ? config.healthFacilityId && {
            'child.birthLocation': config.healthFacilityId,
          }
        : {
            'child.birthLocation.privateHome': {
              addressType: 'DOMESTIC',
              country: 'BRB',
              administrativeArea: config.parishId,
              streetLevelDetails: {
                street: data.birth.streetAddress || 'sample address',
              },
            },
          }),

      // Mother information (always provided)
      'mother.detailsNotAvailable': false,
      'mother.name': this.mapMotherName(data.mother),
      'mother.age': data.mother.idNumber ? this.calculateAgeFromNRN(data.mother.idNumber) : this.calculateAge(data.mother, data.child.dateOfBirth),
      'mother.maritalStatus': this.mapMaritalStatus(data.marriageStatus),
      'mother.nationality': config.defaultNationality ?? 'BRB',
      ...this.mapMotherId(data.mother),
      'mother.address': this.mapAddress(
        data.mother.addressLine1,
        data.mother.addressLine2,
        config.parishId,
      ),
      'mother.occupation': data.mother.occupation,
      'mother.bornAlive': Number(data.birth.bornAlive),
      'mother.stillborn': Number(data.birth.stillborn),
      'mother.stillAlive': Number(data.birth.totalStillAlive),

      // Informant information
      'informant.relation': (data.marriageStatus === 'yes') ? 'PARENT' : 'OTHER',
      'informant.parentsMarried': (data.marriageStatus === 'yes') ? 'YES' : 'NO',
      'informant.phoneNo': data.mother.telephoneNumber,

      // Father information (conditional)
      ...this.mapFatherDetails(data, config),
    };

    this.logger.log(
      `Mapped birth declaration for child: ${declaration['child.name'].firstname} ${declaration['child.name'].surname}`,
    );

    return declaration;
  }

  /**
   * Map form's place of birth to OpenCRVS PlaceOfBirth enum
   */
  private mapPlaceOfBirth(
    placeOfBirth: BirthRegistrationFormData['birth']['placeOfBirth'],
  ): PlaceOfBirth {
    switch (placeOfBirth) {
      case 'health-facility':
        return 'HEALTH_FACILITY';
      case 'residential':
        return 'PRIVATE_HOME';
      case 'other':
      default:
        return 'OTHER';
    }
  }

  /**
   * Map number of births to OpenCRVS BirthType
   */
  private mapBirthType(
    numberOfBirths: BirthRegistrationFormData['birth']['numberOfBirths'],
  ): BirthType {
    switch (numberOfBirths) {
      case 'single':
        return 'SINGLE';
      case 'twins':
        return 'TWIN';
      case 'triplets':
        return 'TRIPLET';
      case 'more-than-triplets':
        return 'QUADRUPLET_OR_MORE';
      default:
        return 'SINGLE';
    }
  }

  /**
   * Map attendant at birth to OpenCRVS AttendantAtBirth
   */
  private mapAttendantAtBirth(
    attendant: BirthRegistrationFormData['birth']['attendantAtBirth'],
  ): AttendantAtBirth {
    switch (attendant) {
      case 'doctor':
        return 'DOCTOR';
      case 'midwife':
        return 'MIDWIFE';
      case 'nurse':
        return 'NURSE';
      case 'relative':
        return 'RELATIVE';
      case 'none':
        return 'NONE';
      default:
        return 'OTHER';
    }
  }

  /**
   * Map marriage status to OpenCRVS MaritalStatus
   */
  private mapMaritalStatus(marriageStatus: 'yes' | 'no'): MaritalStatus {
    return marriageStatus === 'yes' ? 'MARRIED' : 'SINGLE';
  }

  /**
   * Map child name from form data
   */
  private mapChildName(child: BirthRegistrationFormData['child']): PersonName {
    const fullFirstName = child.middleName
      ? `${child.firstName} ${child.middleName}`
      : child.firstName;

    return {
      firstname: fullFirstName,
      surname: child.lastName,
    };
  }

  /**
   * Map mother name from form data
   */
  private mapMotherName(
    mother: BirthRegistrationFormData['mother'],
  ): PersonName {
    const fullFirstName = mother.middleName
      ? `${mother.firstName} ${mother.middleName}`
      : mother.firstName;

    return {
      firstname: fullFirstName,
      surname: mother.lastName,
    };
  }

  /**
   * Map father name from form data
   */
  private mapFatherName(
    father: NonNullable<BirthRegistrationFormData['father']>,
  ): PersonName {
    const fullFirstName = father.middleName
      ? `${father.firstName} ${father.middleName}`
      : father.firstName ?? '';

    return {
      firstname: fullFirstName,
      surname: father.lastName ?? '',
    };
  }

  /**
   * Map sex at birth to OpenCRVS gender
   */
  private mapGender(sexAtBirth: 'male' | 'female'): Gender {
    return sexAtBirth;
  }

  /**
   * Format date to YYYY-MM-DD format expected by OpenCRVS
   */
  private formatDate(dateString: string): string {
    if (!dateString) {
      return '';
    }

    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    // Try to parse and format the date
    try {
      const date = new Date(dateString);
      return date.toISOString().slice(0, 10);
    } catch {
      this.logger.warn(`Could not parse date: ${dateString}`);
      return dateString;
    }
  }

  /**
   * Calculate age reference from parent data
   * OpenCRVS uses age relative to child's DOB
   */
  private calculateAge(
    parent: { age?: string } | BirthRegistrationFormData['mother'],
    childDob: string,
  ): AgeReference | undefined {
    const ageStr = 'age' in parent ? parent.age : undefined;
    if (!ageStr) {
      return undefined;
    }

    const age = parseInt(ageStr, 10);
    if (isNaN(age)) {
      return undefined;
    }

    return {
      age,
      asOfDateRef: 'child.dob',
    };
  }

  /**
   * Map address to OpenCRVS DomesticAddress format
   * Uses streetLevelDetails.street as per OpenCRVS API format
   */
  private mapAddress(
    addressLine1: string,
    addressLine2: string | undefined,
    parishId: string,
  ): DomesticAddress {
    const streetAddress = addressLine2
      ? `${addressLine1}, ${addressLine2}`
      : addressLine1;

    return {
      addressType: 'DOMESTIC',
      country: 'BRB',
      administrativeArea: parishId,
      streetLevelDetails: {
        street: streetAddress,
      },
    };
  }

  /**
   * Map mother's ID type and number
   * Note: OpenCRVS Barbados only accepts passport as ID type, not national ID
   */
  private mapMotherId(mother: BirthRegistrationFormData['mother']): {
    'mother.idType'?: IdType;
    'mother.passport'?: string;
    'mother.nationalRegistrationNumber'?: string;
  } {
    if (mother.idNumber) {
      return {
        'mother.idType': 'NATIONAL_REGISTRATION_NUMBER',
        'mother.nationalRegistrationNumber': mother.idNumber,
      };
    }
    if (mother.passportNumber) {
      return {
        'mother.idType': 'PASSPORT',
        'mother.passport': mother.passportNumber,
      };
    }

    // OpenCRVS Barbados doesn't support national ID (nid field)
    // so we set idType to NONE if no passport is provided
    return {
      'mother.idType': 'NONE',
    };
  }

  /**
   * Map father's ID type and number
   * Note: OpenCRVS Barbados only accepts passport as ID type, not national ID
   */
  private mapFatherId(
    father: NonNullable<BirthRegistrationFormData['father']>,
  ): {
    'father.idType'?: IdType;
    'father.passport'?: string;
    'father.nationalRegistrationNumber'?: string;
  } {
    if (father.idNumber) {
      return {
        'father.idType': 'NATIONAL_REGISTRATION_NUMBER',
        'father.nationalRegistrationNumber': father.idNumber,
      };
    }
    if (father.passportNumber) {
      return {
        'father.idType': 'PASSPORT',
        'father.passport': father.passportNumber,
      };
    }

    // OpenCRVS Barbados doesn't support national ID (nid field)
    // so we set idType to NONE if no passport is provided
    return {
      'father.idType': 'NONE',
    };
  }

  /**
   * Map father details based on form conditions
   * Father details are included if:
   * - Parents are married (marriageStatus === 'yes')
   * - OR user explicitly wants to include father details (includeFatherDetails === 'yes')
   */
  private mapFatherDetails(
    formData: BirthRegistrationFormData,
    config: MapperConfig,
  ): Partial<BirthDeclaration> {
    const includeFather =
      formData.marriageStatus === 'yes' ||
      formData.includeFatherDetails === 'yes';

    if (!includeFather || !formData.father) {
      return {
        'father.detailsNotAvailable': true,
        'father.reason': 'Details not provided',
      };
    }

    const father = formData.father;

    // Check if father has sufficient details
    if (!father.firstName || !father.lastName) {
      return {
        'father.detailsNotAvailable': true,
        'father.reason': 'Incomplete father details',
      };
    }

    // Determine if father uses same address as mother
    const useSameAddress = !father.addressLine1;

    return {
      'father.detailsNotAvailable': false,
      'father.name': this.mapFatherName(father),
      'father.age': father.idNumber ? this.calculateAgeFromNRN(father.idNumber) : this.calculateAge(father, formData.child.dateOfBirth),
      'father.nationality': config.defaultNationality ?? 'BRB',
      ...this.mapFatherId(father),
      'father.occupation': father.occupation,
      ...(useSameAddress
        ? { 'father.addressSameAs': true }
        : {
            'father.address': this.mapAddress(
              father.addressLine1!,
              father.addressLine2,
              config.parishId,
            ),
          }),
    };
  }

  /**
   * Calculates age from a National Registration Number (NRN) in format YYMMDD-XXXX
   * @param nrn The National Registration Number (e.g., "920320-0016")
   * @returns The age in years
  */
  private calculateAgeFromNRN(nrn: string): { age: number; asOfDateRef: string } {
    // Extract the date parts from NRN
    const year = parseInt(nrn.substring(0, 2));
    const month = parseInt(nrn.substring(2, 4)) - 1; // JavaScript months are 0-indexed
    const day = parseInt(nrn.substring(4, 6));
    
    // Handle Y2K: Assume 1900s for years 00-20, 2000s for 21-99
    const fullYear = year <= 20 ? 2000 + year : 1900 + year;
    
    // Create date objects
    const birthDate = new Date(fullYear, month, day);
    const today = new Date();
    
    // Calculate age
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    // Adjust age if birthday hasn't occurred yet this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return {
      age,
      asOfDateRef: 'child.dob'
    };
  }


  /**
   * Create annotation object for OpenCRVS
   * OpenCRVS has a strict schema and rejects unknown fields,
   * so we return an empty object. Form metadata is preserved
   * in our own submission records.
   */
  createAnnotation(
    _formData: BirthRegistrationFormData | Record<string, unknown>,
  ): Record<string, unknown> {
    // OpenCRVS rejects custom annotation fields - return empty object
    return {};
  }
}
