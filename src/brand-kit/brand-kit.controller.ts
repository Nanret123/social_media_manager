import { Controller } from '@nestjs/common';
import { BrandKitService } from './brand-kit.service';

import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { BrandKitService } from './brand-kit.service';
import { CreateBrandKitDto, UpdateBrandKitDto } from './brand-kit.types';

@Controller('brand-kit')
export class BrandKitController {
  constructor(private readonly brandKitService: BrandKitService) {}

  @Post()
  async createBrandKit(
    @Param('organizationId') organizationId: string,
    @Body() createDto: CreateBrandKitDto
  ) {
    return this.brandKitService.createBrandKit(organizationId, createDto);
  }

  @Get()
  async getBrandKit(@Param('organizationId') organizationId: string) {
    return this.brandKitService.getBrandKit(organizationId);
  }

  @Put()
  async updateBrandKit(
    @Param('organizationId') organizationId: string,
    @Body() updateDto: UpdateBrandKitDto
  ) {
    return this.brandKitService.updateBrandKit(organizationId, updateDto);
  }

  @Delete()
  async deleteBrandKit(@Param('organizationId') organizationId: string) {
    return this.brandKitService.deleteBrandKit(organizationId);
  }

  @Post('validate-content')
  async validateContent(
    @Param('organizationId') organizationId: string,
    @Body('content') content: string
  ) {
    return this.brandKitService.validateContentAgainstBrand(organizationId, content);
  }

  @Get('ai-format')
  async getBrandKitForAI(@Param('organizationId') organizationId: string) {
    return this.brandKitService.getBrandKitForAI(organizationId);
  }

  @Get('usage')
  async getBrandUsage(@Param('organizationId') organizationId: string) {
    return this.brandKitService.getBrandUsage(organizationId);
  }
}