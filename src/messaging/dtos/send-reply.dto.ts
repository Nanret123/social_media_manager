import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty, IsString } from 'class-validator';

export class SendReplyDto {
  @ApiProperty({ description: 'Conversation ID to reply to' })
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;

  @ApiProperty({ description: 'Reply message content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ description: 'User ID of the sender' })
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
