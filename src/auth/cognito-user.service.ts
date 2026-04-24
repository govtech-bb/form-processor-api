import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import type { Request } from 'express';
import {
  extractCognitoClaims,
  resolveActorFromClaims,
  resolveActorNameFromClaims,
} from './cognito-claims.util';

export type ResolvedActor = {
  /** Verified identity used for audit attribution — email preferred over sub. */
  actor: string;
  /** Display name from the user pool, or null if not configured on the user. */
  actorName: string | null;
};

/**
 * Resolves the actor identity for audit logging by calling Cognito's GetUser
 * API with the request's access token. This returns the full set of user pool
 * attributes (email, name, etc.) that are not included in the access token
 * payload by default.
 *
 * Falls back to reading claims already decoded by CognitoGuard if the
 * GetUser call fails (e.g. transient network error).
 */
@Injectable()
export class CognitoUserService {
  private readonly logger = new Logger(CognitoUserService.name);
  private readonly cognitoClient: CognitoIdentityProviderClient;

  constructor(private readonly configService: ConfigService) {
    this.cognitoClient = new CognitoIdentityProviderClient({
      region: this.configService.get<string>('aws.region') ?? 'us-east-1',
    });
  }

  /**
   * Returns the actor identity for the authenticated user on the request.
   *
   * Resolution order for actor (ID):   email → cognito username → sub
   * Resolution order for actorName:    name → given_name + family_name → null
   */
  async resolveActor(request: Request): Promise<ResolvedActor> {
    const accessToken = this.extractBearerToken(request);

    if (accessToken) {
      try {
        return await this.resolveFromGetUser(accessToken);
      } catch (err) {
        this.logger.warn(
          `GetUser failed, falling back to token claims: ${(err as Error).message}`,
        );
      }
    }

    return this.resolveFromClaims(request);
  }

  private async resolveFromGetUser(accessToken: string): Promise<ResolvedActor> {
    const response = await this.cognitoClient.send(
      new GetUserCommand({ AccessToken: accessToken }),
    );

    const attrs = new Map(
      response.UserAttributes?.map((a) => [a.Name ?? '', a.Value ?? '']) ?? [],
    );

    const actor =
      attrs.get('email') ??
      response.Username ??
      attrs.get('sub') ??
      'unknown';

    const name = attrs.get('name') ?? '';
    const givenName = attrs.get('given_name') ?? '';
    const familyName = attrs.get('family_name') ?? '';

    let actorName: string | null = null;
    if (name) {
      actorName = name;
    } else if (givenName || familyName) {
      actorName = [givenName, familyName].filter(Boolean).join(' ');
    }

    return { actor, actorName };
  }

  private resolveFromClaims(request: Request): ResolvedActor {
    const claims = extractCognitoClaims(request);
    return {
      actor: resolveActorFromClaims(claims),
      actorName: resolveActorNameFromClaims(claims),
    };
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  }
}
