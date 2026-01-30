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
import { OpenCRVSCacheService } from './opencrvs-cache.service';

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
   * Uses node-cache for TTL-based token management
   * @param forceRefresh - If true, ignores cached token and fetches a new one
   */
  async getAccessToken(forceRefresh = false): Promise<string> {
    // Return cached token if still valid (unless force refresh)
    if (!forceRefresh) {
      const cachedToken = this.cacheService.getAccessToken();
      if (cachedToken) {
        return cachedToken;
      }
    } else {
      // Clear the cached token when forcing refresh
      this.cacheService.clearAccessToken();
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

    // Cache the token with TTL (includes 5-minute buffer)
    const expiresIn = data.expires_in ?? 3600;
    this.cacheService.setAccessToken(data.access_token, expiresIn);

    this.logger.log('OpenCRVS access token obtained successfully');
    return data.access_token;
  }

  /**
   * Make an authenticated request with automatic token refresh on 401
   * @param url - The URL to request
   * @param options - Fetch options (without Authorization header)
   * @param isRetry - Internal flag to prevent infinite retry loops
   * @returns The fetch Response
   */
  private async authenticatedFetch(
    url: string,
    options: RequestInit = {},
    isRetry = false,
  ): Promise<Response> {
    const accessToken = await this.getAccessToken();

    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // If we get a 401 and haven't retried yet, refresh token and retry once
    if (res.status === 401 && !isRetry) {
      this.logger.warn('Received 401, refreshing token and retrying request');
      await this.getAccessToken(true);
      return this.authenticatedFetch(url, options, true);
    }

    return res;
  }

  /**
   * Create a new birth event in OpenCRVS
   */
  async createBirthEvent(transactionId?: string): Promise<CreateEventResponse> {
    const payload: CreateEventRequest = {
      type: 'birth',
      transactionId: transactionId ?? uuidv4(),
      dateOfEvent: { fieldId: 'child.dob' },
    };

    this.logger.log(
      `Creating birth event with transactionId: ${payload.transactionId}`,
    );

    const res = await this.authenticatedFetch(
      `${this.eventsBaseUrl}/api/events/events`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

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
    const payload: NotifyRequest = {
      eventId,
      transactionId: uuidv4(),
      declaration,
      annotation: annotation ?? {},
      createdAtLocation,
      type: 'NOTIFY',
    };

    this.logger.log(`Notifying birth event: ${eventId}`);

    const res = await this.authenticatedFetch(
      `${this.eventsBaseUrl}/api/events/events/notifications`,
      {
        method: 'POST',
        headers: {
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
    // Check cache first
    const cachedId = this.cacheService.getLocation(locationType, locationName);
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
    this.cacheService.setLocation(
      locationType,
      locationName,
      match.resource.id,
    );

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
    this.cacheService.clearLocations();
    this.logger.log('Location cache cleared');
  }

  /**
   * Clear the access token cache (useful for testing or token refresh)
   */
  clearTokenCache(): void {
    this.cacheService.clearAccessToken();
    this.logger.log('Token cache cleared');
  }
}
