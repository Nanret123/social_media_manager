import { Type } from "class-transformer";
import { IsDate, IsNotEmpty } from "class-validator";

// export class SchedulePostDto {
//   @IsDate()
//   @Type(() => Date) // ensures string -> Date transformation
//   @IsNotEmpty()
//   scheduledAt: Date;
// }