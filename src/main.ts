import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { swaggerConfig } from './config/swagger.config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { LoggerMiddleware } from './common/middlewares/logger.middleware';
import * as bodyParser from 'body-parser';
import { BullBoardModule } from './common/bull-boad/bull-board.module';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Mount Bull Board outside global prefix/versioning
  const bullBoardModule = app.get(BullBoardModule);
  bullBoardModule.mount(app);

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

//  app.use(new LoggerMiddleware().use);
//   const bullBoard = app.get(BullBoardModule);
//   bullBoard.setup(app);

app.use('/webhooks', (req, res, next) => {
  if (req.method === 'POST') {
    bodyParser.json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf.toString();
      }
    })(req, res, next);
  } else {
    next();
  }
});

  
  // Other middleware for other routes
  app.use(bodyParser.json());


  
  // // app.use('/health', (req, res) => {
  // //   const workerManager = app.get(WorkerManager);
  // //   const health = workerManager.healthCheck();
  // //   res.json(health);
  // // });
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
