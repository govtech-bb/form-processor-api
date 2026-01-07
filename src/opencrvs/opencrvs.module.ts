import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenCRVSService } from './opencrvs.service';
import { BirthRegistrationMapper } from './birth-registration.mapper';

@Module({
  imports: [ConfigModule],
  providers: [OpenCRVSService, BirthRegistrationMapper],
  exports: [OpenCRVSService, BirthRegistrationMapper],
})
export class OpenCRVSModule {}
