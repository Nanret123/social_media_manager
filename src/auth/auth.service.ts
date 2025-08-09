import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use');

    const saltRounds = this.config.bcryptSaltRounds;
    const hashed = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashed,
        firstName: dto.firstName || null,
        lastName: dto.lastName || null,
        emailVerified: false,
      },
    });

    // Optionally: create profile, send verification email, etc.
    await this.prisma.userProfile.create({
      data: { userId: user.id },
    });

    // TODO: send verification email token via EmailService

    return { id: user.id, email: user.email };
  }
}
