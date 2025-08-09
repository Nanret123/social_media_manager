import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('Social Media Manager API')
  .setDescription('API Documentation for Social Media Manager')
  .setVersion('1.0')
  .addBearerAuth() // JWT support
  .build();
