import { Test, TestingModule } from '@nestjs/testing';
import { GeoValidationService } from './geo-validation.service';
import { BadRequestException } from '@nestjs/common';

describe('GeoValidationService', () => {
  let service: GeoValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GeoValidationService],
    }).compile();

    service = module.get<GeoValidationService>(GeoValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDistance', () => {
    it('should calculate distance correctly between two points', () => {
      // Obelisk in BA to Plaza de Mayo (approx 1km)
      const lat1 = -34.6037;
      const lon1 = -58.3816;
      const lat2 = -34.6083;
      const lon2 = -58.3712;

      const distance = service.getDistance(lat1, lon1, lat2, lon2);
      expect(distance).toBeGreaterThan(900);
      expect(distance).toBeLessThan(1200);
    });
  });

  describe('validateGeofence', () => {
    it('should return true if within max distance', () => {
      const result = service.validateGeofence(0, 0, 0, 0.0001, 100);
      expect(result).toBe(true);
    });

    it('should throw BadRequestException if outside max distance', () => {
      expect(() =>
        service.validateGeofence(0, 0, 1, 1, 100),
      ).toThrow(BadRequestException);
    });

    it('should use default distance of 100m if not provided', () => {
      // 101m distance approx
      expect(() =>
        service.validateGeofence(0, 0, 0, 0.001),
      ).toThrow(BadRequestException);
    });
  });
});
