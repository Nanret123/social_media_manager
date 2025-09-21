import { Queue } from 'bullmq';
import { redisConnection } from './redis-config';

export const reportQueue = new Queue('report-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    timeout: 300000, // 5 minutes timeout per job
  },
});