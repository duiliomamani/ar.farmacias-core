import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { Pharmacy, PharmacySchema } from './infrastructure/database/schemas/pharmacy.schema';
import { PharmacyReport, PharmacyReportSchema } from './infrastructure/database/schemas/pharmacy-report.schema';
import { DeviceReputation, DeviceReputationSchema } from './infrastructure/database/schemas/device-reputation.schema';
import { PharmacyRepository } from './infrastructure/database/repositories/pharmacy.repository';
import { PharmacyController } from './presentation/controllers/pharmacy.controller';
import { PharmacyReportController } from './presentation/controllers/pharmacy-report.controller';
import { ScrapingController } from './presentation/controllers/scraping.controller';
import { GeoRefService } from './application/services/georef.service';
import { AiNormalizerService } from './application/services/ai-normalizer.service';
import { ScraperFactory } from './application/services/scraper.factory';
import { GeoValidationService } from './infrastructure/security/geo-validation.service';
import { ReputationService } from './infrastructure/security/reputation.service';
import { ColfarjuyScraperService } from './application/services/colfarjuy-scraper.service';
import { ConfigModule } from '@nestjs/config';

import { ScrapeColfarjuyHandler } from './application/commands/scrape-colfarjuy.handler';
import { SubmitPharmacyReportHandler } from './application/commands/submit-pharmacy-report.handler';
import { GetNearbyPharmaciesHandler } from './application/queries/get-nearby-pharmacies.handler';
import { GetPharmaciesByDateHandler } from './application/queries/get-pharmacies-by-date.handler';

const CommandHandlers = [ScrapeColfarjuyHandler, SubmitPharmacyReportHandler];
const QueryHandlers = [GetNearbyPharmaciesHandler, GetPharmaciesByDateHandler];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pharmacy.name, schema: PharmacySchema },
      { name: PharmacyReport.name, schema: PharmacyReportSchema },
      { name: DeviceReputation.name, schema: DeviceReputationSchema },
    ]),
    ConfigModule,
    CqrsModule,
  ],
  controllers: [PharmacyController, PharmacyReportController, ScrapingController],
  providers: [
    {
      provide: 'IPharmacyRepository',
      useClass: PharmacyRepository,
    },
    GeoRefService,
    AiNormalizerService,
    ScraperFactory,
    ColfarjuyScraperService,
    GeoValidationService,
    ReputationService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [
    GeoRefService,
    AiNormalizerService,
    ScraperFactory,
    ColfarjuyScraperService,
    'IPharmacyRepository',
    GeoValidationService,
    ReputationService,
  ],
})
export class PharmacyModule {}
