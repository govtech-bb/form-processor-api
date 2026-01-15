/**
 * OpenCRVS integration types for Barbados Civil Registration
 * Based on the OpenCRVS Barbados QA API format
 */

// ============================================================================
// Authentication Types
// ============================================================================

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

// ============================================================================
// Event Types
// ============================================================================

export type CreateEventRequest = {
  type: 'birth' | 'death' | 'marriage';
  transactionId: string;
  dateOfEvent: { fieldId: string };
};

export type CreateEventResponse = {
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  trackingId: string;
  actions: Array<unknown>;
};

// ============================================================================
// Common Building Blocks
// ============================================================================

export type Gender = 'male' | 'female' | 'unknown';

export type PlaceOfBirth = 'HEALTH_FACILITY' | 'PRIVATE_HOME' | 'OTHER';

export type BirthType = 'SINGLE' | 'TWIN' | 'TRIPLET' | 'QUADRUPLET_OR_MORE';

export type AttendantAtBirth =
  | 'DOCTOR'
  | 'MIDWIFE'
  | 'NURSE'
  | 'RELATIVE'
  | 'NONE'
  | 'OTHER';

export type MaritalStatus =
  | 'SINGLE'
  | 'MARRIED'
  | 'WIDOWED'
  | 'DIVORCED'
  | 'SEPARATED'
  | 'NOT_STATED';

export type InformantRelation =
  | 'FATHER'
  | 'MOTHER'
  | 'GRANDFATHER'
  | 'GRANDMOTHER'
  | 'BROTHER'
  | 'SISTER'
  | 'LEGAL_GUARDIAN'
  | 'OTHER';

export type IdType =
  | 'NATIONAL_ID'
  | 'PASSPORT'
  | 'BIRTH_REGISTRATION_NUMBER'
  | 'NONE';

/**
 * Address structure matching OpenCRVS API format
 * Uses streetLevelDetails.street instead of direct street field
 */
export type DomesticAddress = {
  addressType: 'DOMESTIC';
  country: 'BRB' | string;
  administrativeArea: string; // parish ID
  streetLevelDetails?: {
    street?: string;
  };
};

export type PersonName = {
  firstname: string;
  surname: string;
};

/**
 * Age reference structure used by OpenCRVS
 * Age is calculated relative to a date field (e.g., child's DOB)
 */
export type AgeReference = {
  age: number;
  asOfDateRef: string; // Reference to date field, e.g., "child.dob"
};

// ============================================================================
// Birth Declaration Types
// ============================================================================

/**
 * Birth declaration payload matching the OpenCRVS Barbados QA API format
 * Based on the Postman collection structure
 */
export type BirthDeclaration = {
  // Child information (required)
  'child.name': PersonName;
  'child.gender': Gender;
  'child.dob': string; // YYYY-MM-DD
  'child.placeOfBirth': PlaceOfBirth;
  'child.birthLocation'?: string; // Hospital/facility ID when placeOfBirth = HEALTH_FACILITY
  'child.birthType'?: BirthType;
  'child.attendantAtBirth'?: AttendantAtBirth;
  'child.parish'?: string;
  'child.streetAddress'?: string;
  'child.reason'?: string; // Reason for delayed registration

  // Mother information
  'mother.detailsNotAvailable'?: boolean;
  'mother.reason'?: string;
  'mother.name'?: PersonName;
  'mother.age'?: AgeReference;
  'mother.maritalStatus'?: MaritalStatus;
  'mother.nationality'?: string;
  'mother.idType'?: IdType;
  'mother.nid'?: string;
  'mother.passport'?: string;
  'mother.brn'?: string;
  'mother.address'?: DomesticAddress;
  'mother.occupation'?: string;

  // Father information
  'father.detailsNotAvailable'?: boolean;
  'father.reason'?: string;
  'father.name'?: PersonName;
  'father.age'?: AgeReference;
  'father.nationality'?: string;
  'father.idType'?: IdType;
  'father.nid'?: string;
  'father.passport'?: string;
  'father.brn'?: string;
  'father.occupation'?: string;
  'father.addressSameAs'?: boolean; // true to use mother's address
  'father.address'?: DomesticAddress;
};

// ============================================================================
// Notification Types
// ============================================================================

export type NotifyRequest = {
  eventId: string;
  transactionId: string;
  declaration: BirthDeclaration;
  annotation: Record<string, unknown>;
  createdAtLocation: string;
  type: 'NOTIFY';
};

export type NotifyResponse = {
  success: boolean;
  eventId?: string;
  trackingId?: string;
  error?: string;
};

// ============================================================================
// Location Types
// ============================================================================

export type LocationBundle = {
  entry?: Array<{
    resource?: {
      id?: string;
      name?: string;
    };
  }>;
};

export type LocationType =
  | 'CRVS_OFFICE'
  | 'HEALTH_FACILITY'
  | 'ADMIN_STRUCTURE';

// ============================================================================
// Service Configuration Types
// ============================================================================

export type OpenCRVSConfig = {
  authBaseUrl: string;
  eventsBaseUrl: string;
  locationsBaseUrl: string;
  clientId: string;
  clientSecret: string;
  defaultOffice?: string;
  defaultHealthFacility?: string;
  defaultParish?: string;
};

// ============================================================================
// Processor Configuration Types
// ============================================================================

export type OpenCRVSProcessorConfig = {
  eventType: 'birth';
  officeId?: string; // Location ID or use mapping
  officeName?: string; // Will be resolved to ID
  healthFacilityId?: string; // Location ID or use mapping
  healthFacilityName?: string; // Will be resolved to ID
  parishId?: string; // Location ID or use mapping
  parishName?: string; // Will be resolved to ID
};

// ============================================================================
// Result Types
// ============================================================================

export type OpenCRVSProcessorResult = {
  success: boolean;
  eventId?: string;
  trackingId?: string;
  transactionId?: string;
  error?: string;
};
