import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class MarkReadDto {
  @ApiProperty({ description: 'Notification ID to mark as read' })
  @IsString()
  notificationId: string;
}