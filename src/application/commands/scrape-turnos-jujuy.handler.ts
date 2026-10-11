import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ScrapeTurnosJujuyCommand } from './scrape-turnos-jujuy.command';
import { GeoRefService } from '../services/georef.service';
import { Pharmacy, PharmacyDocument } from '../../infrastructure/database/schemas/pharmacy.schema';
import { ScrapingRun, ScrapingRunDocument } from '../../infrastructure/database/schemas/scraping-run.schema';
import { Logger } from '@nestjs/common';
import { TurnosJujuyPharmacy, TurnosJujuyScraperService } from '../services/turnos-jujuy-scraper.service';

@CommandHandler(ScrapeTurnosJujuyCommand)
export class ScrapeTurnosJujuyHandler implements ICommandHandler<ScrapeTurnosJujuyCommand> {
  private readonly logger = new Logger(ScrapeTurnosJujuyHandler.name);

  constructor(
    private readonly geoRefService: GeoRefService,
    private readonly turnosJujuyScraper: TurnosJujuyScraperService,
    @InjectModel(Pharmacy.name) private readonly pharmacyModel: Model<PharmacyDocument>,
    @InjectModel(ScrapingRun.name) private readonly scrapingRunModel: Model<ScrapingRunDocument>,
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
    const startedAt = new Date();
    const run = await this.scrapingRunModel.create({ source: 'turnosjujuy.com.ar', status: 'running', startedAt });
    try {
      const scraped = await this.turnosJujuyScraper.scrape();
      await this.scrapingRunModel.updateOne({ _id: run._id }, { $set: { recordsFound: scraped.length } });
      if (!scraped.length) {
        await this.finishRun(run._id, 'success', { structureChanges: ['No se encontraron filas de farmacias; revisar la estructura HTML.'] });
        return;
      }

      const sourceIds = scraped.map((item) => item.sourceId).filter(Boolean);
      const validated = await this.validateScrapedPharmacies(scraped);
      await this.scrapingRunModel.updateOne({ _id: run._id }, { $set: { recordsValidated: validated.length } });
      if (!validated.length) {
        this.logger.warn('[Handler] No valid pharmacy records remained after validation. Existing data was preserved.');
        await this.finishRun(run._id, 'success', { structureChanges: ['Los registros encontrados no pasaron la validación.'] });
        return;
      }

    const normalized = validated.map((item) => {
      // Turnos Jujuy publishes the current calendar day, but the shift runs
      // from 08:00 to 08:00. Before 08:00, the active shift started yesterday.
      const dutyStartDate = this.getDutyStartDate(item.dutyDate);
      const start = new Date(`${dutyStartDate}T08:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return {
        name: item.name,
        sourceId: item.sourceId,
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

      const saved = await this.saveNormalizedPharmaciesBatch(normalized);
      const staleRemoved = await this.cleanupTurnosJujuyRecords(normalized, sourceIds);
      await this.finishRun(run._id, 'success', { recordsSaved: saved, staleRemoved });
      this.logger.log(`[Handler] Persisted ${saved} HTML records from turnosjujuy.com.ar`);
    } catch (error: any) {
      await this.finishRun(run._id, 'failed', { errorMessages: [error?.message || 'Error desconocido durante el scraping'] });
      throw error;
    }
  }

  private async finishRun(id: any, status: 'success' | 'failed', data: Partial<ScrapingRun>): Promise<void> {
    await this.scrapingRunModel.updateOne({ _id: id }, { $set: { ...data, status, finishedAt: new Date() } });
  }

  private async validateScrapedPharmacies(items: TurnosJujuyPharmacy[]): Promise<TurnosJujuyPharmacy[]> {
    const valid: TurnosJujuyPharmacy[] = [];
    const identities = new Map<string, { name: string; address: string }>();
    const coordinates = new Map<string, string[]>();

    for (const item of items) {
      const sourceId = String(item.sourceId || '').trim();
      const name = item.name?.trim();
      const address = item.address?.trim();

      if (!sourceId || !name || !address) {
        this.logger.warn(`[Validation] Skipping incomplete record: sourceId=${sourceId || 'missing'}, name=${name || 'missing'}`);
        continue;
      }

      const identity = {
        name: this.normalizeIdentity(name),
        address: this.normalizeIdentity(address),
      };
      const previous = identities.get(sourceId);
      if (previous && (previous.name !== identity.name || previous.address !== identity.address)) {
        this.logger.error(`[Validation] Conflicting name/address for sourceId=${sourceId}. Record skipped.`);
        continue;
      }
      identities.set(sourceId, identity);

      const hasLatitude = Number.isFinite(item.latitude);
      const hasLongitude = Number.isFinite(item.longitude);
      if (hasLatitude !== hasLongitude) {
        this.logger.warn(`[Validation] Incomplete coordinates for ${name} (${sourceId}); geocoding fallback will be used.`);
      }
      if (hasLatitude && hasLongitude) {
        if (item.latitude! < -90 || item.latitude! > 90 || item.longitude! < -180 || item.longitude! > 180) {
          this.logger.error(`[Validation] Invalid coordinates for ${name} (${sourceId}). Record skipped.`);
          continue;
        }
        const coordinateKey = `${item.latitude!.toFixed(6)},${item.longitude!.toFixed(6)}`;
        const owners = coordinates.get(coordinateKey) || [];
        owners.push(`${name} (${sourceId})`);
        coordinates.set(coordinateKey, owners);
      }

      valid.push({ ...item, sourceId, name, address });
    }

    for (const [coordinateKey, owners] of coordinates) {
      if (owners.length > 1) {
        this.logger.warn(`[Validation] Shared coordinates ${coordinateKey}: ${owners.join(', ')}`);
      }
    }

    // Protect against a source ID being accidentally assigned to another
    // pharmacy between scraper runs. We preserve the previous record instead
    // of overwriting it with a crossed name or address.
    const sourceIds = valid.map((item) => item.sourceId);
    if (sourceIds.length > 0) {
      const existing = await this.pharmacyModel.find({
        source_type: 'TURNOS_JUJUY_HTML',
        $or: [
          { sourceId: { $in: sourceIds } },
          { 'raw_data.sourceId': { $in: sourceIds } },
        ],
      }).select({ sourceId: 1, name: 1, originalAddress: 1, address: 1, raw_data: 1 }).lean();

      const storedBySourceId = new Map<string, any>();
      for (const record of existing as any[]) {
        const id = String(record.sourceId || record.raw_data?.sourceId || '');
        if (id && !storedBySourceId.has(id)) storedBySourceId.set(id, record);
      }

      return valid.filter((item) => {
        const stored = storedBySourceId.get(item.sourceId);
        if (!stored) return true;
        const storedName = this.normalizeIdentity(stored.name || '');
        const storedAddress = this.normalizeIdentity(stored.originalAddress || stored.address || stored.raw_data?.address || '');
        const matches = storedName === this.normalizeIdentity(item.name)
          && (!storedAddress || storedAddress === this.normalizeIdentity(item.address));
        if (!matches) {
          this.logger.error(`[Validation] Identity mismatch for sourceId=${item.sourceId}. Existing record preserved.`);
        }
        return matches;
      });
    }

    return valid;
  }

  private normalizeIdentity(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private async cleanupTurnosJujuyRecords(pharmacies: any[], scrapedSourceIds: string[]): Promise<number> {
    if (!pharmacies.length) return 0;

    const currentFrom = new Date(pharmacies[0].dutyFrom).getTime();
    const currentUntil = new Date(pharmacies[0].dutyUntil).getTime();
    const activeSourceIds = new Set(scrapedSourceIds);
    const records = await this.pharmacyModel.find({ source_type: 'TURNOS_JUJUY_HTML' })
      .select({ sourceId: 1, raw_data: 1, dutyFrom: 1, dutyUntil: 1, updatedAt: 1, createdAt: 1 })
      .lean();

    const seen = new Set<string>();
    const idsToDelete: any[] = [];
    for (const record of records as any[]) {
      const sourceId = String(record.sourceId || record.raw_data?.sourceId || '');
      const from = new Date(record.dutyFrom).getTime();
      const until = new Date(record.dutyUntil).getTime();
      const sameWindow = from === currentFrom && until === currentUntil;

      if (!sameWindow || !activeSourceIds.has(sourceId)) {
        idsToDelete.push(record._id);
        continue;
      }

      if (seen.has(sourceId)) {
        idsToDelete.push(record._id);
      } else {
        seen.add(sourceId);
      }
    }

    if (idsToDelete.length > 0) {
      await this.pharmacyModel.deleteMany({ _id: { $in: idsToDelete } });
      this.logger.log(`[Cleanup] Removed ${idsToDelete.length} stale or duplicate HTML records.`);
    }
    return idsToDelete.length;
  }

  private getDutyStartDate(publishedDate: string): string {
    const now = new Date();
    if (now.getHours() >= 8) return publishedDate;

    const previousDay = new Date(`${publishedDate}T12:00:00`);
    previousDay.setDate(previousDay.getDate() - 1);
    return previousDay.toISOString().slice(0, 10);
  }

  private async saveNormalizedPharmaciesBatch(pharmacies: any[]): Promise<number> {
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
          source_type: updateData.source_type,
          dutyFrom: updateData.dutyFrom,
          dutyUntil: updateData.dutyUntil,
          $or: [
            { sourceId: data.sourceId },
            { 'raw_data.sourceId': data.sourceId },
            { name: data.name, city: mappedCity },
          ],
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
    return bulkOps.length;
  }

  private async saveNormalizedPharmacies(pharmacies: any[]): Promise<number> {
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
