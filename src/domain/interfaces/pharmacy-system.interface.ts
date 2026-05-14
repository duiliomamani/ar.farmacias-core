import { Pharmacy } from '../entities/pharmacy.entity';
import { IBaseRepository } from './repository.interface';

export interface IScraperStrategy {
  supports(source: string): boolean;
  scrape(source: string): Promise<string>; // Returns raw text extracted
}

export interface IPharmacyRepository extends IBaseRepository<Pharmacy> {
  findNearby(lat: number, lng: number, radiusInMeters: number, date?: Date): Promise<Pharmacy[]>;
  findByDate(date: Date, city?: string): Promise<Pharmacy[]>;
}
