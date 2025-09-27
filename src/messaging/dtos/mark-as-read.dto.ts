import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class MarkAsReadDto {
  @ApiProperty({ description: 'Conversation ID' })
  @IsUUID()
  @IsNotEmpty()
  conversationId: string;
}
