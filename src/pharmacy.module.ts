import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CqrsModule } from '@nestjs/cqrs';
import { Pharmacy, PharmacySchema } from './infrastructure/database/schemas/pharmacy.schema';
import { DeviceReputation, DeviceReputationSchema } from './infrastructure/database/schemas/device-reputation.schema';
import { PharmacyRepository } from './infrastructure/database/repositories/pharmacy.repository';
import { PharmacyController } from './presentation/controllers/pharmacy.controller';
import { ScrapingController } from './presentation/controllers/scraping.controller';
import { GeoRefService } from './application/services/georef.service';
import { GeoValidationService } from './infrastructure/security/geo-validation.service';
import { ReputationService } from './infrastructure/security/reputation.service';
import { ConfigModule } from '@nestjs/config';

import { ScrapeTurnosJujuyHandler } from './application/commands/scrape-turnos-jujuy.handler';
import { GetNearbyPharmaciesHandler } from './application/queries/get-nearby-pharmacies.handler';
import { GetPharmaciesByDateHandler } from './application/queries/get-pharmacies-by-date.handler';
import { TurnosJujuyScraperService } from './application/services/turnos-jujuy-scraper.service';
import { ScrapingRun, ScrapingRunSchema } from './infrastructure/database/schemas/scraping-run.schema';
import { Feedback, FeedbackSchema } from './infrastructure/database/schemas/feedback.schema';
import { FeedbackController } from './presentation/controllers/feedback.controller';

const CommandHandlers = [ScrapeTurnosJujuyHandler];
const QueryHandlers = [GetNearbyPharmaciesHandler, GetPharmaciesByDateHandler];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pharmacy.name, schema: PharmacySchema },
      { name: DeviceReputation.name, schema: DeviceReputationSchema },
      { name: ScrapingRun.name, schema: ScrapingRunSchema },
      { name: Feedback.name, schema: FeedbackSchema },
    ]),
    ConfigModule,
    CqrsModule,
  ],
  controllers: [PharmacyController, ScrapingController, FeedbackController],
  providers: [
    {
      provide: 'IPharmacyRepository',
      useClass: PharmacyRepository,
    },
    GeoRefService,
    TurnosJujuyScraperService,
    GeoValidationService,
    ReputationService,
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [
    GeoRefService,
    TurnosJujuyScraperService,
    'IPharmacyRepository',
    GeoValidationService,
    ReputationService,
  ],
})
export class PharmacyModule {}
