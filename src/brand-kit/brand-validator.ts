import { Injectable } from '@nestjs/common';
import { BrandValidationResult, BrandVoiceAnalysis } from './brand-kit.types';
import { BrandKit, BrandColor, BrandVoice } from '@prisma/client';

@Injectable()
export class BrandValidator {
  async validateBrandKit(brandKit: any): Promise<BrandValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Validate colors
    if (brandKit.colors) {
      this.validateColors(brandKit.colors, issues, suggestions);
    }

    // Validate fonts
    if (brandKit.fonts) {
      this.validateFonts(brandKit.fonts, issues, suggestions);
    }

    // Validate brand voice
    if (brandKit.brandVoice) {
      this.validateBrandVoice(brandKit.brandVoice, issues);
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  async validateContent(content: string, brandKit: BrandKit & { colors: BrandColor[] }): Promise<BrandValidationResult> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for banned words
    if (brandKit.bannedWords && brandKit.bannedWords.length > 0) {
      this.checkBannedWords(content, brandKit.bannedWords, issues);
    }

    // Check for brand words usage
    if (brandKit.brandWords && brandKit.brandWords.length > 0) {
      this.checkBrandWords(content, brandKit.brandWords, suggestions);
    }

    // Analyze tone against brand voice
    if (brandKit.brandVoice) {
      await this.analyzeTone(content, brandKit.brandVoice, issues, suggestions);
    }

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
    };
  }

  private validateColors(colors: any[], issues: string[], suggestions: string[]) {
    const colorTypes = new Set();
    const colorValues = new Set();

    for (const color of colors) {
      // Check for duplicate types
      if (colorTypes.has(color.type)) {
        issues.push(`Duplicate color type: ${color.type}`);
      }
      colorTypes.add(color.type);

      // Check for duplicate values
      if (colorValues.has(color.value)) {
        issues.push(`Duplicate color value: ${color.value}`);
      }
      colorValues.add(color.value);

      // Validate hex format
      if (!this.isValidHexColor(color.value)) {
        issues.push(`Invalid hex color: ${color.value}`);
      }
    }

    // Check for required color types
    if (!colorTypes.has('PRIMARY')) {
      suggestions.push('Add a primary brand color');
    }
    if (!colorTypes.has('SECONDARY')) {
      suggestions.push('Add a secondary brand color');
    }
  }

  private validateFonts(fonts: any[], issues: string[], suggestions: string[]) {
    const fontCategories = new Set();

    for (const font of fonts) {
      if (fontCategories.has(font.category)) {
        issues.push(`Duplicate font category: ${font.category}`);
      }
      fontCategories.add(font.category);

      if (font.isCustom && !font.customUrl) {
        issues.push(`Custom font ${font.name} requires a customUrl`);
      }
    }

    if (!fontCategories.has('HEADING')) {
      suggestions.push('Add a heading font');
    }
    if (!fontCategories.has('BODY')) {
      suggestions.push('Add a body font');
    }
  }

  private validateBrandVoice(voice: string, issues: string[]) {
    const validVoices = Object.values(BrandVoice);
    if (!validVoices.includes(voice as BrandVoice)) {
      issues.push(`Invalid brand voice: ${voice}. Valid options: ${validVoices.join(', ')}`);
    }
  }

  private checkBannedWords(content: string, bannedWords: string[], issues: string[]) {
    const contentLower = content.toLowerCase();
    
    for (const word of bannedWords) {
      if (contentLower.includes(word.toLowerCase())) {
        issues.push(`Content contains banned word: "${word}"`);
      }
    }
  }

  private checkBrandWords(content: string, brandWords: string[], suggestions: string[]) {
    const contentLower = content.toLowerCase();
    let usedCount = 0;

    for (const word of brandWords) {
      if (contentLower.includes(word.toLowerCase())) {
        usedCount++;
      }
    }

    if (usedCount === 0) {
      suggestions.push('Consider using some of your brand keywords');
    } else if (usedCount < brandWords.length / 2) {
      suggestions.push('You could use more of your brand keywords');
    }
  }

  private async analyzeTone(
    content: string, 
    expectedVoice: BrandVoice, 
    issues: string[], 
    suggestions: string[]
  ): Promise<void> {
    // This would integrate with an AI service for tone analysis
    // For now, we'll use a simple implementation
    const analysis = this.simpleToneAnalysis(content);
    
    if (analysis.tone !== expectedVoice) {
      issues.push(`Content tone (${analysis.tone}) doesn't match brand voice (${expectedVoice})`);
      suggestions.push(`Try making the content more ${expectedVoice.toLowerCase()}`);
    }
  }

  private simpleToneAnalysis(content: string): BrandVoiceAnalysis {
    // Simple heuristic-based tone analysis
    // In production, this would use an AI service
    const words = content.toLowerCase().split(/\s+/);
    
    const professionalWords = ['professional', 'business', 'enterprise', 'solution'];
    const casualWords = ['hey', 'awesome', 'cool', 'fun'];
    const wittyWords = ['pun', 'joke', 'humor', 'clever'];
    
    let professionalScore = 0;
    let casualScore = 0;
    let wittyScore = 0;

    for (const word of words) {
      if (professionalWords.some(p => word.includes(p))) professionalScore++;
      if (casualWords.some(c => word.includes(c))) casualScore++;
      if (wittyWords.some(w => word.includes(w))) wittyScore++;
    }

    const scores = { professionalScore, casualScore, wittyScore };
    const maxScore = Math.max(...Object.values(scores));
    
    let tone = BrandVoice.PROFESSIONAL;
    if (maxScore === casualScore) tone = BrandVoice.CASUAL;
    if (maxScore === wittyScore) tone = BrandVoice.WITTY;

    return {
      tone,
      confidence: maxScore / words.length,
      suggestions: []
    };
  }

  private isValidHexColor(color: string): boolean {
    return /^#([0-9A-F]{3}){1,2}$/i.test(color);
  }
}