import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface GeoRefResponse {
  lat: number;
  lng: number;
  provinciaId: string;
  municipioId: string;
  localidadId: string;
}

@Injectable()
export class GeoRefService {
  private readonly logger = new Logger(GeoRefService.name);
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org/';
  private readonly georefUrl = 'https://apis.datos.gob.ar/georef';
  private readonly googleMapsUrl = 'https://maps.googleapis.com/maps';

  constructor(private configService: ConfigService) { }

  async reverseGeocode(lat: number, lng: number): Promise<GeoRefResponse | null> {
    this.logger.log(`Reverse Geocoding: ${lat}, ${lng}`);
    try {
      const response = await axios.get(`${this.georefUrl}/api/ubicacion`, {
        params: {
          lat,
          lon: lng,
          aplanar: true,
          campos: 'estandar',
        },
        timeout: 5000,
      });

      if (response.data?.ubicacion) {
        const u = response.data.ubicacion;
        return {
          lat: u.lat,
          lng: u.lon,
          provinciaId: u.provincia_id,
          municipioId: u.municipio_id,
          localidadId: u.departamento_id, // Georef returns departamento_id in 'estandar' fields, sometimes localidad is not there
        };
      }
    } catch (error: any) {
      this.logger.error(`Reverse Geocoding error: ${error.message}`);
    }
    return null;
  }

  async geocodeAddress(address: string, city: string = 'San Salvador de Jujuy'): Promise<GeoRefResponse | null> {
    this.logger.log(`Geocoding: ${address}, ${city}`);

    // Strategy 1: Google Maps (High Precision - Needs API Key)
    const googleResult = await this.tryGoogleMaps(address, city);
    if (googleResult) return googleResult;

    // Strategy 2: Nominatim (OpenStreetMap) Fallback
    const nominatimResult = await this.tryNominatim(address, city);
    if (nominatimResult) return nominatimResult;

    this.logger.warn(`Failed to geocode: ${address}, ${city}`);
    return null;
  }

  private async tryGoogleMaps(address: string, city: string): Promise<GeoRefResponse | null> {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) return null;

    try {
      const response = await axios.get(`${this.googleMapsUrl}/api/geocode/json`, {
        params: {
          address: `${address}, ${city}, Jujuy, Argentina`,
          key: apiKey,
        },
      });

      if (response.data.status === 'OK') {
        const result = response.data.results[0];
        this.logger.debug(`Google Maps success for ${address}`);
        const lat = result.geometry.location.lat;
        const lng = result.geometry.location.lng;

        // Reverse geocode to standardize IDs
        const reverseData = await this.reverseGeocode(lat, lng);

        return {
          lat,
          lng,
          provinciaId: reverseData?.provinciaId || '38',
          municipioId: reverseData?.municipioId || '',
          localidadId: reverseData?.localidadId || '',
        };
      }
    } catch (error: any) {
      this.logger.error(`Google Maps API error: ${error.message}`);
    }
    return null;
  }


  private async tryNominatim(address: string, city: string): Promise<GeoRefResponse | null> {
    try {
      // Nominatim requires a User-Agent and recommends a delay between requests
      const response = await axios.get(this.nominatimUrl, {
        params: {
          q: `${address}, ${city}, Jujuy, Argentina`,
          format: 'json',
          limit: 1,
        },
        headers: {
          'User-Agent': 'FarmaYa-AR-Backend/1.0',
        },
        timeout: 5000,
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        this.logger.debug(`Nominatim success for ${address}`);
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        // Reverse geocode to standardize IDs
        const reverseData = await this.reverseGeocode(lat, lng);

        return {
          lat,
          lng,
          provinciaId: reverseData?.provinciaId || '38', // Jujuy ID
          municipioId: reverseData?.municipioId || '',
          localidadId: reverseData?.localidadId || '',
        };
      }
    } catch (error: any) {
      this.logger.error(`Nominatim API error: ${error.message}`);
    }
    return null;
  }
}