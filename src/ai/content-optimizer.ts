import { Injectable, Logger } from '@nestjs/common';
import { ContentOptimization, Platform } from './ai.types';
import { OpenAIService } from './providers/openai.service';

@Injectable()
export class ContentOptimizer {
  private readonly logger = new Logger(ContentOptimizer.name);

  constructor(private readonly openAIService: OpenAIService) {}

  async optimizeContent(
    content: string, 
    platform: Platform,
    targetAudience?: string
  ): Promise<ContentOptimization> {
    try {
      const optimizationPrompt = this.buildOptimizationPrompt(content, platform, targetAudience);
      
      const response = await this.openAIService.createCompletion({
        model: 'gpt-4',
        prompt: optimizationPrompt,
        max_tokens: 500,
        temperature: 0.7,
      });

      const parsedResponse = this.parseOptimizationResponse(response.choices[0].text);

      return {
        original: content,
        optimized: parsedResponse.optimized,
        improvements: parsedResponse.improvements,
        score: parsedResponse.score,
      };

    } catch (error) {
      this.logger.error('Content optimization failed:', error);
      throw new Error(`Optimization failed: ${error.message}`);
    }
  }

  private buildOptimizationPrompt(
    content: string, 
    platform: Platform,
    targetAudience?: string
  ): string {
    const platformTips = {
      instagram: 'Focus on visual storytelling, use emojis, create engagement hooks',
      facebook: 'Encourage discussions, ask questions, community-focused',
      twitter: 'Be concise, use threading, incorporate trends',
      linkedin: 'Professional tone, value-driven, industry insights',
    };

    let prompt = `Optimize this content for ${platform}:\n"${content}"\n\n`;
    prompt += `Platform guidelines: ${platformTips[platform]}\n`;
    
    if (targetAudience) {
      prompt += `Target audience: ${targetAudience}\n`;
    }

    prompt += `Provide:\n1. Optimized version\n2. List of improvements (bullet points)\n3. Quality score 1-10\n`;
    prompt += `Focus on: engagement, clarity, and platform best practices.`;

    return prompt;
  }

  private parseOptimizationResponse(response: string): {
    optimized: string;
    improvements: string[];
    score: number;
  } {
    const lines = response.split('\n');
    let optimized = '';
    let improvements: string[] = [];
    let score = 7;

    let currentSection = '';

    for (const line of lines) {
      if (line.toLowerCase().includes('optimized version')) {
        currentSection = 'optimized';
        continue;
      }
      
      if (line.toLowerCase().includes('improvements')) {
        currentSection = 'improvements';
        continue;
      }
      
      if (line.toLowerCase().includes('quality score')) {
        currentSection = 'score';
        const scoreMatch = line.match(/\d+/);
        if (scoreMatch) score = parseInt(scoreMatch[0]);
        continue;
      }

      if (currentSection === 'optimized' && line.trim()) {
        optimized += line + '\n';
      }
      
      if (currentSection === 'improvements' && line.trim() && line.startsWith('-')) {
        improvements.push(line.replace('-', '').trim());
      }
    }

    return {
      optimized: optimized.trim(),
      improvements,
      score: Math.min(10, Math.max(1, score)),
    };
  }

  async analyzeEngagementPotential(content: string, platform: Platform): Promise<{
    engagementScore: number;
    predictedMetrics: { likes: number; comments: number; shares: number };
    recommendations: string[];
  }> {
    const analysisPrompt = `Analyze engagement potential for ${platform} content:
                          "${content}"
                          
                          Provide:
                          1. Engagement score (1-10)
                          2. Predicted metrics (likes, comments, shares)
                          3. 3 recommendations to improve engagement`;

    const response = await this.openAIService.createCompletion({
      model: 'gpt-4',
      prompt: analysisPrompt,
      max_tokens: 300,
      temperature: 0.5,
    });

    return this.parseEngagementAnalysis(response.choices[0].text);
  }

  private parseEngagementAnalysis(response: string): any {
    // Implementation for parsing engagement analysis
    // This would extract scores, metrics, and recommendations
    return {
      engagementScore: 7,
      predictedMetrics: { likes: 150, comments: 20, shares: 5 },
      recommendations: ['Add a question to encourage comments', 'Use more emotive language', 'Include a clear call-to-action']
    };
  }
}