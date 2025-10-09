import { Provider } from "@nestjs/common";
import { HuggingFaceService } from "../huggingface.provider";

export const HuggingFaceProvider: Provider = {
  provide: 'HUGGINGFACE_CLIENT',
  useClass: HuggingFaceService,
};