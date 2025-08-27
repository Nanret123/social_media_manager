import { Injectable } from '@nestjs/common';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async createOrganization(userId: string, createDto: CreateOrganizationDto) {
    const { name, slug } = createDto;
    
    // Generate slug from name if not provided
    const finalSlug = slug || this.generateSlugFromName(name);
    
    // Check if slug is already taken
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: finalSlug }
    });
    
    if (existingOrg) {
      throw new BadRequestException('Organization slug already exists');
    }

    // Create organization and add owner as member
    const organization = await this.prisma.organization.create({
      data: {
        name,
        slug: finalSlug,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: OrganizationRole.OWNER
          }
        }
      },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        _count: {
          select: {
            members: true,
            socialAccounts: true,
            posts: true
          }
        }
      }
    });

    return organization;
  }

  async getOrganizationsByUser(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          include: {
            owner: {
              select: { id: true, name: true, email: true }
            },
            _count: {
              select: {
                members: true,
                socialAccounts: true,
                posts: true
              }
            }
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    return memberships.map(membership => ({
      ...membership.organization,
      userRole: membership.role
    }));
  }

  async getOrganizationById(orgId: string, userId: string) {
    // First check if user has access to this organization
    await this.checkUserAccess(orgId, userId);

    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            },
            inviter: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { joinedAt: 'asc' }
        },
        socialAccounts: {
          select: {
            id: true,
            platform: true,
            platformAccountId: true,
            username: true,
            isActive: true
          }
        },
        _count: {
          select: {
            posts: true,
            invitations: {
              where: { status: 'PENDING' }
            }
          }
        }
      }
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    // Get user's role in this organization
    const userMembership = organization.members.find(m => m.userId === userId);
    
    return {
      ...organization,
      userRole: userMembership?.role
    };
  }

  async updateOrganization(orgId: string, userId: string, updateDto: UpdateOrganizationDto) {
    // Check if user has admin access
    await this.checkUserAccess(orgId, userId, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);

    const { name, slug } = updateDto;

    // If slug is being updated, check if it's available
    if (slug) {
      const existingOrg = await this.prisma.organization.findFirst({
        where: { 
          slug,
          id: { not: orgId }
        }
      });
      
      if (existingOrg) {
        throw new BadRequestException('Organization slug already exists');
      }
    }

    const organization = await this.prisma.organization.update({
      where: { id: orgId },
      data: updateDto,
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: {
            members: true,
            socialAccounts: true,
            posts: true
          }
        }
      }
    });

    return organization;
  }

  async deleteOrganization(orgId: string, userId: string) {
    // Only owner can delete organization
    await this.checkUserAccess(orgId, userId, [OrganizationRole.OWNER]);

    const organization = await this.prisma.organization.update({
      where: { id: orgId },
      data: { 
        isActive: false, // <-- Soft delete by deactivating
        // Optional: You might also want to clear the slug to free it up
        // slug: `deleted-${orgId}-${organization.slug}` 
      },
    });
     // TODO: Add any other cleanup logic here, like:
    // - Canceling all scheduled posts for the org
    // - Disconnecting all social accounts (revoking tokens)

    return { message: 'Organization deleted successfully' };
  }

  async updateMemberRole(orgId: string, memberId: string, userId: string, updateDto: UpdateMemberRoleDto) {
    // Check if user has admin access
    await this.checkUserAccess(orgId, userId, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);

    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId },
      include: { user: true }
    });

    if (!member || member.organizationId !== orgId) {
      throw new NotFoundException('Member not found');
    }

    // Cannot change owner role
    if (member.role === OrganizationRole.OWNER) {
      throw new BadRequestException('Cannot change owner role');
    }

    // Only owner can promote to admin
    if (updateDto.role === OrganizationRole.ADMIN) {
      await this.checkUserAccess(orgId, userId, [OrganizationRole.OWNER]);
    }

    const updatedMember = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: updateDto.role },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return updatedMember;
  }

  async removeMember(orgId: string, memberId: string, userId: string) {
    // Check if user has admin access
    await this.checkUserAccess(orgId, userId, [OrganizationRole.OWNER, OrganizationRole.ADMIN]);

    const member = await this.prisma.organizationMember.findUnique({
      where: { id: memberId }
    });

    if (!member || member.organizationId !== orgId) {
      throw new NotFoundException('Member not found');
    }

    // Cannot remove owner
    if (member.role === OrganizationRole.OWNER) {
      throw new BadRequestException('Cannot remove organization owner');
    }

    await this.prisma.organizationMember.delete({
      where: { id: memberId }
    });

    return { message: 'Member removed successfully' };
  }

  async leaveOrganization(orgId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId
        }
      }
    });

    if (!member) {
      throw new NotFoundException('You are not a member of this organization');
    }

    // Owner cannot leave organization
    if (member.role === OrganizationRole.OWNER) {
      throw new BadRequestException('Owner cannot leave organization. Transfer ownership or delete the organization.');
    }

    await this.prisma.organizationMember.delete({
      where: { id: member.id }
    });

    return { message: 'Left organization successfully' };
  }

  // Helper methods
  private generateSlugFromName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  private async checkUserAccess(
    orgId: string, 
    userId: string, 
    requiredRoles?: OrganizationRole[]
  ) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId
        }
      }
    });

    if (!membership) {
      throw new ForbiddenException('Access denied: Not a member of this organization');
    }

    if (requiredRoles && !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Access denied: Insufficient permissions');
    }

    return membership;
  }

  async getUserRoleInOrganization(userId: string, organizationId: string): Promise<OrganizationRole | null> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId
        }
      }
    });

    return membership?.role || null;
  }
}