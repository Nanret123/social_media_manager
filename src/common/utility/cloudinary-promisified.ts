import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

export function uploadBufferToCloudinary(buffer: Buffer, opts: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(opts, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}