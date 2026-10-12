import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { normalizeLocalityName } from './locality-utils';

export interface FireStation {
  id: string;
  name: string;
  type: string;
  description: string;
  authority: string;
  lat: number;
  lng: number;
  locality?: string;
  distance?: number;
}

const IDEJUY_WFS_URL = 'https://geo.idejuy.jujuy.gob.ar/geoserver/ows';

@Injectable()
export class FireStationService {
  private readonly logger = new Logger(FireStationService.name);
  private cache: FireStation[] | null = null;
  private cacheExpiry = 0;
  private readonly cacheTtlMs = 60 * 60 * 1000; // 1 hora de caché

  async getAll(): Promise<FireStation[]> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiry) {
      return this.cache;
    }

    try {
      this.logger.log('Fetching fire stations from IDEJuy dataset #151 (geonode:cuartel_de_bomberos)...');
      const response = await axios.get(IDEJUY_WFS_URL, {
        params: {
          service: 'WFS',
          version: '1.0.0',
          request: 'GetFeature',
          typename: 'geonode:cuartel_de_bomberos',
          outputFormat: 'json',
          srsName: 'EPSG:4326',
        },
        timeout: 10000,
      });

      const features = response.data?.features || [];
      const stations: FireStation[] = [];

      features.forEach((feat: any) => {
        const coords = feat.geometry?.coordinates;
        if (feat.geometry?.type !== 'Point' || !Array.isArray(coords)) return;

        const [lng, lat] = coords;
        if (typeof lat !== 'number' || typeof lng !== 'number') return;

        const p = feat.properties || {};
        stations.push({
          id: String(feat.id || `fire-station-${stations.length}`),
          name: (p.nam || 'Cuartel de bomberos').trim(),
          type: (p.gna || 'Cuartel').trim(),
          description: (p.fna || '').trim(),
          authority: (p.sag || 'Ministerio de Seguridad').trim(),
          lat,
          lng,
          locality: '',
        });
      });

      if (stations.length > 0) {
        this.cache = this.assignLocalities(stations);
        this.cacheExpiry = now + this.cacheTtlMs;
        this.logger.log(`Cached ${this.cache.length} fire stations from IDEJuy.`);
        return this.cache;
      }
    } catch (error: any) {
      this.logger.error(`Error loading fire stations: ${error.message}`);
    }

    return this.cache || [];
  }

  private assignLocalities(stations: FireStation[]): FireStation[] {
    const centroids: Array<{ name: string; lat: number; lng: number }> = [
      { name: 'San Salvador de Jujuy', lat: -24.1858, lng: -65.2995 },
      { name: 'Palpalá', lat: -24.2564, lng: -65.2125 },
      { name: 'Perico', lat: -24.3831, lng: -65.1147 },
      { name: 'Monterrico', lat: -24.4427, lng: -65.1661 },
      { name: 'El Carmen', lat: -24.3878, lng: -65.2589 },
      { name: 'San Pedro de Jujuy', lat: -24.2325, lng: -64.8656 },
      { name: 'Libertador Gral. San Martín', lat: -23.8064, lng: -64.7875 },
      { name: 'La Quiaca', lat: -22.1053, lng: -65.5975 },
      { name: 'Abra Pampa', lat: -22.7225, lng: -65.6961 },
      { name: 'Humahuaca', lat: -23.2053, lng: -65.3497 },
      { name: 'Tilcara', lat: -23.5775, lng: -65.3931 },
      { name: 'Fraile Pintado', lat: -23.9431, lng: -64.7989 },
      { name: 'Calilegua', lat: -23.7731, lng: -64.7708 },
      { name: 'Yuto', lat: -23.6397, lng: -64.4725 },
      { name: 'La Esperanza', lat: -24.2253, lng: -64.8358 },
      { name: 'La Mendieta', lat: -24.3164, lng: -64.9664 },
    ];

    return stations.map((station) => {
      let nearestName = 'San Salvador de Jujuy';
      let shortestDist = Number.POSITIVE_INFINITY;

      for (const city of centroids) {
        const d = Math.hypot(station.lat - city.lat, station.lng - city.lng);
        if (d < shortestDist) {
          shortestDist = d;
          nearestName = city.name;
        }
      }

      return {
        ...station,
        locality: normalizeLocalityName(nearestName),
      };
    });
  }
}

