import { Injectable } from "@nestjs/common";
import OpenAI from "openai";

@Injectable()
export class OpenAiProvider {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async generateText(prompt: string) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a professional social media content creator. Return responses in JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    return response;
  }

  async createCompletion(params: { model: string; prompt: string; max_tokens?: number; temperature?: number }) {
  const completion = await this.openai.chat.completions.create({
    model: params.model,
    messages: [{ role: 'user', content: params.prompt }],
    max_tokens: params.max_tokens,
    temperature: params.temperature,
  });
  return completion;
}
}