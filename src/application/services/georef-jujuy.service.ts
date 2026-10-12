import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { LOCALITY_CANONICAL_MAP, normalizeLocalityName, toTitleCase, cleanText } from './locality-utils';

export interface GeorefJujuyItem {
  id: string;
  nombre: string;
  tipo: 'departamento' | 'municipio' | 'localidad' | 'paraje';
  municipioCanonico?: string;
  departamento?: string;
  lat?: number;
  lng?: number;
  fuente?: string;
}

export const JUJUY_DEPARTAMENTOS = [
  { id: '38007', nombre: 'Cochinoca', cabecera: 'Abra Pampa', lat: -22.84, lng: -65.79 },
  { id: '38014', nombre: 'El Carmen', cabecera: 'El Carmen', lat: -24.38, lng: -65.17 },
  { id: '38021', nombre: 'Doctor Manuel Belgrano', cabecera: 'San Salvador de Jujuy', lat: -24.18, lng: -65.30 },
  { id: '38028', nombre: 'Humahuaca', cabecera: 'Humahuaca', lat: -23.20, lng: -65.35 },
  { id: '38035', nombre: 'Ledesma', cabecera: 'Libertador Gral. San Martín', lat: -23.81, lng: -64.79 },
  { id: '38042', nombre: 'Palpalá', cabecera: 'Palpalá', lat: -24.25, lng: -65.21 },
  { id: '38049', nombre: 'Rinconada', cabecera: 'Rinconada', lat: -22.56, lng: -66.16 },
  { id: '38056', nombre: 'San Antonio', cabecera: 'San Antonio', lat: -24.36, lng: -65.43 },
  { id: '38063', nombre: 'San Pedro', cabecera: 'San Pedro de Jujuy', lat: -24.23, lng: -64.86 },
  { id: '38070', nombre: 'Santa Bárbara', cabecera: 'Santa Clara', lat: -24.30, lng: -64.67 },
  { id: '38077', nombre: 'Santa Catalina', cabecera: 'Santa Catalina', lat: -21.95, lng: -66.05 },
  { id: '38084', nombre: 'Susques', cabecera: 'Susques', lat: -23.51, lng: -66.36 },
  { id: '38091', nombre: 'Tilcara', cabecera: 'Tilcara', lat: -23.58, lng: -65.39 },
  { id: '38098', nombre: 'Tumbaya', cabecera: 'Tumbaya', lat: -23.85, lng: -65.46 },
  { id: '38105', nombre: 'Valle Grande', cabecera: 'Valle Grande', lat: -23.47, lng: -64.95 },
  { id: '38112', nombre: 'Yavi', cabecera: 'La Quiaca', lat: -22.10, lng: -65.59 },
];

export const JUJUY_MUNICIPIOS = [
  { id: '380028', nombre: 'San Salvador de Jujuy', departamento: 'Doctor Manuel Belgrano', lat: -24.1858, lng: -65.2995 },
  { id: '380042', nombre: 'Palpalá', departamento: 'Palpalá', lat: -24.2564, lng: -65.2125 },
  { id: '380014', nombre: 'Perico', departamento: 'El Carmen', lat: -24.3831, lng: -65.1147 },
  { id: '380077', nombre: 'Monterrico', departamento: 'El Carmen', lat: -24.4427, lng: -65.1661 },
  { id: '380015', nombre: 'El Carmen', departamento: 'El Carmen', lat: -24.3878, lng: -65.2589 },
  { id: '380224', nombre: 'San Pedro de Jujuy', departamento: 'San Pedro', lat: -24.2325, lng: -64.8656 },
  { id: '380035', nombre: 'Libertador Gral. San Martín', departamento: 'Ledesma', lat: -23.8064, lng: -64.7875 },
  { id: '380112', nombre: 'La Quiaca', departamento: 'Yavi', lat: -22.1053, lng: -65.5975 },
  { id: '380007', nombre: 'Abra Pampa', departamento: 'Cochinoca', lat: -22.7225, lng: -65.6961 },
  { id: '380029', nombre: 'Humahuaca', departamento: 'Humahuaca', lat: -23.2053, lng: -65.3497 },
  { id: '380091', nombre: 'Tilcara', departamento: 'Tilcara', lat: -23.5775, lng: -65.3931 },
  { id: '380036', nombre: 'Fraile Pintado', departamento: 'Ledesma', lat: -23.9431, lng: -64.7989 },
  { id: '380037', nombre: 'Calilegua', departamento: 'Ledesma', lat: -23.7731, lng: -64.7708 },
  { id: '380038', nombre: 'Yuto', departamento: 'Ledesma', lat: -23.6397, lng: -64.4725 },
  { id: '380225', nombre: 'La Esperanza', departamento: 'San Pedro', lat: -24.2253, lng: -64.8358 },
  { id: '380226', nombre: 'La Mendieta', departamento: 'San Pedro', lat: -24.3164, lng: -64.9664 },
  { id: '380056', nombre: 'San Antonio', departamento: 'San Antonio', lat: -24.3644, lng: -65.4386 },
  { id: '380098', nombre: 'Volcán', departamento: 'Tumbaya', lat: -23.9167, lng: -65.4667 },
  { id: '380099', nombre: 'Purmamarca', departamento: 'Tumbaya', lat: -23.7475, lng: -65.4989 },
  { id: '380100', nombre: 'Maimará', departamento: 'Tilcara', lat: -23.6264, lng: -65.3944 },
  { id: '380070', nombre: 'Santa Clara', departamento: 'Santa Bárbara', lat: -24.3094, lng: -64.6739 },
  { id: '380071', nombre: 'Palma Sola', departamento: 'Santa Bárbara', lat: -23.9833, lng: -64.3000 },
  { id: '380084', nombre: 'Susques', departamento: 'Susques', lat: -23.5167, lng: -66.3667 },
  { id: '380049', nombre: 'Rinconada', departamento: 'Rinconada', lat: -22.5667, lng: -66.1667 },
  { id: '380078', nombre: 'Santa Catalina', departamento: 'Santa Catalina', lat: -21.9500, lng: -66.0500 },
  { id: '380105', nombre: 'Valle Grande', departamento: 'Valle Grande', lat: -23.4750, lng: -64.9583 },
];

@Injectable()
export class GeorefJujuyService {
  private readonly logger = new Logger(GeorefJujuyService.name);

  async search(
    q = '',
    tipo = 'todos',
    departamentoFilter = '',
    max = 25
  ): Promise<{ fuente: string; total: number; resultados: GeorefJujuyItem[] }> {
    const cleanQuery = cleanText(q);
    const limit = Math.min(max || 25, 100);
    const resultados: GeorefJujuyItem[] = [];
    let fuenteUtilizada = 'cache-local';

    // 1. Departamentos
    if (tipo === 'departamentos' || (tipo === 'todos' && cleanQuery && !departamentoFilter)) {
      const matchedDeps = JUJUY_DEPARTAMENTOS.filter((dep) => {
        if (!cleanQuery) return true;
        return cleanText(dep.nombre).includes(cleanQuery) || cleanText(dep.cabecera).includes(cleanQuery);
      });

      matchedDeps.forEach((dep) => {
        resultados.push({
          id: dep.id,
          nombre: dep.nombre,
          tipo: 'departamento',
          municipioCanonico: dep.cabecera,
          departamento: dep.nombre,
          lat: dep.lat,
          lng: dep.lng,
          fuente: 'INDEC/IDEJuy',
        });
      });
    }

    // 2. Municipios
    if (tipo === 'municipios' || tipo === 'todos') {
      const matchedMunis = JUJUY_MUNICIPIOS.filter((muni) => {
        if (departamentoFilter && cleanText(muni.departamento) !== cleanText(departamentoFilter)) {
          return false;
        }
        if (!cleanQuery) return true;
        return cleanText(muni.nombre).includes(cleanQuery) || cleanText(muni.departamento).includes(cleanQuery);
      });

      matchedMunis.forEach((muni) => {
        resultados.push({
          id: muni.id,
          nombre: muni.nombre,
          tipo: 'municipio',
          municipioCanonico: muni.nombre,
          departamento: muni.departamento,
          lat: muni.lat,
          lng: muni.lng,
          fuente: 'IDEJuy',
        });
      });
    }

    // 3. Búsqueda Universal Predictiva de Parajes y Asentamientos
    if (cleanQuery && (tipo === 'localidades' || tipo === 'asentamientos' || tipo === 'todos')) {
      const canonicalCabecera = LOCALITY_CANONICAL_MAP[cleanQuery];
      if (canonicalCabecera) {
        const muniMatch = JUJUY_MUNICIPIOS.find((m) => cleanText(m.nombre) === cleanText(canonicalCabecera));
        resultados.unshift({
          id: `paraje-${cleanQuery}`,
          nombre: toTitleCase(q),
          tipo: 'paraje',
          municipioCanonico: canonicalCabecera,
          departamento: muniMatch?.departamento || 'Jujuy',
          lat: muniMatch?.lat,
          lng: muniMatch?.lng,
          fuente: 'Diccionario Canónico Jujuy',
        });
      }

      // Consultar Georef Nación (timeout 2000ms)
      const georefData = await this.queryGeorefNacion('localidades', {
        provincia: '38',
        nombre: q,
        max: String(limit),
      });

      if (georefData?.localidades?.length > 0) {
        fuenteUtilizada = 'georef-nacion';
        georefData.localidades.forEach((loc: any) => {
          const canonical = normalizeLocalityName(loc.nombre);
          resultados.push({
            id: String(loc.id),
            nombre: toTitleCase(loc.nombre),
            tipo: 'localidad',
            municipioCanonico: loc.municipio?.nombre ? toTitleCase(loc.municipio.nombre) : canonical,
            departamento: loc.departamento?.nombre ? toTitleCase(loc.departamento.nombre) : undefined,
            lat: loc.centroide?.lat,
            lng: loc.centroide?.lon,
            fuente: 'Georef INDEC',
          });
        });
      } else {
        // Fallback IDEJuy GeoServer
        fuenteUtilizada = 'idejuy';
        const idejuyFilter = `fna ILIKE '%${q.replace(/'/g, "''")}%'`;
        const asentamientosData = await this.queryIdejuyWFS('geonode:asentamientos_humanos_v1', idejuyFilter, limit);

        if (asentamientosData?.features?.length > 0) {
          asentamientosData.features.forEach((feat: any) => {
            const props = feat.properties;
            const rawName = props.fna || props.nam || 'Sin nombre';
            const canonical = normalizeLocalityName(rawName);
            const dep = props.dep || props.dpto;

            resultados.push({
              id: String(props.ogc_fid || feat.id),
              nombre: toTitleCase(rawName),
              tipo: props.tya === 'Localidad' ? 'localidad' : 'paraje',
              municipioCanonico: canonical,
              departamento: dep ? toTitleCase(dep) : undefined,
              lat: props.lat,
              lng: props.long,
              fuente: 'IDEJuy BAHRA',
            });
          });
        }
      }
    }

    // Deduplicación
    const uniqueMap = new Map<string, GeorefJujuyItem>();
    resultados.forEach((item) => {
      const key = `${cleanText(item.nombre)}-${cleanText(item.municipioCanonico || '')}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    const finalResults = Array.from(uniqueMap.values()).slice(0, limit);

    return {
      fuente: fuenteUtilizada,
      total: finalResults.length,
      resultados: finalResults,
    };
  }

  private async queryGeorefNacion(endpoint: string, params: Record<string, string>): Promise<any | null> {
    const query = new URLSearchParams(params).toString();
    const url = `https://apis.datos.gob.ar/georef/api/${endpoint}?${query}`;
    try {
      const response = await axios.get(url, {
        headers: { Accept: 'application/json' },
        timeout: 2000,
      });
      return response.data;
    } catch (e: any) {
      this.logger.debug(`Georef Nación error/timeout: ${e.message}`);
      return null;
    }
  }

  private async queryIdejuyWFS(typename: string, cqlFilter?: string, maxFeatures = 25): Promise<any | null> {
    const baseUrl = 'https://geo.idejuy.jujuy.gob.ar/geoserver/ows';
    const params: Record<string, string> = {
      service: 'WFS',
      version: '1.0.0',
      request: 'GetFeature',
      typename,
      outputFormat: 'json',
      maxFeatures: String(maxFeatures),
    };
    if (cqlFilter) {
      params['cql_filter'] = cqlFilter;
    }

    try {
      const response = await axios.get(baseUrl, {
        params,
        headers: { Accept: 'application/json' },
        timeout: 3500,
      });
      return response.data;
    } catch (error: any) {
      this.logger.warn(`[Georef IDEJuy] Falló consulta a ${typename}: ${error.message}`);
      return null;
    }
  }
}

