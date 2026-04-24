import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CognitoGuard } from './cognito.guard';
import { CognitoUserService } from './cognito-user.service';

@Module({
  imports: [ConfigModule],
  providers: [CognitoGuard, CognitoUserService],
  exports: [CognitoGuard, CognitoUserService],
})
export class AuthModule {}
