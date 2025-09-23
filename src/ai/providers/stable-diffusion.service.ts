import { Injectable } from '@nestjs/common';
import Replicate from 'replicate';

@Injectable()
export class StableDiffusionProvider {
  private replicate: Replicate;

  constructor() {
    this.replicate = new Replicate({
      auth: process.env.REPLICATE_API_KEY,
    });
  }

  async generateImage(options: {
  prompt: string;
  style: string;
  aspectRatio: string;
  negative_prompt?: string;
  steps?: number;
  cfg_scale?: number;
}) {
  const modelId =
    'stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4';

  const output = await this.replicate.run(modelId, {
    input: {
      prompt: options.prompt,
      negative_prompt: options.negative_prompt,
      num_inference_steps: options.steps,
      guidance_scale: options.cfg_scale,
      aspect_ratio: options.aspectRatio,
    },
  });

  return {
    imageUrl: output[0],
    revisedPrompt: options.prompt,
    model: modelId,
  };
}
}