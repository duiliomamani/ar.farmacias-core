import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetNearbyPharmaciesQuery } from './get-nearby-pharmacies.query';
import { Inject, Logger } from '@nestjs/common';
import { IPharmacyRepository } from '../../domain/interfaces/pharmacy-system.interface';
import { Pharmacy } from '../../domain/entities/pharmacy.entity';

@QueryHandler(GetNearbyPharmaciesQuery)
export class GetNearbyPharmaciesHandler implements IQueryHandler<GetNearbyPharmaciesQuery> {
  private readonly logger = new Logger(GetNearbyPharmaciesHandler.name);
  constructor(
    @Inject('IPharmacyRepository')
    private readonly pharmacyRepository: IPharmacyRepository,
  ) { }

  async execute(query: GetNearbyPharmaciesQuery): Promise<Pharmacy[]> {
    const { lat, lng, radius, date } = query;
    this.logger.log(`[GetNearbyPharmaciesHandler] Buscando farmacias cerca de ${lat}, ${lng} con radio ${radius} y fecha ${date?.toISOString() || 'NOW'}`);
    return this.pharmacyRepository.findNearby(lat, lng, radius, date);
  }
}
