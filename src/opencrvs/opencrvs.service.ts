import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import {
  TokenResponse,
  CreateEventRequest,
  CreateEventResponse,
  NotifyRequest,
  NotifyResponse,
  BirthDeclaration,
  LocationBundle,
  LocationType,
} from './types';

@Injectable()
export class OpenCRVSService {
  private readonly logger = new Logger(OpenCRVSService.name);

  private readonly authBaseUrl: string;
  private readonly eventsBaseUrl: string;
  private readonly locationsBaseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  // Cache for access token with expiry
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  // Cache for location lookups to avoid repeated API calls
  private readonly locationCache: Map<string, string> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.authBaseUrl = this.configService.get<string>(
      'opencrvs.authBaseUrl',
      'https://auth.barbados-qa.opencrvs.org',
    );
    this.eventsBaseUrl = this.configService.get<string>(
      'opencrvs.eventsBaseUrl',
      'https://register.barbados-qa.opencrvs.org',
    );
    this.locationsBaseUrl = this.configService.get<string>(
      'opencrvs.locationsBaseUrl',
      'https://gateway.barbados-qa.opencrvs.org',
    );

    this.clientId = this.configService.get<string>('opencrvs.clientId', '');
    this.clientSecret = this.configService.get<string>(
      'opencrvs.clientSecret',
      '',
    );

    this.logger.log(
      `OpenCRVS service initialized - Auth: ${this.authBaseUrl}, Events: ${this.eventsBaseUrl}`,
    );
  }

  /**
   * Get an access token from the OpenCRVS auth service
   * Uses caching to avoid unnecessary token requests
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 5 minute buffer)
    if (
      this.accessToken &&
      this.tokenExpiry &&
      new Date() < new Date(this.tokenExpiry.getTime() - 5 * 60 * 1000)
    ) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        'OpenCRVS CLIENT_ID or CLIENT_SECRET not configured in environment',
      );
    }

    const url = new URL('/token', this.authBaseUrl);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('client_secret', this.clientSecret);
    url.searchParams.set('grant_type', 'client_credentials');

    this.logger.log(`Requesting OpenCRVS access token from: ${url.host}`);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Token request failed: ${res.status} ${errorText}`);
      throw new Error(`OpenCRVS token request failed: ${res.status}`);
    }

    const data = (await res.json()) as TokenResponse;

    if (!data.access_token) {
      throw new Error('OpenCRVS token response missing access_token');
    }

    this.accessToken = data.access_token;

    // Set expiry based on response or default to 1 hour
    const expiresIn = data.expires_in ?? 3600;
    this.tokenExpiry = new Date(Date.now() + expiresIn * 1000);

    this.logger.log('OpenCRVS access token obtained successfully');
    return this.accessToken;
  }

  /**
   * Create a new birth event in OpenCRVS
   */
  async createBirthEvent(transactionId?: string): Promise<CreateEventResponse> {
    const accessToken = await this.getAccessToken();

    const payload: CreateEventRequest = {
      type: 'birth',
      transactionId: transactionId ?? uuidv4(),
      dateOfEvent: { fieldId: 'child.dob' },
    };

    this.logger.log(
      `Creating birth event with transactionId: ${payload.transactionId}`,
    );

    const res = await fetch(`${this.eventsBaseUrl}/api/events/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Create event failed: ${res.status} ${errorText}`);
      throw new Error(`Create birth event failed: ${res.status}`);
    }

    const data = (await res.json()) as CreateEventResponse;

    if (!data.id) {
      throw new Error('Create event response missing id');
    }

    this.logger.log(`Birth event created: ${data.id} (${data.trackingId})`);
    return data;
  }

  /**
   * Submit a birth notification to OpenCRVS
   */
  async notifyBirthEvent(
    eventId: string,
    declaration: BirthDeclaration,
    createdAtLocation: string,
    annotation?: Record<string, unknown>,
  ): Promise<NotifyResponse> {
    const accessToken = await this.getAccessToken();

    const payload: NotifyRequest = {
      eventId,
      transactionId: uuidv4(),
      declaration,
      annotation: annotation ?? {},
      createdAtLocation,
      type: 'NOTIFY',
    };

    this.logger.log(`Notifying birth event: ${eventId}`);

    const res = await fetch(
      `${this.eventsBaseUrl}/api/events/events/notifications`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(`Notify event failed: ${res.status} ${errorText}`);
      return {
        success: false,
        error: `Notification failed: ${res.status} - ${errorText}`,
      };
    }

    const responseData = await res.json();
    this.logger.log(`Birth notification submitted for event: ${eventId}`);

    return {
      success: true,
      eventId,
      ...responseData,
    };
  }

  /**
   * Look up a location ID by name and type from OpenCRVS
   */
  async getLocationIdByName(
    locationName: string,
    locationType: LocationType,
  ): Promise<string> {
    const cacheKey = `${locationType}:${locationName}`;

    // Check cache first
    const cachedId = this.locationCache.get(cacheKey);
    if (cachedId) {
      return cachedId;
    }

    const url = `${this.locationsBaseUrl}/location?type=${locationType}`;

    this.logger.log(
      `Looking up ${locationType} location: "${locationName}" from ${url}`,
    );

    const res = await fetch(url);

    if (!res.ok) {
      const errorText = await res.text();
      this.logger.error(
        `Failed to fetch locations: ${res.status} ${errorText}`,
      );
      throw new Error(`Failed to fetch locations: ${res.status}`);
    }

    const data = (await res.json()) as LocationBundle;

    const match = data.entry?.find((e) => e.resource?.name === locationName);

    if (!match?.resource?.id) {
      throw new Error(
        `OpenCRVS location not found: "${locationName}" (type: ${locationType})`,
      );
    }

    // Cache the result
    this.locationCache.set(cacheKey, match.resource.id);

    this.logger.log(
      `Found location: "${locationName}" -> ${match.resource.id}`,
    );

    return match.resource.id;
  }

  /**
   * Register a birth by creating an event and submitting a notification
   * This is the main method that orchestrates the full registration flow
   */
  async registerBirth(
    declaration: BirthDeclaration,
    officeId: string,
    annotation?: Record<string, unknown>,
  ): Promise<{
    success: boolean;
    eventId?: string;
    trackingId?: string;
    transactionId?: string;
    error?: string;
  }> {
    try {
      // Step 1: Create the event
      const transactionId = uuidv4();
      const eventResponse = await this.createBirthEvent(transactionId);

      // Step 2: Submit the notification
      const notifyResponse = await this.notifyBirthEvent(
        eventResponse.id,
        declaration,
        officeId,
        annotation,
      );

      if (!notifyResponse.success) {
        return {
          success: false,
          eventId: eventResponse.id,
          error: notifyResponse.error,
        };
      }

      return {
        success: true,
        eventId: eventResponse.id,
        trackingId: eventResponse.trackingId,
        transactionId,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      this.logger.error(`Birth registration failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Clear the location cache (useful if locations are updated)
   */
  clearLocationCache(): void {
    this.locationCache.clear();
    this.logger.log('Location cache cleared');
  }

  /**
   * Clear the access token cache (useful for testing or token refresh)
   */
  clearTokenCache(): void {
    this.accessToken = null;
    this.tokenExpiry = null;
    this.logger.log('Token cache cleared');
  }
}
