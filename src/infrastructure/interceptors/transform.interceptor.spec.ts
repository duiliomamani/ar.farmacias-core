import { ExecutionContext, CallHandler } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor';
import { of } from 'rxjs';
import { ApiRes } from '../../application/dtos/api-response.dto';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should transform standard response', (done) => {
    const mockContext = {} as ExecutionContext;
    const mockCallHandler = {
      handle: () => of({ test: 'data' }),
    } as CallHandler;

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual({
        data: { test: 'data' },
        isSuccessful: true,
        errors: [],
      });
      done();
    });
  });

  it('should return ApiRes if already formatted', (done) => {
    const mockContext = {} as ExecutionContext;
    const apiRes = ApiRes.success({ formatted: true });
    const mockCallHandler = {
      handle: () => of(apiRes),
    } as CallHandler;

    interceptor.intercept(mockContext, mockCallHandler).subscribe((result) => {
      expect(result).toEqual(apiRes);
      done();
    });
  });
});
