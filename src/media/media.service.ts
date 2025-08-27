import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { PrismaService } from 'src/prisma/prisma.service';
import { unlink } from 'fs/promises';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './media.constants';

export interface UploadResult {
  url: string;
  publicId: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('media-processing') private mediaQueue: Queue,
  ) {}

   async uploadFile(
    userId: string,
    organizationId: string,
    file: Express.Multer.File,
  ) {
    // 1. SECURITY: Validate File Type & Size (Same as before)
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed.`);
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
    }

    // 2. Create a DB record, marking it as unprocessed
    const mediaRecord = await this.prisma.mediaFile.create({
      data: {
        userId,
        organizationId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        processed: false, // This is key - it's not ready yet
      },
    });

    // 3. Add a job to the BullMQ queue for processing
    await this.mediaQueue.add(
      'process-upload', // Job name
      {
        mediaRecordId: mediaRecord.id,
        filePath: file.path, // Path to the temporary file
      },
      { 
        attempts: 3, // Retry 3 times on failure
        backoff: { type: 'exponential', delay: 2000 } // Wait 2s, 4s, 8s between retries
      }
    );

    // 4. Return the record immediately, even though it's not processed
    return mediaRecord;
  }

  private async uploadToCloudinary(
    filePath: string,
    filename: string,
    mimeType: string,
  ): Promise<UploadResult> {
    try {
      const isVideo = mimeType.startsWith('video/');

      const uploadOptions: any = {
        public_id: `rooli/${filename}`,
        resource_type: isVideo ? 'video' : 'image',
        folder: 'rooli',
      };

      if (isVideo) {
        uploadOptions.eager = [
          { width: 300, height: 300, crop: 'thumb', format: 'jpg' }, // Thumbnail
        ];
      }

      const result = await cloudinary.uploader.upload(filePath, uploadOptions);

      // Delete local temp file
      await unlink(filePath);

      const response: UploadResult = {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
      };

      if (isVideo) {
        response.duration = result.duration;
        if (result.eager && result.eager[0]) {
          response.thumbnailUrl = result.eager[0].secure_url;
        }
      }

      return response;
    } catch (error) {
      await unlink(filePath).catch(() => {});
      throw new BadRequestException('Cloudinary upload failed');
    }
  }
}
