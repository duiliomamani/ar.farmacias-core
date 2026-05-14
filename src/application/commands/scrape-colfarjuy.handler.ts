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
    this.logger.log('[Handler] === Executing Colfarjuy Scraping Command ===');

    try {
      await this.processRegion('Capital');
      await this.processRegion('Interior');
    } catch (error: any) {
      this.logger.error(`Scraping command failed: ${error.message}`);
      throw error;
    }
  }

  private async processRegion(region: 'Capital' | 'Interior'): Promise<void> {
    this.logger.log(`[Handler] >>> Starting processing for region: ${region} <<<`);
    const rawText = await this.colfarjuyScraper.scrapeRegion(region);
    if (!rawText) {
      this.logger.warn(`[Handler] No raw text returned for ${region}. Skipping.`);
      return;
    }

    const weeksToScrape = 2; // Reduced to 2 weeks for faster updates
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
      this.logger.log(`Sending ${rawText.length} characters of raw text to AI Normalizer...`);
      const structuredData = await this.aiNormalizerService.normalizeColfarjuyText(rawText, region, dateRange);
      
      if (structuredData && structuredData.length > 0) {
        this.logger.log(`AI Normalizer returned ${structuredData.length} pharmacy records for ${region}.`);
        await this.saveNormalizedPharmaciesBatch(structuredData);
      } else {
        this.logger.warn(`No data found/extracted by AI for range ${dateRange.start} - ${dateRange.end} in ${region}`);
      }
    }
  }

  private async saveNormalizedPharmaciesBatch(pharmacies: any[]): Promise<void> {
    const BATCH_SIZE = 5; // Process geocoding in small concurrent batches
    const bulkOps: any[] = [];

    this.logger.log(`Preparing batch of ${pharmacies.length} pharmacies...`);

    for (let i = 0; i < pharmacies.length; i += BATCH_SIZE) {
      const chunk = pharmacies.slice(i, i + BATCH_SIZE);
      
      const chunkPromises = chunk.map(async (data) => {
        const mappedCity = this.mapCityName(data.city);
        
        if (!data.dutyUntil || !data.dutyFrom) {
          this.logger.warn(`Skipping pharmacy ${data.name} because duty dates are missing.`);
          return null;
        }

        const dutyFromDate = new Date(data.dutyFrom);
        const dutyUntilDate = new Date(data.dutyUntil);

        if (isNaN(dutyFromDate.getTime()) || isNaN(dutyUntilDate.getTime())) {
          this.logger.error(`Invalid date received for pharmacy ${data.name}: ${data.dutyFrom} - ${data.dutyUntil}`);
          return null;
        }

        // Geocoding is the bottleneck. We parallelize it within the chunk.
        this.logger.log(`Geocoding address for ${data.name} in ${mappedCity}: ${data.address}`);
        const geo = await this.geoRefService.geocodeAddress(data.address, mappedCity);
        
        if (geo && !isNaN(geo.lat) && !isNaN(geo.lng)) {
          this.logger.log(`✅ Geocoded ${data.name} successfully at [${geo.lat}, ${geo.lng}]`);
        } else {
          this.logger.warn(`❌ Geocoding failed or returned invalid coordinates for ${data.name} (${data.address})`);
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

        const filter = { 
          name: data.name, 
          city: mappedCity,
          dutyFrom: updateData.dutyFrom,
          dutyUntil: updateData.dutyUntil 
        };

        const updateOp: any = {
          updateOne: {
            filter,
            update: { $set: updateData },
            upsert: true
          }
        };

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
          updateOp.updateOne.update.$unset = { location: "" };
        }

        return updateOp;
      });

      const results = await Promise.all(chunkPromises);
      results.forEach(op => { if (op) bulkOps.push(op); });

      // Respect rate limits of geocoding services between chunks
      if (i + BATCH_SIZE < pharmacies.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (bulkOps.length > 0) {
      this.logger.log(`[Handler] Executing MongoDB bulkWrite with ${bulkOps.length} operations...`);
      const result = await this.pharmacyModel.bulkWrite(bulkOps);
      this.logger.log(`[Handler] ✅ Successfully persisted batch. Modified/Upserted: ${result.upsertedCount + result.modifiedCount} pharmacies.`);
    } else {
      this.logger.log(`[Handler] No operations to perform in this batch.`);
    }
  }

  private async saveNormalizedPharmacies(pharmacies: any[]): Promise<void> {
    // Deprecated in favor of saveNormalizedPharmaciesBatch
    return this.saveNormalizedPharmaciesBatch(pharmacies);
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
