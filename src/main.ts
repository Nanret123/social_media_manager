import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import { BullBoardModule } from './scheduler/bull-board.module';
import * as bodyParser from 'body-parser';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(
    new HttpExceptionFilter(),
    new PrismaExceptionFilter(),
  );

 app.use(new LoggerMiddleware().use);
  const bullBoard = app.get(BullBoardModule);
  bullBoard.setup(app);

    app.use('/webhooks', bodyParser.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    }
  }));
  
  // Other middleware for other routes
  app.use(bodyParser.json());

  // // Get worker manager and initialize
  // const workerManager = app.get(WorkerManager);
  // // Workers auto-initialize via onModuleInit

  // // Capture raw body for webhook signature verification
  // app.use(
  //   bodyParser.json({
  //     verify: (req: any, _res, buf) => {
  //       req.rawBody = buf.toString(); // keep raw JSON string
  //     },
  //   }),
  // );

  //  // Enable graceful shutdown
  // app.enableShutdownHooks();
  
  // // app.use('/health', (req, res) => {
  // //   const workerManager = app.get(WorkerManager);
  // //   const health = workerManager.healthCheck();
  // //   res.json(health);
  // // });
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
