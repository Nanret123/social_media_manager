import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganization } from './create-organization.dto';

export class UpdateOrganization extends PartialType(CreateOrganization) {}