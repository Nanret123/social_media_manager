import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';

@Injectable()
export class FileUploadService {
  async uploadFile(
    file: Express.Multer.File,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: 'uploads' }, // Change 'uploads' to your preferred Cloudinary folder
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          },
        )
        .end(file.buffer);
    });
  }

  // Upload multiple files
  async uploadMultipleFiles(
    files: Express.Multer.File[],
  ): Promise<UploadApiResponse[]> {
    const uploadedFiles = [];

    for (const file of files) {
      try {
        const result = await this.uploadFile(file);
        uploadedFiles.push(result);
      } catch (error) {
        console.error(`Failed to upload file: ${file.originalname}`, error);
      }
    }

    return uploadedFiles;
  }

  // Delete a file
  async deleteFile(publicId: string): Promise<{ result: string }> {
    return cloudinary.uploader.destroy(publicId);
  }
}
