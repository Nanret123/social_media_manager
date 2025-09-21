import { Injectable } from '@nestjs/common';
import { TemplateContent, TemplateRenderResult, RenderTemplateOptions } from './template.types';
import { AIService } from '../ai/ai.service';

@Injectable()
export class TemplateEngine {
  constructor(private readonly aiService: AIService) {}

  async renderTemplate(
    templateContent: TemplateContent,
    options: RenderTemplateOptions
  ): Promise<TemplateRenderResult> {
    const { variables, optimizeForPlatform, tone, maxLength } = options;

    // Validate variables
    const validation = this.validateVariables(templateContent.variables, variables);
    if (!validation.isValid) {
      return {
        content: '',
        hashtags: [],
        variablesUsed: variables,
        isValid: false,
        validationErrors: validation.errors,
      };
    }

    // Render basic template with variable substitution
    let renderedContent = this.renderBasicTemplate(templateContent.caption, variables);
    let renderedHashtags = templateContent.hashtags 
      ? this.renderHashtags(templateContent.hashtags, variables)
      : [];

    // AI optimization if requested
    if (optimizeForPlatform) {
      const optimized = await this.optimizeWithAI(
        renderedContent,
        renderedHashtags,
        options.platform,
        tone
      );
      renderedContent = optimized.content;
      renderedHashtags = optimized.hashtags;
    }

    // Apply length constraints
    if (maxLength && renderedContent.length > maxLength) {
      renderedContent = this.truncateContent(renderedContent, maxLength);
    }

    return {
      content: renderedContent,
      hashtags: renderedHashtags,
      variablesUsed: variables,
      isValid: true,
    };
  }

  private renderBasicTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      return variables[variableName] !== undefined 
        ? String(variables[variableName]) 
        : match;
    });
  }

  private renderHashtags(hashtags: string[], variables: Record<string, any>): string[] {
    return hashtags.map(hashtag => {
      return hashtag.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
        if (variables[variableName] !== undefined) {
          const value = String(variables[variableName]);
          // Convert to hashtag format (remove spaces, special chars)
          return value
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[^a-z0-9]/g, '');
        }
        return match;
      });
    });
  }

  private validateVariables(
    expectedVariables: any[],
    providedVariables: Record<string, any>
  ): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];

    for (const expectedVar of expectedVariables) {
      if (expectedVar.required && providedVariables[expectedVar.name] === undefined) {
        errors.push(`Missing required variable: ${expectedVar.name}`);
      }

      if (providedVariables[expectedVar.name] !== undefined) {
        const validationError = this.validateVariableType(
          expectedVar,
          providedVariables[expectedVar.name]
        );
        if (validationError) {
          errors.push(validationError);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private validateVariableType(expectedVar: any, value: any): string | null {
    switch (expectedVar.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `Variable ${expectedVar.name} must be a string`;
        }
        break;
      case 'number':
        if (typeof value !== 'number') {
          return `Variable ${expectedVar.name} must be a number`;
        }
        break;
      case 'date':
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          return `Variable ${expectedVar.name} must be a valid date`;
        }
        break;
      case 'array':
        if (!Array.isArray(value)) {
          return `Variable ${expectedVar.name} must be an array`;
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `Variable ${expectedVar.name} must be a boolean`;
        }
        break;
    }

    if (expectedVar.options && !expectedVar.options.includes(value)) {
      return `Variable ${expectedVar.name} must be one of: ${expectedVar.options.join(', ')}`;
    }

    return null;
  }

  private async optimizeWithAI(
    content: string,
    hashtags: string[],
    platform?: string,
    tone?: string
  ): Promise<{ content: string; hashtags: string[] }> {
    try {
      const optimized = await this.aiService.optimizeContent(
        content,
        platform as any,
        tone
      );

      return {
        content: optimized.optimized,
        hashtags: hashtags, // Keep original hashtags or optimize them too
      };
    } catch (error) {
      // Fallback to original content if AI optimization fails
      return { content, hashtags };
    }
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;

    // Try to truncate at sentence boundary
    const lastSentenceEnd = content.lastIndexOf('.', maxLength - 3);
    if (lastSentenceEnd > maxLength * 0.7) {
      return content.substring(0, lastSentenceEnd + 1) + '..';
    }

    // Truncate at word boundary
    const lastSpace = content.lastIndexOf(' ', maxLength - 3);
    if (lastSpace > maxLength * 0.7) {
      return content.substring(0, lastSpace) + '...';
    }

    // Hard truncate
    return content.substring(0, maxLength - 3) + '...';
  }

  generateExampleVariables(templateContent: TemplateContent): Record<string, any> {
    const examples: Record<string, any> = {};

    for (const variable of templateContent.variables) {
      examples[variable.name] = this.generateExampleValue(variable);
    }

    return examples;
  }

  private generateExampleValue(variable: any): any {
    if (variable.defaultValue !== undefined) {
      return variable.defaultValue;
    }

    if (variable.options && variable.options.length > 0) {
      return variable.options[0];
    }

    switch (variable.type) {
      case 'string':
        return variable.name === 'product' ? 'Awesome Product' : 
               variable.name === 'offer' ? '20% Off' : 'Example Value';
      case 'number':
        return 42;
      case 'date':
        return new Date().toISOString().split('T')[0];
      case 'array':
        return ['Item 1', 'Item 2', 'Item 3'];
      case 'boolean':
        return true;
      default:
        return 'Example';
    }
  }
}