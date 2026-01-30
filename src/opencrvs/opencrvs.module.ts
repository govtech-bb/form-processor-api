import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenCRVSService } from './opencrvs.service';
import { BirthRegistrationMapper } from './birth-registration.mapper';
import { OpenCRVSCacheService } from './opencrvs-cache.service';

@Module({
  imports: [ConfigModule],
  providers: [OpenCRVSCacheService, OpenCRVSService, BirthRegistrationMapper],
  exports: [OpenCRVSService, BirthRegistrationMapper],
})
export class OpenCRVSModule {}
