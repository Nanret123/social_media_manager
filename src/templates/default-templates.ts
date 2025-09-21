import { CreateTemplateDto } from './template.types';

export const DEFAULT_SYSTEM_TEMPLATES: CreateTemplateDto[] = [
  {
    name: 'Product Launch Announcement',
    description: 'Template for announcing new product launches',
    category: 'announcement',
    platform: 'instagram',
    isPublic: true,
    tags: ['product', 'launch', 'announcement'],
    content: {
      caption: `🎉 Exciting News! Our new {{product}} is here! 🚀

{{description}}

✨ Key Features:
{{features}}

💥 Special Launch Offer: {{offer}}

Get yours now! 👇 {{cta}}`,
      hashtags: ['#productlaunch', '#newproduct', '#{{product}}', '#innovation'],
      cta: 'Link in bio!',
      variables: [
        { name: 'product', type: 'string', description: 'Product name', required: true },
        { name: 'description', type: 'string', description: 'Product description', required: true },
        { name: 'features', type: 'array', description: 'List of key features', required: true },
        { name: 'offer', type: 'string', description: 'Launch offer or discount', required: false },
        { name: 'cta', type: 'string', description: 'Call to action', required: false, defaultValue: 'Shop now' },
      ],
      exampleValues: {
        product: 'Awesome Product Pro',
        description: 'The most amazing product you will ever use',
        features: ['Feature 1', 'Feature 2', 'Feature 3'],
        offer: '20% off for first 100 customers',
        cta: 'Shop now'
      }
    }
  },
  {
    name: 'Educational Tip',
    description: 'Share valuable tips and insights with your audience',
    category: 'educational',
    platform: 'linkedin',
    isPublic: true,
    tags: ['education', 'tips', 'value'],
    content: {
      caption: `💡 {{tipTitle}}

{{tipContent}}

Why this matters: {{whyMatters}}

Pro tip: {{proTip}}

What's your experience with this? Share in comments! 👇`,
      hashtags: ['#{{industry}}', '#careertips', '#professionaldevelopment', '#learning'],
      variables: [
        { name: 'tipTitle', type: 'string', description: 'Title of the tip', required: true },
        { name: 'tipContent', type: 'string', description: 'Detailed tip content', required: true },
        { name: 'whyMatters', type: 'string', description: 'Why this tip is important', required: true },
        { name: 'proTip', type: 'string', description: 'Additional pro tip', required: false },
        { name: 'industry', type: 'string', description: 'Industry or topic', required: true },
      ]
    }
  }
  // Add more default templates...
];