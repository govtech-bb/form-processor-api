import { Module } from '@nestjs/common';
import { CognitoGuard } from './cognito.guard';

@Module({
  providers: [CognitoGuard],
  exports: [CognitoGuard],
})
export class AuthModule {}
