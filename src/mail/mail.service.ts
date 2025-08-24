import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private readonly mailerService: MailerService) {}

  async sendVerificationEmail(email: string, token: string) {
    const verificationUrl = `${process.env.APP_URL}/auth/verify-email?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Verify your Rooli account',
      template: './verify-email', // 👈 refers to templates/verify-email.hbs
      context: {
        verificationUrl,
      },
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    await this.mailerService.sendMail({
      to: email,
      subject: 'Reset your Rooli password',
      template: './reset-password', // 👈 refers to templates/reset-password.hbs
      context: {
        resetUrl,
      },
    });
  }
}

