import { ApiPropertyOptional } from "@nestjs/swagger";
import { PlanTier, PlanStatus } from "@prisma/client";
import { IsOptional, IsString, IsBoolean, IsEnum} from "class-validator";
import { PaginationDto } from "src/common/dtos/pagination.dto";

export class GetAllOrganizationsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by organization name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: PlanTier, description: 'Filter by plan tier' })
  @IsOptional()
  @IsEnum(PlanTier)
  planTier?: PlanTier;

  @ApiPropertyOptional({ enum: PlanStatus, description: 'Filter by plan status' })
  @IsOptional()
  @IsEnum(PlanStatus)
  planStatus?: PlanStatus;

}