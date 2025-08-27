import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';

@Processor('media-processing') // Listen to the 'media-processing' queue
export class MediaProcessor {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: any, // We'll use a trick to access private method
  ) {}

  @Process('process-upload') // Process jobs named 'process-upload'
  async handleMediaUpload(job: Job<{ mediaRecordId: string; filePath: string }>) {
    const { mediaRecordId, filePath } = job.data;
    this.logger.debug(`Processing media upload for record ID: ${mediaRecordId}`);

    try {
      // 1. Fetch the record from the database
      const mediaRecord = await this.prisma.mediaFile.findUnique({
        where: { id: mediaRecordId },
      });

      if (!mediaRecord) {
        throw new Error(`Media record ${mediaRecordId} not found.`);
      }

      // 2. PERFORM THE ACTUAL UPLOAD
      // This is the key part. We call the private method from MediaService.
      // Since it's private, we need to use a slight workaround.
      const uploadResult = await (this.mediaService as any).uploadToCloudinary(
        filePath,
        mediaRecord.filename,
        mediaRecord.mimeType,
      );

      // 3. Update the database record on success
      await this.prisma.mediaFile.update({
        where: { id: mediaRecordId },
        data: {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          thumbnailUrl: uploadResult.thumbnailUrl,
          duration: uploadResult.duration,
          processed: true, // Mark as fully processed
        },
      });

      this.logger.log(`Successfully processed media upload for ID: ${mediaRecordId}`);
      return { success: true, mediaRecordId };

    } catch (error) {
      this.logger.error(`Failed to process media ${mediaRecordId}: ${error.message}`);

      // 4. Optional: Update the record on failure, or just let it remain as processed: false
      await this.prisma.mediaFile.update({
        where: { id: mediaRecordId },
        data: { 
          processed: true, // Maybe change this to a 'FAILED' status in your schema later
          // You could add an errorMessage field to MediaFile
        },
      });

      // Throw the error to let BullMQ handle the retry logic
      throw error;
    }
  }
}