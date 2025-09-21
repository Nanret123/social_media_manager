@Controller('workers')
export class WorkersController {
  constructor(private readonly workerManager: WorkerManager) {}

  @Get('status')
  getWorkerStatus(@Query('name') name?: string) {
    return this.workerManager.getWorkerStatus(name);
  }

  @Get('health')
  async getHealth() {
    return this.workerManager.healthCheck();
  }

  @Post('restart/:name')
  async restartWorker(@Param('name') name: string) {
    const success = await this.workerManager.restartWorker(name);
    return { success, message: success ? 'Worker restarted' : 'Restart failed' };
  }

  @Post('pause/:name')
  async pauseWorker(@Param('name') name: string) {
    const success = await this.workerManager.pauseWorker(name);
    return { success, message: success ? 'Worker paused' : 'Pause failed' };
  }

  @Post('resume/:name')
  async resumeWorker(@Param('name') name: string) {
    const success = await this.workerManager.resumeWorker(name);
    return { success, message: success ? 'Worker resumed' : 'Resume failed' };
  }
}