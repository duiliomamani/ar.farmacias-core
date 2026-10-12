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
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org/search';
  private readonly georefUrl = 'https://apis.datos.gob.ar/georef';
  private readonly googleMapsUrl = 'https://maps.googleapis.com/maps';

  constructor(private configService: ConfigService) { }

  cleanAddress(address: string): string {
    if (!address) return '';
    return address
      // Remove phone numbers e.g. 3885-123456, +54 388 ..., 0388-4221122
      .replace(/(?:\+?54\s?)?\b\d{3,5}[-\s]?\d{5,8}\b/g, '')
      // Remove "Farmacia" prefix or variations
      .replace(/\b(farmacia|fcia\.?|farm\.?)\b/gi, '')
      // Remove notes in parentheses e.g. (frente a la plaza), (local 2)
      .replace(/\([^)]*\)/g, '')
      // Normalize N°, Nº, #, No., N. to space
      .replace(/(?:n[°º#.]+|numero)\s*(\d+)/gi, ' $1 ')
      .replace(/[#№º°]/g, ' ')
      // Normalize ESQ. or ESQ to "y"
      .replace(/\besq(\.|\b)/gi, ' y ')
      // Clean isolated punctuation
      .replace(/\s+[.,;:-]+\s+/g, ' ')
      // Clean multiple spaces and trim
      .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  getCityCoordinates(city?: string): GeoRefResponse | null {
    if (!city) return null;
    const normalized = city
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

    for (const [name, coords] of Object.entries(JUJUY_CITY_COORDINATES)) {
      const normName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      if (normName === normalized || normalized.includes(normName) || normName.includes(normalized)) {
        return {
          lat: coords.lat,
          lng: coords.lng,
          provinciaId: '38',
          municipioId: coords.departamentoId || '',
          localidadId: '',
        };
      }
    }
    return null;
  }

  async reverseGeocode(lat: number, lng: number): Promise<GeoRefResponse | null> {
    this.logger.log(`[GeoRef API] Reverse Geocoding coordinates: [${lat}, ${lng}]`);
    try {
      this.logger.debug(`[GeoRef API] Requesting ${this.georefUrl}/api/ubicacion...`);
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

  async geocodeAddress(
    address: string,
    city: string = 'San Salvador de Jujuy',
    name?: string,
    allowCentroidFallback = false,
  ): Promise<GeoRefResponse | null> {
    let enhancedAddress = address;
    if (name) {
      const pharmacyPrefix = name.toLowerCase().includes('farmacia') ? '' : 'Farmacia ';
      if (!address.toLowerCase().includes(name.toLowerCase())) {
        enhancedAddress = `${pharmacyPrefix}${name}, ${address}`;
      }
    }

    this.logger.log(`[Geocoding Pipeline] Started for: "${enhancedAddress}", city: "${city}"`);

    // Strategy 1: Google Maps (High Precision - Needs API Key)
    const googleResult = await this.tryGoogleMaps(enhancedAddress, city);
    if (googleResult) return googleResult;

    // Strategy 2: Nominatim (OpenStreetMap) Fallback
    const nominatimResult = await this.tryNominatim(address, city);
    if (nominatimResult) return nominatimResult;

    // Strategy 3: GeoRef Nacional Direcciones API
    const georefResult = await this.tryGeorefDirecciones(address, city);
    if (georefResult) return georefResult;

    // Strategy 4: Fallback to city centroid if allowed
    if (allowCentroidFallback) {
      const cityCentroid = this.getCityCoordinates(city) || this.getCityCoordinates('San Salvador de Jujuy');
      if (cityCentroid) {
        this.logger.warn(`[Geocoding Pipeline] ⚠️ Using city centroid fallback for: "${address}", city: "${city}" -> [${cityCentroid.lat}, ${cityCentroid.lng}]`);
        return cityCentroid;
      }
    }

    this.logger.warn(`[Geocoding Pipeline] ❌ ALL strategies failed for: "${enhancedAddress}", city: "${city}"`);
    return null;
  }

  private async tryGoogleMaps(address: string, city: string): Promise<GeoRefResponse | null> {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) return null;

    try {
      const fullQuery = `${address}, ${city}, Jujuy, Argentina`;
      this.logger.debug(`[Google Maps API] Requesting geocoding for: ${fullQuery}...`);
      const response = await axios.get(`${this.googleMapsUrl}/api/geocode/json`, {
        params: {
          address: fullQuery,
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
    const cleanStreet = this.cleanAddress(address) || address;
    const cleanCity = city.replace(/^(Ciudad de|Municipio de)\s+/i, '').trim();

    try {
      this.logger.debug(`[Nominatim API] Requesting geocoding for street: "${cleanStreet}", city: "${cleanCity}"...`);
      // Attempt 1: Structured search
      let response = await axios.get(this.nominatimUrl, {
        params: {
          street: cleanStreet,
          city: cleanCity,
          state: 'Jujuy',
          country: 'Argentina',
          format: 'json',
          limit: 1,
        },
        headers: {
          'User-Agent': 'CondorJuyApp/1.0 (info@farmaya.ar; duiliomamani@gmail.com)',
        },
        timeout: 5000,
      }).catch(() => null);

      // Attempt 2: Free text search if structured search returned nothing
      if (!response?.data || (Array.isArray(response.data) && response.data.length === 0)) {
        const fullQuery = `${cleanStreet}, ${cleanCity}, Jujuy, Argentina`;
        response = await axios.get(this.nominatimUrl, {
          params: {
            q: fullQuery,
            format: 'json',
            limit: 1,
          },
          headers: {
            'User-Agent': 'CondorJuyApp/1.0 (info@farmaya.ar; duiliomamani@gmail.com)',
          },
          timeout: 5000,
        }).catch(() => null);
      }

      if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
        const result = response.data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);

        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          this.logger.debug(`Nominatim success for ${address} -> [${lat}, ${lng}]`);
          const reverseData = await this.reverseGeocode(lat, lng);

          return {
            lat,
            lng,
            provinciaId: reverseData?.provinciaId || '38',
            municipioId: reverseData?.municipioId || '',
            localidadId: reverseData?.localidadId || '',
          };
        }
      }
    } catch (error: any) {
      this.logger.error(`Nominatim API error: ${error.message}`);
    }
    return null;
  }

  private async tryGeorefDirecciones(address: string, city: string): Promise<GeoRefResponse | null> {
    const cleanStreet = this.cleanAddress(address);
    if (!cleanStreet) return null;
    const cleanCity = city.replace(/^(Ciudad de|Municipio de)\s+/i, '').trim();

    try {
      this.logger.debug(`[GeoRef Direcciones] Requesting for "${cleanStreet}", city: "${cleanCity}"...`);
      // Try with localidad parameter first
      let response = await axios.get(`${this.georefUrl}/api/direcciones`, {
        params: {
          direccion: cleanStreet,
          localidad: cleanCity,
          provincia: 'Jujuy',
          aplanar: true,
          max: 3,
        },
        timeout: 5000,
      }).catch(() => null);

      let direcciones = response?.data?.direcciones;

      // If no result with localidad, try without localidad (provincia only)
      if (!direcciones || (Array.isArray(direcciones) && direcciones.length === 0)) {
        response = await axios.get(`${this.georefUrl}/api/direcciones`, {
          params: {
            direccion: cleanStreet,
            provincia: 'Jujuy',
            aplanar: true,
            max: 5,
          },
          timeout: 5000,
        }).catch(() => null);
        direcciones = response?.data?.direcciones;
      }

      if (direcciones && Array.isArray(direcciones) && direcciones.length > 0) {
        const normalizedCity = cleanCity.toLowerCase();
        const best = direcciones.find((d: any) =>
          d.localidad_censal_nombre?.toLowerCase().includes(normalizedCity) ||
          d.departamento_nombre?.toLowerCase().includes(normalizedCity)
        ) || direcciones[0];

        const lat = best.ubicacion_lat;
        const lng = best.ubicacion_lon;

        if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0) {
          this.logger.debug(`[GeoRef Direcciones] Success for ${cleanStreet} (${cleanCity}) -> [${lat}, ${lng}]`);
          return {
            lat,
            lng,
            provinciaId: best.provincia_id || '38',
            municipioId: best.departamento_id || '',
            localidadId: best.localidad_censal_id || '',
          };
        }
      }
    } catch (error: any) {
      this.logger.error(`[GeoRef Direcciones] error: ${error.message}`);
    }
    return null;
  }
}

export const JUJUY_CITY_COORDINATES: Record<string, { lat: number; lng: number; departamentoId?: string }> = {
  'ABRA PAMPA': { lat: -22.7214, lng: -65.6964, departamentoId: '38007' },
  'CALILEGUA': { lat: -23.7744, lng: -64.7709, departamentoId: '38049' },
  'EL CARMEN': { lat: -24.3875, lng: -65.2594, departamentoId: '38014' },
  'FRAILE PINTADO': { lat: -23.9408, lng: -64.7992, departamentoId: '38049' },
  'HUMAHUACA': { lat: -23.2054, lng: -65.3503, departamentoId: '38035' },
  'LA ESPERANZA': { lat: -24.2258, lng: -64.8383, departamentoId: '38091' },
  'LA MENDIETA': { lat: -24.3183, lng: -64.9658, departamentoId: '38091' },
  'LA QUIACA': { lat: -22.1025, lng: -65.5975, departamentoId: '38112' },
  'LIBERTADOR GRAL. SAN MARTÍN': { lat: -23.8064, lng: -64.7876, departamentoId: '38049' },
  'LIBERTADOR GRAL SAN MARTIN': { lat: -23.8064, lng: -64.7876, departamentoId: '38049' },
  'LDOR. GRAL SAN MARTIN': { lat: -23.8064, lng: -64.7876, departamentoId: '38049' },
  'LEDESMA': { lat: -23.8064, lng: -64.7876, departamentoId: '38049' },
  'MONTERRICO': { lat: -24.4382, lng: -65.1622, departamentoId: '38014' },
  'PALPALA': { lat: -24.2564, lng: -65.2117, departamentoId: '38063' },
  'PALPALÁ': { lat: -24.2564, lng: -65.2117, departamentoId: '38063' },
  'PERICO': { lat: -24.3826, lng: -65.1171, departamentoId: '38014' },
  'CIUDAD DE PERICO': { lat: -24.3826, lng: -65.1171, departamentoId: '38014' },
  'SAN PEDRO DE JUJUY': { lat: -24.2333, lng: -64.8667, departamentoId: '38091' },
  'SAN PEDRO': { lat: -24.2333, lng: -64.8667, departamentoId: '38091' },
  'SAN SALVADOR DE JUJUY': { lat: -24.1856, lng: -65.2995, departamentoId: '38021' },
  'S.S. DE JUJUY': { lat: -24.1856, lng: -65.2995, departamentoId: '38021' },
  'SSJ': { lat: -24.1856, lng: -65.2995, departamentoId: '38021' },
  'TILCARA': { lat: -23.5775, lng: -65.3925, departamentoId: '38105' },
  'YUTO': { lat: -23.6394, lng: -64.4727, departamentoId: '38049' },
  'PURMAMARCA': { lat: -23.7475, lng: -65.4988, departamentoId: '38119' },
  'MAIMARÁ': { lat: -23.6231, lng: -65.4092, departamentoId: '38105' },
  'CAIMANCITO': { lat: -23.7431, lng: -64.5956, departamentoId: '38049' },
  'PALMA SOLA': { lat: -23.9786, lng: -64.3056, departamentoId: '38077' },
  'SANTA CLARA': { lat: -24.3167, lng: -64.6667, departamentoId: '38077' },
  'SUSQUES': { lat: -23.4000, lng: -66.3667, departamentoId: '38098' },
};
