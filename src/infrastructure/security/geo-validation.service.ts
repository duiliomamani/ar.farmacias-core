import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class GeoValidationService {
  /**
   * Calculates the distance between two points using the Haversine formula.
   * Returns distance in meters.
   */
  getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  validateGeofence(
    userLat: number,
    userLng: number,
    pharmacyLat: number,
    pharmacyLng: number,
    maxDistanceMeters: number = 100,
  ): boolean {
    const distance = this.getDistance(userLat, userLng, pharmacyLat, pharmacyLng);
    if (distance > maxDistanceMeters) {
      throw new BadRequestException(
        `You must be physically near the pharmacy to report it (Current distance: ${Math.round(distance)}m)`,
      );
    }
    return true;
  }
}
