import { BadRequestException, Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { PrismaService } from 'src/prisma/prisma.service';
import { unlink } from 'fs/promises';


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

  async uploadFile(
    userId: string,
    file: Express.Multer.File,
  ) {
    const { path, originalname, mimetype, size, filename } = file;
    const uploaded = await this.uploadToCloudinary(path, filename, mimetype);

    return this.prisma.mediaFile.create({
      data: {
        userId,
        filename,
        originalName: originalname,
        mimeType: mimetype,
        size,
        url: uploaded.url,
        publicId: uploaded.publicId,
        thumbnailUrl: uploaded.thumbnailUrl,
        duration: uploaded.duration,
        processed: true,
      },
    });
  }

  async uploadMultipleFiles(
    userId: string,
    files: Express.Multer.File[],
  ) {
    const uploadedFiles = [];
    for (const file of files) {
      const media = await this.uploadFile(userId, file);
      uploadedFiles.push(media);
    }
    return uploadedFiles;
  }

  async deleteFile(mediaId: string) {
    const media = await this.prisma.mediaFile.findUnique({ where: { id: mediaId } });
    if (!media) throw new BadRequestException('Media not found');

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(media.publicId, {
      resource_type: media.mimeType.startsWith('video/') ? 'video' : 'image',
    });

    // Delete from DB
    return this.prisma.mediaFile.delete({ where: { id: mediaId } });
  }
}
