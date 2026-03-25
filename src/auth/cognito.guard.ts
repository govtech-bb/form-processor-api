import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import type { Request } from 'express';

/**
 * Validates Cognito-issued JWTs on incoming requests.
 *
 * Reads the Bearer token from the Authorization header, verifies its
 * signature against the User Pool's JWKS endpoint, and confirms the
 * token was issued for the configured app client. The JWKS response
 * is cached by aws-jwt-verify so repeated calls do not hit the network.
 *
 * Apply this guard only to write endpoints — read endpoints remain open
 * so the alpha-preview frontend can call them without user context.
 */
@Injectable()
export class CognitoGuard implements CanActivate {
  private readonly logger = new Logger(CognitoGuard.name);

  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;

  constructor(private readonly configService: ConfigService) {
    const userPoolId = this.configService.get<string>('cognito.userPoolId');
    const clientId = this.configService.get<string>('cognito.clientId');

    if (!userPoolId || !clientId) {
      throw new Error(
        'AWS_COGNITO_USER_POOL_ID and AWS_COGNITO_CLIENT_ID must be set to use CognitoGuard',
      );
    }

    this.verifier = CognitoJwtVerifier.create({
      userPoolId,
      clientId,
      tokenUse: 'access',
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    try {
      const payload = await this.verifier.verify(token);
      // Attach decoded claims so downstream handlers can access them if needed
      (request as Request & { cognitoClaims: typeof payload }).cognitoClaims =
        payload;
      return true;
    } catch (err) {
      this.logger.warn(`JWT verification failed: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }
}
