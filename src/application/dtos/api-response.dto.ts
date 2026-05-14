/**
 * Standard API Response DTOs
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ description: 'Error code', example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Invalid email format',
  })
  message!: string;

  @ApiPropertyOptional({
    description: 'Field that caused the error',
    example: 'email',
  })
  field?: string;
}

export class PaginationDto {
  @ApiProperty({ description: 'Number of items per page', example: 50 })
  limit!: number;

  @ApiProperty({ description: 'Offset from start', example: 0 })
  offset!: number;

  @ApiProperty({ description: 'Total number of items', example: 150 })
  total!: number;
}

export class ApiResponseDto<T> {
  @ApiProperty({ description: 'Response data' })
  data!: T;

  @ApiProperty({
    description: 'Indicates if the operation was successful',
    example: true,
  })
  isSuccessful!: boolean;

  @ApiProperty({
    description: 'Array of errors (empty on success)',
    type: [ApiErrorDto],
  })
  errors!: ApiErrorDto[];

  @ApiPropertyOptional({
    description: 'Pagination info (only for paginated responses)',
  })
  pagination?: PaginationDto;
}

/**
 * Helper class to build standardized API responses
 */
export class ApiResponse {
  /**
   * Create a successful response without pagination
   */
  static success<T>(data: T): ApiResponseDto<T> {
    return {
      data,
      isSuccessful: true,
      errors: [],
    };
  }

  /**
   * Create a successful paginated response
   */
  static paginated<T>(
    data: T[],
    total: number,
    limit: number,
    offset: number,
  ): ApiResponseDto<T[]> {
    return {
      data,
      isSuccessful: true,
      errors: [],
      pagination: {
        limit,
        offset,
        total,
      },
    };
  }

  /**
   * Create an error response
   */
  static error<T = null>(
    errors: ApiErrorDto[],
    data: T = null as T,
  ): ApiResponseDto<T> {
    return {
      data,
      isSuccessful: false,
      errors,
    };
  }

  /**
   * Create a single error response
   */
  static singleError<T = null>(
    code: string,
    message: string,
    field?: string,
  ): ApiResponseDto<T> {
    return {
      data: null as T,
      isSuccessful: false,
      errors: [{ code, message, field }],
    };
  }
}
