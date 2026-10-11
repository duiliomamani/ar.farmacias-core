import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

export interface TurnosJujuyPharmacy {
  sourceId: string;
  name: string;
  address: string;
  phone?: string;
  city: string;
  latitude?: number;
  longitude?: number;
  openingHours: string;
  isOnDuty: boolean;
  isPermanentlyOnDuty: boolean;
  dutyDate: string;
  source: string;
}

/** Scraper for the official HTML listing at turnosjujuy.com.ar. */
@Injectable()
export class TurnosJujuyScraperService {
  private readonly logger = new Logger(TurnosJujuyScraperService.name);
  private readonly baseUrl = 'https://turnosjujuy.com.ar/';
  private readonly headers = {
    'User-Agent': 'FarmaYaAR/1.0 (+https://farmaya.ar)',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'es-AR,es;q=0.9',
  };

  async scrape(localidad?: string): Promise<TurnosJujuyPharmacy[]> {
    if (localidad) {
      return this.scrapeLocalidad(localidad);
    }

    const initial = await axios.get(this.baseUrl, { headers: this.headers, timeout: 30000 });
    const $ = cheerio.load(initial.data);
    const localidades = [...new Set(
      $('select[name="localidad"] option').map((_, option) => this.clean($(option).attr('value') || $(option).text())).get(),
    )].filter(Boolean);

    const all = [...this.parse(initial.data, this.baseUrl)];
    for (const value of localidades) {
      const rows = await this.scrapeLocalidad(value);
      all.push(...rows);
    }
    return [...new Map(all.map((item) => [`${item.dutyDate}-${item.sourceId}`, item])).values()];
  }

  private async scrapeLocalidad(localidad: string): Promise<TurnosJujuyPharmacy[]> {
    const response = await axios.post(
      this.baseUrl,
      new URLSearchParams({ localidad }).toString(),
      { headers: { ...this.headers, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 },
    );
    return this.parse(response.data, this.baseUrl, `localidad=${localidad}`);
  }

  parse(html: string, source = this.baseUrl, context = 'consulta inicial'): TurnosJujuyPharmacy[] {
    const $ = cheerio.load(html);
    const dutyDate = this.parseDate($('.titulo-principal').next('p').text());
    const points = this.parsePoints(html);
    const result: TurnosJujuyPharmacy[] = [];

    $('tr.item-farmacia-target').each((_, row) => {
      const item = this.parseRow($, row, points, dutyDate, source);
      if (item) result.push(item);
    });

    // The source renders cards instead of table rows on mobile. Avoid duplicates
    // when a future version stops sending the desktop table.
    if (result.length === 0) {
      $('.list-group-item.item-farmacia-target').each((_, card) => {
        const item = this.parseCard($, card, points, dutyDate, source);
        if (item) result.push(item);
      });
    }

    if (result.length === 0) {
      this.logger.debug(`turnosjujuy.com.ar returned no pharmacy rows (${context})`);
    }
    return result;
  }

  private parseRow($: cheerio.CheerioAPI, row: Element, points: Map<string, any>, dutyDate: string, source: string) {
    const cells = $(row).find('td');
    const city = this.clean(cells.eq(0).text());
    const name = this.clean(cells.eq(1).text());
    const contact = this.clean(cells.eq(2).text());
    const openingHours = this.clean(cells.eq(3).text());
    const isPermanentlyOnDuty = /permanente/i.test(openingHours);
    const isOnDuty = isPermanentlyOnDuty || cells.eq(3).find('.badge-open').length > 0 || /de turno/i.test(openingHours);
    const mapUrl = $(row).find('a[href*="google.com/maps"]').attr('href');
    return this.buildItem($(row).attr('data-farmacia-id'), city, name, contact, openingHours, isOnDuty, mapUrl, points, dutyDate, source);
  }

  private parseCard($: cheerio.CheerioAPI, card: Element, points: Map<string, any>, dutyDate: string, source: string) {
    const city = this.clean($(card).find('span').first().text());
    const name = this.clean($(card).find('h5').first().text());
    const lines = $(card).find('.text-secondary').text().split(/\n/).map((value) => this.clean(value)).filter(Boolean);
    const openingHours = this.clean($(card).find('.badge-open').text());
    const isPermanentlyOnDuty = /permanente/i.test(openingHours);
    const isOnDuty = isPermanentlyOnDuty || $(card).find('.badge-open').length > 0 || /de turno/i.test(openingHours);
    const mapUrl = $(card).find('a[href*="google.com/maps"]').attr('href');
    return this.buildItem($(card).attr('data-farmacia-id'), city, name, lines.join(' '), openingHours, isOnDuty, mapUrl, points, dutyDate, source);
  }

  private buildItem(id: string | undefined, city: string, name: string, contact: string, openingHours: string, isOnDuty: boolean, mapUrl: string | undefined, points: Map<string, any>, dutyDate: string, source: string) {
    if (!name) return null;
    const point = id ? points.get(id) : undefined;
    const latitudeFromMapUrl = this.coordinateFromUrl(mapUrl, 0);
    const longitudeFromMapUrl = this.coordinateFromUrl(mapUrl, 1);
    const phone = contact.match(/(?:\+?54\s?)?\b\d{4,5}[-\s]\d{5,8}\b/)?.[0]?.trim();
    const address = phone ? contact.replace(phone, '').trim() : contact;
    const isPermanentlyOnDuty = /permanente/i.test(openingHours);
    return {
      sourceId: id || `${city}-${name}`,
      name,
      address,
      phone,
      city,
      // The pharmacy-specific Google Maps link is more precise than the
      // shared points array, especially for permanent pharmacies.
      latitude: latitudeFromMapUrl ?? point?.lat,
      longitude: longitudeFromMapUrl ?? point?.lon,
      openingHours,
      isOnDuty,
      isPermanentlyOnDuty,
      dutyDate,
      source,
    } satisfies TurnosJujuyPharmacy;
  }

  private parsePoints(html: string): Map<string, any> {
    const points = new Map<string, any>();
    const match = html.match(/var puntos\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return points;
    for (const point of match[1].matchAll(/PAMI:\s*([\d]+)[\s\S]*?lat:\s*(-?[\d.]+),lon:\s*(-?[\d.]+)/g)) {
      points.set(point[1], { lat: Number(point[2]), lon: Number(point[3]) });
    }
    return points;
  }

  private coordinateFromUrl(url: string | undefined, index: number): number | undefined {
    const match = url?.match(/maps\?q=(-?[\d.]+),(-?[\d.]+)/);
    return match ? Number(match[index + 1]) : undefined;
  }

  private parseDate(value: string): string {
    const match = value.match(/(\d{1,2})[^\d]+(\d{1,2})[^\d]+(\d{4})/);
    if (!match) return new Date().toISOString().slice(0, 10);
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  private clean(value: string): string { return value.replace(/\s+/g, ' ').trim(); }
}
