import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './infrastructure/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './infrastructure/filters/http-exception.filter';

let app: INestApplication;

async function createApp() {
  if (app) {
    return app;
  }

  app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors();
  
  // Standardized response format
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable global validation pipe with strict settings
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('FarmaYa AR API')
    .setDescription('Georeferenced Pharmacy On-Duty Tracker for Argentina')
    .setVersion('1.0')
    .addTag('pharmacies')
    .addTag('scraping')
    .addTag('reports')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.init();
  return app;
}

// Local development
async function bootstrap() {
  const application = await createApp();
  const port = process.env.PORT ?? 5001;
  await application.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}

// Only bootstrap locally, not in Vercel
if (process.env.VERCEL !== '1') {
  bootstrap();
}

// Export for Vercel serverless
export default async function handler(req: any, res: any) {
  const application = await createApp();
  const server = application.getHttpAdapter().getInstance();
  return server(req, res);
}
