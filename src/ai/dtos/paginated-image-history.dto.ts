import { ApiProperty } from "@nestjs/swagger";

export class PaginatedImageHistory {
  @ApiProperty({ type: [Object] })
  data: any[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
