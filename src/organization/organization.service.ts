import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrganizationRole } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateOrganization } from './dtos/create-organization.dto';
import { UpdateOrganization } from './dtos/update-organization.dto';
import { UpdateMemberRole } from './dtos/organization-member.dto';

@Injectable()
export class OrganizationService {
  constructor(private prisma: PrismaService) {}

  async createOrganization(userId: string, createDto: CreateOrganization) {
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
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, role: true }
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
      where: { 
        userId,
        organization: { isActive: true }
      },
      include: {
        organization: {
          include: {
            members: {
              where: { role: OrganizationRole.OWNER },
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true, email: true }
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
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    // Transform the data to include an 'owner' field for convenience
    return memberships.map(membership => ({
      ...membership.organization,
      owner: this.getOwnerFromMembers(membership.organization.members),
      userRole: membership.role
    }));
  }

   async getOrganizationById(orgId: string, userId: string) {

    const organization = await this.prisma.organization.findFirst({
      where: { 
        id: orgId,
        isActive: true 
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true }
            },
            inviter: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          },
          orderBy: { joinedAt: 'asc' }
        },
        socialAccounts: {
          select: {
            id: true,
            platform: true,
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

    const userMembership = organization.members.find(m => m.userId === userId);
    const owner = this.getOwnerFromMembers(organization.members);
    
    return {
      ...organization,
      owner,
      userRole: userMembership?.role
    };
  }


  async updateOrganization(orgId: string, updateDto: UpdateOrganization) {
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
        members: {
          where: { role: OrganizationRole.OWNER },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true }
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

    return {
      ...organization,
      owner: this.getOwnerFromMembers(organization.members)
    };
  }

  async deleteOrganization(orgId: string) {

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

  async updateMemberRole(orgId: string, memberId: string, updateDto: UpdateMemberRole) {

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

    const updatedMember = await this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: updateDto.role },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true ,email: true }
        }
      }
    });

    return updatedMember;
  }

  async removeMember(orgId: string, memberId: string) {
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

  private getOwnerFromMembers(members: any[]) {
    return members.find(m => m.role === OrganizationRole.OWNER)?.user || null;
  }

}