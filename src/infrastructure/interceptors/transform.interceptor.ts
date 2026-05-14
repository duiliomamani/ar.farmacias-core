import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiRes, ApiResponseDto } from '../../application/dtos/api-response.dto';

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponseDto<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponseDto<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data is already an ApiResponseDto, return it as is
        if (data && typeof data === 'object' && 'isSuccessful' in data && 'errors' in data) {
          return data;
        }
        return ApiRes.success(data);
      }),
    );
  }
}
