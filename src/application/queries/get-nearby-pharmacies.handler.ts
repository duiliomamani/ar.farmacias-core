import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetNearbyPharmaciesQuery } from './get-nearby-pharmacies.query';
import { Inject, Logger, Optional } from '@nestjs/common';
import { IPharmacyRepository } from '../../domain/interfaces/pharmacy-system.interface';
import { Pharmacy } from '../../domain/entities/pharmacy.entity';
import { ScrapingRefreshService } from '../services/scraping-refresh.service';

@QueryHandler(GetNearbyPharmaciesQuery)
export class GetNearbyPharmaciesHandler implements IQueryHandler<GetNearbyPharmaciesQuery> {
  private readonly logger = new Logger(GetNearbyPharmaciesHandler.name);
  constructor(
    @Inject('IPharmacyRepository')
    private readonly pharmacyRepository: IPharmacyRepository,
    @Optional() private readonly scrapingRefreshService?: ScrapingRefreshService,
  ) { }

  async execute(query: GetNearbyPharmaciesQuery): Promise<Pharmacy[]> {
    const { lat, lng, radius, date } = query;
    this.logger.log(`[GetNearbyPharmaciesHandler] Buscando farmacias cerca de ${lat}, ${lng} con radio ${radius} y fecha ${date?.toISOString() || 'NOW'}`);
    const result = await this.pharmacyRepository.findNearby(lat, lng, radius, date);
    this.scrapingRefreshService?.refreshIfStale(date);
    return result;
  }
}
