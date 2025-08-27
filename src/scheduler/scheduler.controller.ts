import { Controller } from '@nestjs/common';
import { SchedulerService } from '../posts/scheduler.service';

@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}
}
