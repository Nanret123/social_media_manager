import { PartialType } from '@nestjs/mapped-types';
import { CreateSocialAccountDto } from './create-account.dto';


export class UpdateSocialAccountDto extends PartialType(CreateSocialAccountDto) {}