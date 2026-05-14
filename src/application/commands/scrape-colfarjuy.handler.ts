import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScrapeColfarjuyCommand } from './scrape-colfarjuy.command';
import { ColfarjuyScraperService } from '../services/colfarjuy-scraper.service';
import { AiNormalizerService } from '../services/ai-normalizer.service';
import { GeoRefService } from '../services/georef.service';
import { Pharmacy, PharmacyDocument } from '../../infrastructure/database/schemas/pharmacy.schema';
import { Logger } from '@nestjs/common';

@CommandHandler(ScrapeColfarjuyCommand)
export class ScrapeColfarjuyHandler implements ICommandHandler<ScrapeColfarjuyCommand> {
  private readonly logger = new Logger(ScrapeColfarjuyHandler.name);

  constructor(
    private readonly colfarjuyScraper: ColfarjuyScraperService,
    private readonly aiNormalizerService: AiNormalizerService,
    private readonly geoRefService: GeoRefService,
    @InjectModel(Pharmacy.name) private readonly pharmacyModel: Model<PharmacyDocument>,
  ) { }

  async execute(_command: ScrapeColfarjuyCommand): Promise<void> {
    this.logger.log('Executing Colfarjuy Scraping Command...');

    try {
      await this.processRegion('Capital');
      await this.processRegion('Interior');
    } catch (error: any) {
      this.logger.error(`Scraping command failed: ${error.message}`);
      throw error;
    }
  }

  private async processRegion(region: 'Capital' | 'Interior'): Promise<void> {
    const rawText = await this.colfarjuyScraper.scrapeRegion(region);
    if (!rawText) return;

    const weeksToScrape = 4;
    for (let i = 0; i < weeksToScrape; i++) {
      const start = new Date();
      start.setUTCDate(start.getUTCDate() + (i * 7));
      const end = new Date();
      end.setUTCDate(end.getUTCDate() + ((i + 1) * 7) - 1);

      const dateRange = {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      };

      this.logger.log(`Processing chunk ${i + 1}/${weeksToScrape}: ${dateRange.start} to ${dateRange.end} for ${region}`);
      const structuredData = await this.aiNormalizerService.normalizeColfarjuyText(rawText, region, dateRange);
      
      if (structuredData && structuredData.length > 0) {
        await this.saveNormalizedPharmacies(structuredData);
      } else {
        this.logger.debug(`No data found for range ${dateRange.start} - ${dateRange.end}`);
      }
    }
  }

  private async saveNormalizedPharmacies(pharmacies: any[]): Promise<void> {
    for (const data of pharmacies) {
      const mappedCity = this.mapCityName(data.city);
      
      if (!data.dutyUntil || !data.dutyFrom) {
        this.logger.warn(`Skipping pharmacy ${data.name} because duty dates are missing.`);
        continue;
      }

      this.logger.debug(`Processing pharmacy: ${data.name} in ${mappedCity}`);

      const geo = await this.geoRefService.geocodeAddress(data.address, mappedCity);
      
      const dutyFromDate = new Date(data.dutyFrom);
      const dutyUntilDate = new Date(data.dutyUntil);

      if (isNaN(dutyFromDate.getTime()) || isNaN(dutyUntilDate.getTime())) {
        this.logger.error(`Invalid date received for pharmacy ${data.name}: ${data.dutyFrom} - ${data.dutyUntil}`);
        continue; 
      }

      const updateData: any = {
        ...data,
        city: mappedCity,
        source_type: 'COLFARJUY_OFFICIAL',
        isOnDuty: data.isOnDuty ?? true,
        dutyFrom: dutyFromDate,
        dutyUntil: dutyUntilDate,
        openingHours: data.openingHours,
        isPermanentlyOnDuty: data.isPermanentlyOnDuty ?? false,
        isVoluntary: data.isVoluntary ?? false,
        updatedAt: new Date(),
      };

      const updateOps: any = { $set: updateData };

      if (geo && !isNaN(geo.lat) && !isNaN(geo.lng)) {
        updateData.location = {
          type: 'Point',
          coordinates: [geo.lng, geo.lat],
        };
        updateData.georef = {
          provinciaId: geo.provinciaId,
          municipioId: geo.municipioId,
          localidadId: geo.localidadId,
        };
      } else {
        delete updateData.location;
        updateOps.$unset = { location: "" };
      }

      const filter = { 
        name: data.name, 
        city: mappedCity,
        dutyFrom: updateData.dutyFrom,
        dutyUntil: updateData.dutyUntil 
      };

      await this.pharmacyModel.findOneAndUpdate(
        filter,
        updateOps,
        { upsert: true, new: true }
      );

      if (pharmacies.indexOf(data) < pharmacies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    this.logger.log(`Saved/Updated ${pharmacies.length} pharmacies from Colfarjuy.`);
  }

  private mapCityName(city?: string): string {
    if (!city) return 'Desconocido';
    const mapping: Record<string, string> = {
      'Perico': 'Ciudad de Perico',
      'San Salvador': 'San Salvador de Jujuy',
      'S.S. de Jujuy': 'San Salvador de Jujuy',
      'SSJ': 'San Salvador de Jujuy',
      'Palpalá': 'Palpalá',
      'El Carmen': 'El Carmen',
    };
    return mapping[city] || city;
  }
}
