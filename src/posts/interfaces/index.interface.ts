export interface PostMetadata {
  options?: Record<string, any>;
  [key: string]: any;
}

export interface FacebookApiResponse {
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
}

export interface InstagramApiResponse {
  like_count?: number;
  comments_count?: number;
}
