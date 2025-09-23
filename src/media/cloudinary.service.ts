import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadFile(file: Express.Multer.File, options: any = {}) {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader.upload(file.path, options, (err, res) => {
        if (err) return reject(new InternalServerErrorException(err.message));
        resolve(res);
      });
    });
  }

  async uploadBuffer(buffer: Buffer, options: any = {}) {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(options, (err, res) => {
        if (err) return reject(new InternalServerErrorException(err.message));
        resolve(res);
      });
      Readable.from(buffer).pipe(stream);
    });
  }

  /** Fetch image at remote URL into Cloudinary (used for Replicate output) */
  async uploadFromUrl(remoteUrl: string, publicId: string, options: any = {}) {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader.upload(
        remoteUrl,
        { public_id: publicId, resource_type: 'image', folder: 'rooli', ...options },
        (err, res) => {
          if (err) return reject(new InternalServerErrorException(err.message));
          resolve(res);
        },
      );
    });
  }

  async deleteImage(publicId: string, resourceType: 'image' | 'video' = 'image') {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, { resource_type: resourceType }, (err, res) => {
        if (err) return reject(new InternalServerErrorException(err.message));
        resolve(res);
      });
    });
  }

  async rename(fromId: string, toId: string) {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader.rename(fromId, toId, { overwrite: true }, (err, res) => {
        if (err) return reject(new InternalServerErrorException(err.message));
        resolve(res);
      });
    });
  }

  async listFolder(prefix: string) {
    const res = await cloudinary.api.resources({ type: 'upload', prefix });
    return res.resources || [];
  }
}
