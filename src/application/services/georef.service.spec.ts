import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeoRefService } from './georef.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GeoRefService', () => {
  let service: GeoRefService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeoRefService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GeoRefService>(GeoRefService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockConfigService.get.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('reverseGeocode', () => {
    it('should return location data from coordinates', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          ubicacion: {
            lat: -24.1856479,
            lon: -65.3069356,
            provincia_id: '38',
            municipio_id: '380035',
            departamento_id: '38021',
          },
        },
      });

      const result = await service.reverseGeocode(-24.1856479, -65.3069356);

      expect(result).toEqual({
        lat: -24.1856479,
        lng: -65.3069356,
        provinciaId: '38',
        municipioId: '380035',
        localidadId: '38021',
      });
      expect(mockedAxios.get).toHaveBeenCalledWith('https://apis.datos.gob.ar/georef/api/ubicacion', expect.anything());
    });

    it('should handle errors in reverse geocoding', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API error'));
      const result = await service.reverseGeocode(0, 0);
      expect(result).toBeNull();
    });
  });

  describe('geocodeAddress', () => {
    it('should return geo data from Google Maps (Strategy 1)', async () => {
      mockConfigService.get.mockReturnValue('fake-google-key');
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          status: 'OK',
          results: [
            {
              geometry: {
                location: { lat: -24.15, lng: -65.15 },
              },
            },
          ],
        },
      });
      // Reverse Geocode
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          ubicacion: {
            lat: -24.15,
            lon: -65.15,
            provincia_id: '38',
            municipio_id: '380035',
            departamento_id: '38021',
          },
        },
      });

      const result = await service.geocodeAddress('Calle 789', 'Jujuy');

      expect(result).toEqual({
        lat: -24.15,
        lng: -65.15,
        provinciaId: '38',
        municipioId: '380035',
        localidadId: '38021',
      });
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should fallback to Nominatim if Google Maps fails (Strategy 2)', async () => {
      // First call (Google Maps returns empty config, so it skips axios or we don't set config so it skips)
      // Second call (Nominatim) returns data
      mockedAxios.get.mockResolvedValueOnce({
        data: [
          {
            lat: '-24.2',
            lon: '-65.2',
          },
        ],
      });
      // Third call (Reverse Geocode)
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          ubicacion: {
            lat: -24.2,
            lon: -65.2,
            provincia_id: '38',
            municipio_id: '380035',
            departamento_id: '38021',
          },
        },
      });

      const result = await service.geocodeAddress('Calle 456', 'Palpalá');

      expect(result).toEqual({
        lat: -24.2,
        lng: -65.2,
        provinciaId: '38',
        municipioId: '380035',
        localidadId: '38021',
      });
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it('should return null if both strategies fail', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: [] });

      const result = await service.geocodeAddress('Calle Desconocida', 'Desierto');
      expect(result).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));
      const result = await service.geocodeAddress('Calle 789');
      expect(result).toBeNull();
    });

    it('should prepend pharmacy name to address if not present', async () => {
      mockConfigService.get.mockReturnValue('fake-google-key');
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          status: 'OK',
          results: [
            {
              geometry: {
                location: { lat: -24.15, lng: -65.15 },
              },
            },
          ],
        },
      });
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          ubicacion: {
            lat: -24.15,
            lon: -65.15,
            provincia_id: '38',
          },
        },
      });

      await service.geocodeAddress('Belgrano 100', 'S.S. de Jujuy', 'San Martin');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('maps/api/geocode/json'),
        expect.objectContaining({
          params: expect.objectContaining({
            address: 'Farmacia San Martin, Belgrano 100, S.S. de Jujuy, Jujuy, Argentina',
          }),
        })
      );
    });

    it('should not prepend pharmacy name if already in address', async () => {
      mockConfigService.get.mockReturnValue('fake-google-key');
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          status: 'OK',
          results: [
            {
              geometry: {
                location: { lat: -24.15, lng: -65.15 },
              },
            },
          ],
        },
      });
      mockedAxios.get.mockResolvedValueOnce({ data: { ubicacion: {} } });

      await service.geocodeAddress('Farmacia San Martin, Belgrano 100', 'S.S. de Jujuy', 'San Martin');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('maps/api/geocode/json'),
        expect.objectContaining({
          params: expect.objectContaining({
            address: 'Farmacia San Martin, Belgrano 100, S.S. de Jujuy, Jujuy, Argentina',
          }),
        })
      );
    });
  });
});