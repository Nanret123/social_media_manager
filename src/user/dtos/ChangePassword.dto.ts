import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength, MaxLength } from "class-validator";

export class ChangePassword {
  @ApiProperty({ example: 'OldPassword123' })
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @ApiProperty({ example: 'NewStrongPassword@123', minLength: 8, maxLength: 100 })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword: string;
}