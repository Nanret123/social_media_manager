import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CloudinaryService } from './cloudinary.service';
import { Cron, CronExpression } from '@nestjs/schedule';


@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Get media file by ID (optionally scoped by organization)
   */
  async getFileById(
    fileId: string,
    organizationId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx || this.prisma;
    const where: Prisma.MediaFileWhereInput = { id: fileId };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    const file = await client.mediaFile.findFirst({ where });
    if (!file) throw new NotFoundException('Media file not found');

    return file;
  }

  /**
   * Upload single file to Cloudinary + DB
   */
  async uploadFile(
    userId: string,
    organizationId: string,
    file: Express.Multer.File,
    tx?: Prisma.TransactionClient,
  ) {
    this.validateFile(file);

    const uploaded = await this.safeUpload(file);
    const client = tx || this.prisma;

    return client.mediaFile.create({
      data: {
        userId,
        organizationId,
        filename: this.generateFilename(file.originalname),
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        thumbnailUrl: uploaded.thumbnail_url,
        duration: uploaded.duration,
        metadata: {
          width: uploaded.width,
          height: uploaded.height,
          format: uploaded.format,
        },
      },
    });
  }

  /**
   * Upload multiple files efficiently
   */
  async uploadMultipleFiles(
    files: Express.Multer.File[],
    userId: string,
    organizationId: string,
  ) {
    // validate first to fail fast
    files.forEach((f) => this.validateFile(f));

    const uploads = await Promise.all(files.map((f) => this.safeUpload(f)));

    // Use createMany for DB efficiency (no need for relations/return values)
    await this.prisma.mediaFile.createMany({
      data: uploads.map((uploaded, idx) => ({
        userId,
        organizationId,
        filename: this.generateFilename(files[idx].originalname),
        originalName: files[idx].originalname,
        mimeType: files[idx].mimetype,
        size: files[idx].size,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        thumbnailUrl: uploaded.thumbnail_url,
        duration: uploaded.duration,
      })),
    });

    // Fetch and return inserted records (optional)
    return this.prisma.mediaFile.findMany({
      where: { organizationId, userId },
      orderBy: { createdAt: 'desc' },
      take: files.length,
    });
  }

  /**
   * Save already-uploaded/generated media
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
    aiGenerationContext?: any;
  }) {
    const {
      userId,
      organizationId,
      url,
      publicId,
      filename,
      originalName,
      mimeType,
      size,
      aiGenerationId,
      aiGenerationContext,
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
      const resourceType: 'image' | 'video' = file.mimeType.startsWith('video/')
        ? 'video'
        : 'image';

      try {
        await this.cloudinary.deleteImage(file.publicId, resourceType);
      } catch (err) {
        this.logger.error(
          `Failed to delete Cloudinary resource: ${file.publicId}`,
          err.stack,
        );
      }
    }

    return this.prisma.mediaFile.delete({ where: { id: fileId } });
  }

  /**
   * Paginated AI-generated media
   */
  async getAIGeneratedMedia(organizationId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    return this.prisma.mediaFile.findMany({
      where: { organizationId, isAIGenerated: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
  }

  /**
   * Cron job: cleanup expired files
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredFiles() {
    const now = new Date();
    const expiredFiles = await this.prisma.mediaFile.findMany({
      where: { expiresAt: { lte: now } },
    });

    this.logger.log(`Found ${expiredFiles.length} expired files`);

    for (const file of expiredFiles) {
      try {
        await this.deleteFile(file.id);
        this.logger.log(`Deleted expired file: ${file.id}`);
      } catch (err) {
        this.logger.error(`Failed to delete file ${file.id}`, err.stack);
      }
    }
  }


  // ------------------------
  // Helpers
  // ------------------------

  private generateFilename(originalName: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop();
    return `file_${timestamp}_${randomString}.${extension}`;
  }

  private validateFile(file: Express.Multer.File) {
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed`,
      );
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File too large. Max size is ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }
  }

  /**
   * Safe Cloudinary upload with retry (resiliency)
   */
  private async safeUpload(file: Express.Multer.File, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.cloudinary.uploadFile(file);
      } catch (err) {
        this.logger.warn(
          `Upload failed for ${file.originalname}, attempt ${i + 1}/${retries}`,
        );
        if (i === retries - 1) throw err;
      }
    }
  }
}
