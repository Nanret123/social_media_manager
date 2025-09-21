import { Global, Module } from "@nestjs/common";
import { PlatformsModule } from "src/platforms/platforms.module";
import { WorkerManager } from "./worker-manager";


@Global()
@Module({
  imports: [
    PlatformsModule
  ],
  providers: [WorkerManager],
  exports: [WorkerManager],
})
export class WorkerModule {}