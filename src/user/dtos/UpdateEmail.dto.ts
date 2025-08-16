import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class UpdateEmail {
  @ApiProperty({ example: 'newemail@example.com' })
  @IsEmail()
  newEmail: string;

  @ApiProperty({ example: 'CurrentPassword123' })
  @IsString()
  @MinLength(1)
  password: string;
}