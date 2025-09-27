// src/billing/dto/create-checkout-session.dto.ts
import { IsEnum, IsUrl, IsOptional } from 'class-validator';
import { PlanTier, BillingInterval } from '@prisma/client';

export class CreateCheckoutSessionDto {
  @IsEnum(PlanTier)
  planTier: PlanTier;

  @IsEnum(BillingInterval)
  billingInterval: BillingInterval;

  @IsUrl()
  successUrl: string;

  @IsUrl()
  cancelUrl: string;

  @IsOptional()
  couponCode?: string;
}