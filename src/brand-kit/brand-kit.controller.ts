import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BrandKitService } from './brand-kit.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  CreateBrandKitDto,
  UpdateBrandKitDto,
} from './dtos/create-brand-kit.dto';

@ApiTags('Brand Kit')
@Controller('brand-kit')
export class BrandKitController {
  constructor(private readonly brandKitService: BrandKitService) {}

  @Post(':organizationId')
  @ApiOperation({ summary: 'Create a new brand kit' })
  async create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateBrandKitDto,
  ) {
    return this.brandKitService.create(organizationId, dto);
  }

  @Get(':organizationId')
  @ApiOperation({ summary: 'Get all brand kits for an organization' })
  async findByOrganization(
    @Param('organizationId') organizationId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    return this.brandKitService.findByOrganization(
      organizationId,
      includeInactive,
    );
  }

  @Get(':organizationId/active')
  @ApiOperation({ summary: 'Get the active brand kit for an organization' })
  async getActive(@Param('organizationId') organizationId: string) {
    return this.brandKitService.getActiveBrandKit(organizationId);
  }

  @Patch(':organizationId/:id')
  @ApiOperation({ summary: 'Update a brand kit' })
  async update(
    @Param('id') id: string,
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateBrandKitDto,
  ) {
    return this.brandKitService.update(id, organizationId, dto);
  }

  @Patch(':organizationId/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate a brand kit' })
  async deactivate(
    @Param('id') id: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.brandKitService.deactivate(id, organizationId);
  }

  @Patch(':organizationId/:id/activate')
  @ApiOperation({ summary: 'Activate a brand kit' })
  async activate(
    @Param('id') id: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.brandKitService.activate(id, organizationId);
  }
}
