import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger.config';
// import helmet from 'helmet';
// import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //  app.use(helmet());
  // app.use(compression());

  // CORS
  // app.enableCors({
  //   origin:
  //     process.env.NODE_ENV === 'production' ? ['https://yourdomain.com'] : true,
  //   credentials: true,
  // });


  app.enableCors();
  app.setGlobalPrefix('api/v1');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      //disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
