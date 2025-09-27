// src/scheduling/schedule-optimizer.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Platform } from '@prisma/client';

interface OptimalTime {
  day: string; // 'monday', 'tuesday', etc.
  hours: number[]; // [9, 14, 19] - hours in 24h format
}

@Injectable()
export class ScheduleOptimizerService {
  private readonly logger = new Logger(ScheduleOptimizerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOptimalPostingTimes(organizationId: string, platform: Platform) {
    // Try to get custom schedule first
    let schedule = await this.prisma.postingSchedule.findUnique({
      where: { organizationId_platform: { organizationId, platform } },
    });

    if (!schedule || !schedule.isActive) {
      // Fall back to platform-specific optimal times
      schedule = await this.getPlatformOptimalTimes(platform, organizationId);
    }

   return schedule.optimalTimes as unknown as OptimalTime[];
  }

  async calculateNextOptimalTime(organizationId: string, platform: Platform) {
    const optimalTimes = await this.getOptimalPostingTimes(organizationId, platform);
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentHour = now.getHours();

    // Convert day number to string
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDayName = days[currentDay];

    // Find next optimal time
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const targetDay = (currentDay + dayOffset) % 7;
      const targetDayName = days[targetDay];
      
      const dayTimes = optimalTimes.find(t => t.day === targetDayName)?.hours || [];
      const sortedTimes = dayTimes.sort((a, b) => a - b);

      for (const hour of sortedTimes) {
        const targetDate = new Date(now);
        targetDate.setDate(now.getDate() + dayOffset);
        targetDate.setHours(hour, 0, 0, 0);

        // If this is today, check if the time is in the future
        if (dayOffset === 0 && hour <= currentHour) {
          continue;
        }

        // Check if this time is available (not exceeding max posts per day)
        if (await this.isTimeAvailable(organizationId, platform, targetDate)) {
          return targetDate;
        }
      }
    }

    // Fallback: 24 hours from now
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  private async isTimeAvailable(organizationId: string, platform: Platform, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Count already scheduled posts for this day
    const scheduledCount = await this.prisma.post.count({
      where: {
        organizationId,
        socialAccount: { platform },
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['SCHEDULED', 'PUBLISHING'] },
      },
    });

    const schedule = await this.prisma.postingSchedule.findUnique({
      where: { organizationId_platform: { organizationId, platform } },
    });

    const maxPosts = schedule?.maxPostsPerDay || 5;

    return scheduledCount < maxPosts;
  }

  private async getPlatformOptimalTimes(platform: Platform, organizationId: string): Promise<any> {
    // Platform-specific optimal times based on industry research
    const platformTimes = {
      INSTAGRAM: {
        optimalTimes: [
          { day: 'monday', hours: [11, 15, 19] },
          { day: 'tuesday', hours: [11, 15, 19] },
          { day: 'wednesday', hours: [11, 15, 19] },
          { day: 'thursday', hours: [11, 15, 19] },
          { day: 'friday', hours: [11, 15, 19] },
          { day: 'saturday', hours: [10, 14, 18] },
          { day: 'sunday', hours: [10, 14, 18] },
        ],
        maxPostsPerDay: 3,
      },
      FACEBOOK: {
        optimalTimes: [
          { day: 'monday', hours: [9, 13, 17] },
          { day: 'tuesday', hours: [9, 13, 17] },
          { day: 'wednesday', hours: [9, 13, 17] },
          { day: 'thursday', hours: [9, 13, 17] },
          { day: 'friday', hours: [9, 13, 17] },
          { day: 'saturday', hours: [10, 14, 18] },
          { day: 'sunday', hours: [10, 14, 18] },
        ],
        maxPostsPerDay: 5,
      },
      LINKEDIN: {
        optimalTimes: [
          { day: 'monday', hours: [8, 12, 16] },
          { day: 'tuesday', hours: [8, 12, 16] },
          { day: 'wednesday', hours: [8, 12, 16] },
          { day: 'thursday', hours: [8, 12, 16] },
          { day: 'friday', hours: [8, 12, 16] },
        ],
        maxPostsPerDay: 2,
      },
      X: {
        optimalTimes: [
          { day: 'monday', hours: [8, 12, 16, 20] },
          { day: 'tuesday', hours: [8, 12, 16, 20] },
          { day: 'wednesday', hours: [8, 12, 16, 20] },
          { day: 'thursday', hours: [8, 12, 16, 20] },
          { day: 'friday', hours: [8, 12, 16, 20] },
          { day: 'saturday', hours: [10, 14, 18, 22] },
          { day: 'sunday', hours: [10, 14, 18, 22] },
        ],
        maxPostsPerDay: 10,
      },
    };

    const config = platformTimes[platform] || platformTimes.INSTAGRAM;

    // Create or update the schedule
    return this.prisma.postingSchedule.upsert({
      where: { organizationId_platform: { organizationId, platform } },
      create: {
        organizationId,
        platform,
        optimalTimes: config.optimalTimes,
        maxPostsPerDay: config.maxPostsPerDay,
        source: 'AI_RECOMMENDATION',
      },
      update: {
        optimalTimes: config.optimalTimes,
        maxPostsPerDay: config.maxPostsPerDay,
        lastUpdated: new Date(),
      },
    });
  }
}