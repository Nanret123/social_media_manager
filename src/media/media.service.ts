import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { PrismaService } from 'src/prisma/prisma.service';
import { unlink } from 'fs/promises';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './media.constants';
import { MediaFile } from '@prisma/client';
import { uploadBufferToCloudinary } from 'src/common/utility/cloudinary-promisified';

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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upload a single file to Cloudinary and store in DB
   */
  async uploadFile(
    userId: string,
    organizationId: string,
    file: Express.Multer.File,
  ) {
    this.validateFile(file);

    // Upload directly to Cloudinary
    const uploaded = await this.uploadToCloudinary(
      file.path,
      file.filename,
      file.mimetype,
    );

    return this.prisma.mediaFile.create({
      data: {
        userId,
        organizationId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: uploaded.url,
        publicId: uploaded.publicId,
        thumbnailUrl: uploaded.thumbnailUrl,
        duration: uploaded.duration,
      },
    });
  }

  /**
   * Upload multiple files to Cloudinary and store in DB
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    userId: string,
    organizationId: string,
  ) {
    try {
      const results = await Promise.all(
        files.map(async (file) => {
          this.validateFile(file);

          const uploaded = await this.uploadToCloudinary(
            file.path,
            file.filename,
            file.mimetype,
          );

          return this.prisma.mediaFile.create({
            data: {
              userId,
              organizationId,
              filename: file.filename,
              originalName: file.originalname,
              mimeType: file.mimetype,
              size: file.size,
              url: uploaded.url,
              publicId: uploaded.publicId,
              thumbnailUrl: uploaded.thumbnailUrl,
              duration: uploaded.duration,
            },
          });
        }),
      );

      return results;
    } catch (err) {
      throw new InternalServerErrorException(
        'Multiple upload failed',
        err.message,
      );
    }
  }

  /**
   * Delete file from Cloudinary + DB
   */
  async deleteFile(fileId: string) {
    const file = await this.prisma.mediaFile.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new BadRequestException('File not found');
    }

    if (file.publicId) {
      await cloudinary.uploader.destroy(file.publicId, {
        resource_type: file.mimeType.startsWith('video/') ? 'video' : 'image',
      });
    }

    return this.prisma.mediaFile.delete({ where: { id: fileId } });
  }

  /**
   * Internal: upload helper
   */
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
          { width: 300, height: 300, crop: 'thumb', format: 'jpg' },
        ];
      }

      const result = await cloudinary.uploader.upload(filePath, uploadOptions);

      // Clean up tmp file
      await unlink(filePath).catch(() => {});

      return {
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        duration: isVideo ? result.duration : undefined,
        thumbnailUrl: isVideo && result.eager?.[0]?.secure_url,
      };
    } catch (error) {
      await unlink(filePath).catch(() => {});
      throw new BadRequestException('Cloudinary upload failed');
    }
  }

  /**
   * Validate file type + size
   */
  private validateFile(file: Express.Multer.File) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed.`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      );
    }
  }

async uploadGeneratedFile(
  userId: string,
  organizationId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  context?: string,
  aiGenerationId?: string
): Promise<MediaFile> {
  // validate size/mime if you like
  const isVideo = mimeType.startsWith('video/');
  const uploadOptions: any = {
    public_id: `rooli/${filename.replace(/\.[^/.]+$/, '')}-${Date.now()}`,
    resource_type: isVideo ? 'video' : 'image',
    folder: 'rooli',
    overwrite: false,
  };

  const result = await uploadBufferToCloudinary(buffer, uploadOptions);

  return this.prisma.mediaFile.create({
    data: {
      userId,
      organizationId,
      filename,
      originalName: filename,
      mimeType,
      size: buffer.length,
      url: result.secure_url,
      publicId: result.public_id,
      thumbnailUrl: isVideo ? result.eager?.[0]?.secure_url : result.secure_url,
      duration: isVideo ? result.duration : undefined,
      isAIGenerated: !!aiGenerationId,
      aiGenerationContext: context,
      aiGenerationId,
    },
  });
}


  /**
   * Get all AI-generated media for an organization
   */
  async getAIGeneratedMedia(organizationId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    
    return this.prisma.mediaFile.findMany({
      where: {
        organizationId,
        isAIGenerated: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }
}