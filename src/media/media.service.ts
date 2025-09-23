import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './media.constants';
import { MediaFile } from '@prisma/client';
import { CloudinaryService } from './cloudinary.service';

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
    private readonly cloudinary: CloudinaryService
  ) {}

  /**
   * Upload a single file (manual upload)
   */
  async uploadFile(
    userId: string,
    organizationId: string,
    file: Express.Multer.File,
  ) {
    this.validateFile(file);

    const uploaded = await this.cloudinary.uploadFile(file);

    return this.prisma.mediaFile.create({
      data: {
        userId,
        organizationId,
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        thumbnailUrl: uploaded.thumbnailUrl,
        duration: uploaded.duration,
      },
    });
  }

  /**
   * Upload multiple files (manual upload)
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    userId: string,
    organizationId: string,
  ) {
    const results = await Promise.all(
      files.map(async (file) => {
        this.validateFile(file);
        const uploaded = await this.cloudinary.uploadFile(file);

        return this.prisma.mediaFile.create({
          data: {
            userId,
            organizationId,
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            thumbnailUrl: uploaded.thumbnailUrl,
            duration: uploaded.duration,
          },
        });
      }),
    );

    return results;
  }

   /**
   * Save an already-uploaded Cloudinary asset as a MediaFile
   */
  async saveGeneratedMedia(params: {
    userId: string;
    organizationId: string;
    url: string;
    publicId: string;
    filename?: string;
    originalName?: string;
    mimeType?: string;
    size?: number;
    aiGenerationId?: string;
    aiGenerationContext?: any; // object with prompt/model/etc
  }) {
    const {
      userId, organizationId, url, publicId, filename, originalName, mimeType, size, aiGenerationId, aiGenerationContext,
    } = params;

    return this.prisma.mediaFile.create({
      data: {
        userId,
        organizationId,
        filename: filename ?? publicId.split('/').pop(),
        originalName: originalName ?? filename ?? publicId.split('/').pop(),
        mimeType: mimeType ?? 'image/jpeg',
        size: size ?? 0,
        url,
        publicId,
        isAIGenerated: !!aiGenerationId,
        aiGenerationContext: aiGenerationContext ?? null,
        aiGenerationId: aiGenerationId ?? null,
      },
    });
  }
  /**
   * Delete file from Cloudinary + DB
   */
  async deleteFile(fileId: string) {
    const file = await this.prisma.mediaFile.findUnique({
      where: { id: fileId },
    });

    if (!file) throw new NotFoundException('File not found');

    if (file.publicId) {
      const resourceType: 'image' | 'video' = file.mimeType.startsWith('video/') ? 'video' : 'image';
      await this.cloudinary.deleteImage(file.publicId, resourceType);
    }

    return this.prisma.mediaFile.delete({ where: { id: fileId } });
  }

  /**
   * Get paginated AI-generated media for an org
   */
  async getAIGeneratedMedia(
    organizationId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    return this.prisma.mediaFile.findMany({
      where: { organizationId, isAIGenerated: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
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
        `File too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
      );
    }
  }
}
