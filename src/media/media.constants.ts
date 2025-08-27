export const ALLOWED_MIME_TYPES = [
  'image/jpeg',    // .jpg, .jpeg
  'image/png',     // .png
  'image/gif',     // .gif
  'image/webp',    // .webp
  'image/svg+xml', // .svg
  'video/mp4',     // .mp4
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  // Add other supported types as needed
];

// 100 Megabytes in bytes
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

// You can also export a helper function for the error message
export function getMaxFileSizeMB(): string {
  return (MAX_FILE_SIZE / 1024 / 1024).toString();
}