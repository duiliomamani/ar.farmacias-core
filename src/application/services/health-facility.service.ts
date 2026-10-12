import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { normalizeLocalityName, toTitleCase } from './locality-utils';

export type HealthFacilityType = 'NODO SANITARIO' | 'CAPS' | 'CIC' | 'PUESTO DE SALUD';

export interface HealthFacility {
  id: string;
  name: string;
  type: HealthFacilityType;
  lat: number;
  lng: number;
  authority: string;
  jurisdiction: string;
  establishmentCode: string;
  locality: string;
  datasetId?: number;
  datasetUrl?: string;
}

const IDEJUY_WFS_URL = 'https://geo.idejuy.jujuy.gob.ar/geoserver/ows';

const DATASETS: Array<{ id: number; layer: string; type: HealthFacilityType; url: string }> = [
  { id: 47, layer: 'geonode:efectores_de_salud_nodos', type: 'NODO SANITARIO', url: 'https://geo.idejuy.jujuy.gob.ar/catalogue/#/dataset/47' },
  { id: 45, layer: 'geonode:efectores_de_salud_caps', type: 'CAPS', url: 'https://geo.idejuy.jujuy.gob.ar/catalogue/#/dataset/45' },
  { id: 46, layer: 'geonode:efectores_de_salud_cic', type: 'CIC', url: 'https://geo.idejuy.jujuy.gob.ar/catalogue/#/dataset/46' },
  { id: 48, layer: 'geonode:efectores_de_salud_puestos_de_salud', type: 'PUESTO DE SALUD', url: 'https://geo.idejuy.jujuy.gob.ar/catalogue/#/dataset/48' },
];

@Injectable()
export class HealthFacilityService {
  private readonly logger = new Logger(HealthFacilityService.name);
  private cache: HealthFacility[] | null = null;
  private cacheExpiry = 0;
  private readonly cacheTtlMs = 60 * 60 * 1000; // 1 hora de caché

  async getAll(): Promise<HealthFacility[]> {
    const now = Date.now();
    if (this.cache && now < this.cacheExpiry) {
      return this.cache;
    }

    try {
      this.logger.log('Fetching unified health facilities from IDEJuy datasets 45, 46, 47, 48...');
      const results = await Promise.allSettled(
        DATASETS.map((ds) => this.fetchDataset(ds.layer, ds.type, ds.id, ds.url))
      );

      const combined: HealthFacility[] = [];
      results.forEach((res, index) => {
        if (res.status === 'fulfilled') {
          combined.push(...res.value);
        } else {
          this.logger.warn(`Failed to fetch dataset #${DATASETS[index].id}: ${res.reason}`);
        }
      });

      if (combined.length > 0) {
        // Asignar localidades
        this.cache = this.assignLocalities(combined);
        this.cacheExpiry = now + this.cacheTtlMs;
        this.logger.log(`Cached ${this.cache.length} unified health facilities.`);
        return this.cache;
      }
    } catch (error: any) {
      this.logger.error(`Error loading health facilities: ${error.message}`);
    }

    return this.cache || [];
  }

  private async fetchDataset(
    layer: string,
    defaultType: HealthFacilityType,
    datasetId: number,
    datasetUrl: string
  ): Promise<HealthFacility[]> {
    const response = await axios.get(IDEJUY_WFS_URL, {
      params: {
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typename: layer,
        outputFormat: 'json',
        srsName: 'EPSG:4326',
      },
      timeout: 10000,
    });

    const features = response.data?.features || [];
    const items: HealthFacility[] = [];

    features.forEach((feat: any) => {
      const coords = feat.geometry?.coordinates;
      if (feat.geometry?.type !== 'Point' || !Array.isArray(coords)) return;

      const [lng, lat] = coords;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const p = feat.properties || {};
      const rawName = (p.nam || 'Centro de salud').replace(/\s+\(\d+\)$/, '');
      const rawType = (p.ces || defaultType) as HealthFacilityType;

      items.push({
        id: String(feat.id || `${datasetId}-${items.length}`),
        name: toTitleCase(rawName),
        type: rawType,
        lat,
        lng,
        authority: p.sag || 'Ministerio de Salud de Jujuy',
        jurisdiction: p.caa || 'Provincial',
        establishmentCode: p.ies || '',
        locality: '', // se resuelve posteriormente
        datasetId,
        datasetUrl,
      });
    });

    return items;
  }

  private assignLocalities(facilities: HealthFacility[]): HealthFacility[] {
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

    return facilities.map((facility) => {
      let nearestName = 'San Salvador de Jujuy';
      let shortestDist = Number.POSITIVE_INFINITY;

      for (const city of centroids) {
        const d = Math.hypot(facility.lat - city.lat, facility.lng - city.lng);
        if (d < shortestDist) {
          shortestDist = d;
          nearestName = city.name;
        }
      }

      return {
        ...facility,
        locality: normalizeLocalityName(nearestName),
      };
    });
  }
}
