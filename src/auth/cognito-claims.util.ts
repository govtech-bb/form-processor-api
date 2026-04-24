import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

type CognitoClaims = Record<string, unknown>;

export function readStringClaim(
  claims: CognitoClaims,
  key: string,
): string | null {
  const value = claims[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Extracts the cognitoClaims object attached by CognitoGuard from the request.
 * Throws UnauthorizedException if the guard did not run or claims are absent.
 */
export function extractCognitoClaims(request: Request): CognitoClaims {
  const claims = (
    request as Request & { cognitoClaims?: CognitoClaims }
  ).cognitoClaims;

  if (!claims) {
    throw new UnauthorizedException('Missing Cognito claims in request');
  }

  return claims;
}

/**
 * Returns the most useful identifier claim from a verified Cognito token.
 * Preference order: email → username → cognito:username → sub.
 */
export function resolveActorFromClaims(claims: CognitoClaims): string {
  const actor =
    readStringClaim(claims, 'email') ??
    readStringClaim(claims, 'username') ??
    readStringClaim(claims, 'cognito:username') ??
    readStringClaim(claims, 'sub');

  if (!actor) {
    throw new UnauthorizedException('No usable actor claim found in token');
  }

  return actor;
}

/**
 * Returns a human-readable display name from verified Cognito token claims,
 * or null if the user pool is not configured to include name attributes in
 * access tokens. Never returns a client-supplied value.
 */
export function resolveActorNameFromClaims(
  claims: CognitoClaims,
): string | null {
  return readStringClaim(claims, 'name') ?? readStringClaim(claims, 'given_name') ?? null;
}
