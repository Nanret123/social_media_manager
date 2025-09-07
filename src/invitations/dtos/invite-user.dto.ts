import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizationRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional } from 'class-validator';


export class InviteUser {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'newmember@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Role to assign to the invited user (default: MEMBER)',
    enum: OrganizationRole,
    example: OrganizationRole.MEMBER,
  })
  @IsEnum(OrganizationRole)
  @IsOptional()
  role?: OrganizationRole = OrganizationRole.MEMBER;
}
