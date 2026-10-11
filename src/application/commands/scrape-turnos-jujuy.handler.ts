import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScrapeTurnosJujuyCommand } from './scrape-turnos-jujuy.command';
import { GeoRefService } from '../services/georef.service';
import { Pharmacy, PharmacyDocument } from '../../infrastructure/database/schemas/pharmacy.schema';
import { Logger } from '@nestjs/common';
import { TurnosJujuyScraperService } from '../services/turnos-jujuy-scraper.service';

@CommandHandler(ScrapeTurnosJujuyCommand)
export class ScrapeTurnosJujuyHandler implements ICommandHandler<ScrapeTurnosJujuyCommand> {
  private readonly logger = new Logger(ScrapeTurnosJujuyHandler.name);

  constructor(
    private readonly geoRefService: GeoRefService,
    private readonly turnosJujuyScraper: TurnosJujuyScraperService,
    @InjectModel(Pharmacy.name) private readonly pharmacyModel: Model<PharmacyDocument>,
  ) { }

  async execute(_command: ScrapeTurnosJujuyCommand): Promise<void> {
    this.logger.log('[Handler] === Executing turnosjujuy.com.ar scraping command ===');

    try {
      await this.processTurnosJujuy();
    } catch (error: any) {
      this.logger.error(`Scraping command failed: ${error.message}`);
      throw error;
    }
  }

  private async processTurnosJujuy(): Promise<void> {
    const scraped = await this.turnosJujuyScraper.scrape();
    if (!scraped.length) return;

    const normalized = scraped.map((item) => {
      // Turnos Jujuy publishes the current calendar day, but the shift runs
      // from 08:00 to 08:00. Before 08:00, the active shift started yesterday.
      const dutyStartDate = this.getDutyStartDate(item.dutyDate);
      const start = new Date(`${dutyStartDate}T08:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return {
        name: item.name,
        address: item.address,
        originalAddress: item.address,
        city: this.mapCityName(item.city),
        phone: item.phone,
        isOnDuty: item.isOnDuty,
        dutyFrom: start.toISOString(),
        dutyUntil: end.toISOString(),
        openingHours: item.openingHours,
        isPermanentlyOnDuty: item.isPermanentlyOnDuty,
        source_type: 'TURNOS_JUJUY_HTML',
        raw_data: item,
        location: item.latitude && item.longitude
          ? { type: 'Point', coordinates: [item.longitude, item.latitude] }
          : undefined,
      };
    });

    await this.saveNormalizedPharmaciesBatch(normalized);
    this.logger.log(`[Handler] Persisted ${normalized.length} HTML records from turnosjujuy.com.ar`);
  }

  private getDutyStartDate(publishedDate: string): string {
    const now = new Date();
    if (now.getHours() >= 8) return publishedDate;

    const previousDay = new Date(`${publishedDate}T12:00:00`);
    previousDay.setDate(previousDay.getDate() - 1);
    return previousDay.toISOString().slice(0, 10);
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

        const updateData: any = {
          ...data,
          city: mappedCity,
          source_type: data.source_type || 'TURNOS_JUJUY_HTML',
          isOnDuty: data.isOnDuty ?? true,
          dutyFrom: dutyFromDate,
          dutyUntil: dutyUntilDate,
          openingHours: data.openingHours,
          isPermanentlyOnDuty: data.isPermanentlyOnDuty ?? false,
          isVoluntary: data.isVoluntary ?? false,
          updatedAt: new Date(),
        };

        const hasSourceLocation =
          Number.isFinite(updateData.location?.coordinates?.[0]) &&
          Number.isFinite(updateData.location?.coordinates?.[1]);

        let geo: any = null;
        if (!hasSourceLocation) {
          this.logger.log(`Geocoding address for ${data.name} in ${mappedCity}: ${data.address}`);
          geo = await this.geoRefService.geocodeAddress(data.address, mappedCity, data.name);

          if (geo && !isNaN(geo.lat) && !isNaN(geo.lng)) {
            this.logger.log(`✅ Geocoded ${data.name} successfully at [${geo.lat}, ${geo.lng}]`);
          } else {
            this.logger.warn(`❌ Geocoding failed or returned invalid coordinates for ${data.name} (${data.address})`);
          }
        } else {
          this.logger.debug(`Using official coordinates from turnosjujuy.com.ar for ${data.name}`);
        }

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

        if (!hasSourceLocation && geo && !isNaN(geo.lat) && !isNaN(geo.lng)) {
          updateData.location = {
            type: 'Point',
            coordinates: [geo.lng, geo.lat],
          };
          updateData.georef = {
            provinciaId: geo.provinciaId,
            municipioId: geo.municipioId,
            localidadId: geo.localidadId,
          };
        } else if (!updateData.location) {
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
      'LGSM': 'Libertador Gral. San Martín',
      'Libertador': 'Libertador Gral. San Martín',
      'Ledesma': 'Libertador Gral. San Martín',
    };
    return mapping[city] || city;
  }
}
