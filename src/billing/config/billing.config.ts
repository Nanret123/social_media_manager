// src/billing/config/billing.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('billing', () => ({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  webhookPath: process.env.STRIPE_WEBHOOK_PATH || '/billing/webhook',
}));