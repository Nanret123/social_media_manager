import { Type } from "class-transformer";
import { IsOptional, IsNumber, Min, IsIn } from "class-validator";
import { PostAnalyticsSums } from "../analytics.types";

export class TopPostsQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsIn(['likes', 'comments', 'shares', 'impressions', 'clicks'])
  metric?: keyof PostAnalyticsSums = 'likes';
}