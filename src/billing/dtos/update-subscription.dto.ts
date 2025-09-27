// src/billing/dto/update-subscription.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCheckoutSessionDto } from './create-checkout-session.dto';

export class UpdateSubscriptionDto extends PartialType(CreateCheckoutSessionDto) {}