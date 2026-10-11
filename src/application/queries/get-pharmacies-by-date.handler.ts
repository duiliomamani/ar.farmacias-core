import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPharmaciesByDateQuery } from './get-pharmacies-by-date.query';
import { Inject, Optional } from '@nestjs/common';
import { IPharmacyRepository } from '../../domain/interfaces/pharmacy-system.interface';
import { Pharmacy } from '../../domain/entities/pharmacy.entity';
import { ScrapingRefreshService } from '../services/scraping-refresh.service';

@QueryHandler(GetPharmaciesByDateQuery)
export class GetPharmaciesByDateHandler implements IQueryHandler<GetPharmaciesByDateQuery> {
  constructor(
    @Inject('IPharmacyRepository')
    private readonly pharmacyRepository: IPharmacyRepository,
    @Optional() private readonly scrapingRefreshService?: ScrapingRefreshService,
  ) {}

  async execute(query: GetPharmaciesByDateQuery): Promise<Pharmacy[]> {
    const { date, city } = query;
    await this.scrapingRefreshService?.refreshIfStale(date);
    return this.pharmacyRepository.findByDate(date, city);
  }
}
