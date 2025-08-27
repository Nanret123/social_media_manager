import { ApiProperty } from "@nestjs/swagger";
import { OrganizationRole } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpdateMemberRole {
  @ApiProperty({
    description: 'Role of the member within the organization',
    enum: OrganizationRole,
    example: OrganizationRole.ADMIN,
  })
  @IsEnum(OrganizationRole)
  role: OrganizationRole;
}