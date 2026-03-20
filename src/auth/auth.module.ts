import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CognitoGuard } from './cognito.guard';

@Module({
  imports: [ConfigModule],
  providers: [CognitoGuard],
  exports: [CognitoGuard],
})
export class AuthModule {}
