import { TurnosJujuyScraperService } from './turnos-jujuy-scraper.service';

describe('TurnosJujuyScraperService', () => {
  it('parses the official HTML table and its embedded coordinates', () => {
    const service = new TurnosJujuyScraperService();
    const html = `
      <h4 class="titulo-principal">Farmacias de Turno hoy</h4>
      <p>domingo, 11 de octubre de 2026</p>
      <table><tbody>
        <tr data-farmacia-id="403" class="item-farmacia-target">
          <td>ABRA PAMPA</td><td>MARIELA</td>
          <td>SARMIENTO N° 512 03887-429772</td><td><span class="badge-open">de 8:00 a 8:00</span></td>
          <td><a href="https://www.google.com/maps?q=-22.72063,-65.69734">Cómo llegar</a></td>
        </tr>
      </tbody></table>
      <script>var puntos = [{nombre: 'MARIELA', PAMI: 403, lat: -22.72063,lon: -65.69734}];</script>`;

    expect(service.parse(html)).toEqual([
      expect.objectContaining({
        sourceId: '403',
        name: 'MARIELA',
        city: 'ABRA PAMPA',
        address: 'SARMIENTO N° 512',
        phone: '03887-429772',
        latitude: -22.72063,
        longitude: -65.69734,
        dutyDate: '2026-10-11',
        isOnDuty: true,
        isVoluntary: false,
      }),
    ]);
  });

  it('marks permanent pharmacies as on duty permanently', () => {
    const service = new TurnosJujuyScraperService();
    const html = `
      <h4 class="titulo-principal">Farmacias de Turno hoy</h4>
      <p>domingo, 11 de octubre de 2026</p>
      <table><tbody>
        <tr data-farmacia-id="498" class="item-farmacia-target">
          <td>SAN SALVADOR DE JUJUY</td><td>FARMACITY YRIGOYEN</td>
          <td>AVDA. YRIGOYEN Nº 1116</td><td>Permanente</td>
        </tr>
      </tbody></table>`;

    expect(service.parse(html)).toEqual([
      expect.objectContaining({
        name: 'FARMACITY YRIGOYEN',
        openingHours: 'Permanente',
        isOnDuty: true,
        isPermanentlyOnDuty: true,
        isVoluntary: false,
      }),
    ]);
  });

  it('marks blue non-duty rows as voluntary', () => {
    const service = new TurnosJujuyScraperService();
    const html = `
      <h4 class="titulo-principal">Farmacias de Turno hoy</h4>
      <p>domingo, 11 de octubre de 2026</p>
      <table><tbody>
        <tr data-farmacia-id="476" class="item-farmacia-target">
          <td>SAN SALVADOR DE JUJUY</td><td>MALL</td>
          <td>AV. EL ÉXODO N°840 LOCAL N°1</td>
          <td><span class="badge">de 8:00 a 24:00</span></td>
        </tr>
      </tbody></table>`;

    expect(service.parse(html)).toEqual([
      expect.objectContaining({
        name: 'MALL',
        isOnDuty: false,
        isPermanentlyOnDuty: false,
        isVoluntary: true,
      }),
    ]);
  });

  it('prefers the pharmacy-specific map coordinate over shared points', () => {
    const service = new TurnosJujuyScraperService();
    const html = `
      <h4 class="titulo-principal">Farmacias de Turno hoy</h4>
      <p>domingo, 11 de octubre de 2026</p>
      <table><tbody>
        <tr data-farmacia-id="498" class="item-farmacia-target">
          <td>SAN SALVADOR DE JUJUY</td><td>FARMACITY YRIGOYEN</td>
          <td>AVDA. YRIGOYEN Nº 1116</td><td>Permanente</td>
          <td><a href="https://www.google.com/maps?q=-24.181,-65.301">Cómo llegar</a></td>
        </tr>
      </tbody></table>
      <script>var puntos = [{PAMI: 498, lat: -24.185,lon: -65.306}];</script>`;

    expect(service.parse(html)[0]).toEqual(expect.objectContaining({
      latitude: -24.181,
      longitude: -65.301,
    }));
  });
});
