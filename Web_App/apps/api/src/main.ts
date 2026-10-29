import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';

async function bootstrap() {
  const logger = new Logger('HRMS_Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;
  const prefix = configService.get<string>('API_PREFIX') || '/api';

  // Enable CORS for Next.js web (3000) and Flutter Mobile (Android localhost/10.0.2.2)
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global Prefix
  app.setGlobalPrefix(prefix.replace(/^\//, ''));

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Global Filter & Interceptor
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Increase JSON and URL-encoded body limit to 50MB for base64 photo uploads
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  // Static uploads directory for employee avatars and documents
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  const avatarsDir = path.join(uploadsDir, 'avatars');
  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }
  const attendanceDir = path.join(uploadsDir, 'attendance');
  if (!fs.existsSync(attendanceDir)) {
    fs.mkdirSync(attendanceDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));
  app.use('/api/uploads', express.static(uploadsDir));

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('HRMS API with Google Maps Geofencing')
    .setDescription(
      'Enterprise REST API for greytHR-style HRMS supporting SUPERBEE, GTIDS, and GTIB with 50m Google Maps geofence attendance, role isolation, leave, and payroll.',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter JWT Bearer token',
        in: 'header',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`========================================================`);
  logger.log(`🚀 HRMS NestJS API running on: http://localhost:${port}${prefix}`);
  logger.log(`📚 Swagger OpenAPI Documentation at: http://localhost:${port}/api/docs`);
  logger.log(`========================================================`);
}

bootstrap();
