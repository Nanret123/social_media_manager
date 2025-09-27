import { PartialType } from '@nestjs/mapped-types';
import { CreateBrandKitDto } from './create-brand-kit.dto';

export class UpdateBrandKitDto extends PartialType(CreateBrandKitDto) {}
