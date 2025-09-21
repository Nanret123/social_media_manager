export type TemplateCategory = 'marketing' | 'educational' | 'promotional' | 'engagement' | 'announcement';
export type TemplateStatus = 'draft' | 'published' | 'archived';

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'date' | 'array' | 'boolean';
  description: string;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // For predefined choices
}

export interface TemplateContent {
  caption: string;
  hashtags?: string[];
  cta?: string; // Call to action
  variables: TemplateVariable[];
  exampleValues?: Record<string, any>;
}

export interface CreateTemplateDto {
  name: string;
  description?: string;
  category: TemplateCategory;
  platform: string;
  content: TemplateContent;
  tags?: string[];
  isPublic?: boolean;
}

export interface UpdateTemplateDto extends Partial<CreateTemplateDto> {
  status?: TemplateStatus;
}

export interface RenderTemplateOptions {
  variables: Record<string, any>;
  optimizeForPlatform?: boolean;
  tone?: string;
  maxLength?: number;
}

export interface TemplateRenderResult {
  content: string;
  hashtags: string[];
  variablesUsed: Record<string, any>;
  isValid: boolean;
  validationErrors?: string[];
}

export interface TemplateSearchFilters {
  category?: TemplateCategory;
  platform?: string;
  tags?: string[];
  isPublic?: boolean;
  status?: TemplateStatus;
  search?: string;
}