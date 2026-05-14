import { AllExceptionsFilter } from './http-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  const mockResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  const mockHost = {
    switchToHttp: jest.fn().mockReturnValue({
      getResponse: () => mockResponse,
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should handle standard HttpExceptions', () => {
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith({
      data: null,
      isSuccessful: false,
      errors: [{ code: 'INTERNAL_ERROR', message: 'Forbidden' }],
    });
  });

  it('should handle validation exceptions (array messages)', () => {
    const exception = new HttpException({ message: ['error1', 'error2'] }, HttpStatus.BAD_REQUEST);
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      data: null,
      isSuccessful: false,
      errors: [
        { code: 'VALIDATION_ERROR', message: 'error1' },
        { code: 'VALIDATION_ERROR', message: 'error2' },
      ],
    });
  });

  it('should handle generic errors (non-HttpException)', () => {
    const exception = new Error('Database down');
    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      data: null,
      isSuccessful: false,
      errors: [{ code: 'INTERNAL_ERROR', message: 'Internal server error' }],
    });
  });
});
