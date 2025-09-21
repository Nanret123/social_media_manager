import { Injectable } from "@nestjs/common";
import OpenAI from "openai";

@Injectable()
export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async createCompletion(options: {
    model: string;
    prompt: string;
    max_tokens: number;
    temperature: number;
  }) {
    return this.openai.completions.create({
      model: options.model,
      prompt: options.prompt,
      max_tokens: options.max_tokens,
      temperature: options.temperature,
    });
  }
}