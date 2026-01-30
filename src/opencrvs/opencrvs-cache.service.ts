import { Injectable, Logger } from '@nestjs/common';
import * as NodeCache from 'node-cache';

export interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

@Injectable()
export class OpenCRVSCacheService {
  private readonly logger = new Logger(OpenCRVSCacheService.name);
  private readonly cache: NodeCache;

  // Cache keys
  private static readonly TOKEN_KEY = 'opencrvs_access_token';
  private static readonly LOCATION_PREFIX = 'location:';

  // Default TTLs (in seconds)
  private static readonly LOCATION_TTL = 3600; // 1 hour for locations

  constructor() {
    this.cache = new NodeCache({
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false, // Don't clone objects for better performance
    });

    this.cache.on('expired', (key: string) => {
      this.logger.debug(`Cache key expired: ${key}`);
    });
  }

  /**
   * Store access token with TTL based on expiration time
   * Includes a 5-minute buffer before actual expiry
   */
  setAccessToken(accessToken: string, expiresIn: number): void {
    // Apply 2-minute buffer to TTL
    const bufferSeconds = 2 * 60;
    const ttl = Math.max(expiresIn - bufferSeconds, 0);

    if (ttl <= 0) {
      this.logger.warn('Token TTL is too short, not caching');
      return;
    }

    this.cache.set(OpenCRVSCacheService.TOKEN_KEY, accessToken, ttl);
    this.logger.debug(`Access token cached with TTL: ${ttl}s`);
  }

  /**
   * Get cached access token if valid
   */
  getAccessToken(): string | undefined {
    return this.cache.get<string>(OpenCRVSCacheService.TOKEN_KEY);
  }

  /**
   * Clear the access token from cache
   */
  clearAccessToken(): void {
    this.cache.del(OpenCRVSCacheService.TOKEN_KEY);
    this.logger.debug('Access token cache cleared');
  }

  /**
   * Store location ID with TTL
   */
  setLocation(
    locationType: string,
    locationName: string,
    locationId: string,
    ttl: number = OpenCRVSCacheService.LOCATION_TTL,
  ): void {
    const key = `${OpenCRVSCacheService.LOCATION_PREFIX}${locationType}:${locationName}`;
    this.cache.set(key, locationId, ttl);
    this.logger.debug(`Location cached: ${key} -> ${locationId}`);
  }

  /**
   * Get cached location ID
   */
  getLocation(locationType: string, locationName: string): string | undefined {
    const key = `${OpenCRVSCacheService.LOCATION_PREFIX}${locationType}:${locationName}`;
    return this.cache.get<string>(key);
  }

  /**
   * Clear all location entries from cache
   */
  clearLocations(): void {
    const keys = this.cache
      .keys()
      .filter((key) => key.startsWith(OpenCRVSCacheService.LOCATION_PREFIX));
    keys.forEach((key) => this.cache.del(key));
    this.logger.debug(`Cleared ${keys.length} location cache entries`);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.flushAll();
    this.logger.debug('All cache entries cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): NodeCache.Stats {
    return this.cache.getStats();
  }
}
