import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetPharmaciesByDateQuery } from './get-pharmacies-by-date.query';
import { Inject } from '@nestjs/common';
import { IPharmacyRepository } from '../../domain/interfaces/pharmacy-system.interface';
import { Pharmacy } from '../../domain/entities/pharmacy.entity';

@QueryHandler(GetPharmaciesByDateQuery)
export class GetPharmaciesByDateHandler implements IQueryHandler<GetPharmaciesByDateQuery> {
  constructor(
    @Inject('IPharmacyRepository')
    private readonly pharmacyRepository: IPharmacyRepository,
  ) {}

  async execute(query: GetPharmaciesByDateQuery): Promise<Pharmacy[]> {
    const { date, city } = query;
    return this.pharmacyRepository.findByDate(date, city);
  }
}
