import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiErrorDto } from '../../application/dtos/api-response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.message
        : 'Internal server error';

    const exceptionResponse: any = 
      exception instanceof HttpException
        ? exception.getResponse()
        : null;

    let errors: ApiErrorDto[] = [];

    if (exceptionResponse && typeof exceptionResponse === 'object') {
      if (Array.isArray(exceptionResponse.message)) {
        errors = exceptionResponse.message.map((msg: string) => ({
          code: 'VALIDATION_ERROR',
          message: msg,
        }));
      } else if (exceptionResponse.message) {
        errors = [{
          code: exceptionResponse.error || 'ERROR',
          message: exceptionResponse.message,
        }];
      }
    } else {
      errors = [{
        code: 'INTERNAL_ERROR',
        message: message,
      }];
    }

    response.status(status).json({
      data: null,
      isSuccessful: false,
      errors: errors,
    });
  }
}
