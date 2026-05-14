import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './infrastructure/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './infrastructure/filters/http-exception.filter';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();

async function createNestApp(expressInstance: express.Express): Promise<INestApplication> {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

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

// Singleton for Vercel
let cachedApp: INestApplication;

async function bootstrap() {
  if (!cachedApp) {
    cachedApp = await createNestApp(server);
  }
  return cachedApp;
}

// Local development
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  bootstrap().then(async (app) => {
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`Application is running on: http://localhost:${port}`);
  });
}

// Export for Vercel
export default async (req: any, res: any) => {
  await bootstrap();
  server(req, res);
};
