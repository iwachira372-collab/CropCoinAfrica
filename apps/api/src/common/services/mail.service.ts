import { Injectable, Logger } from '@nestjs/common';

interface EmailOptions {
  to: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      // In development/test, log instead of sending
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `📧 [DEV MODE] Email would be sent to: ${options.to}`,
          `Subject: ${options.subject}`
        );
        return true;
      }

      // Production: Use SendGrid
      // TODO: Implement SendGrid integration when API key is available
      // const sgMail = require('@sendgrid/mail');
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      // await sgMail.send({...});

      this.logger.warn('SendGrid integration not yet configured');
      return false;
    } catch (error) {
      this.logger.error('Failed to send email:', error);
      return false;
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const verificationUrl = `${process.env.API_URL}/auth/verify-email?token=${token}`;
    return this.sendEmail({
      to: email,
      subject: 'Verify Your CropCoin Email',
      template: 'verification-email',
      data: {
        email,
        verificationUrl,
        expirationMinutes: 24 * 60,
      },
      html: `
        <h1>Welcome to CropCoin!</h1>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link expires in 24 hours.</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
    const resetUrl = `${process.env.API_URL}/auth/reset-password?token=${token}`;
    return this.sendEmail({
      to: email,
      subject: 'Reset Your CropCoin Password',
      template: 'password-reset-email',
      data: {
        email,
        resetUrl,
        expirationMinutes: 60,
      },
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  }

  async sendNotification(
    email: string,
    subject: string,
    content: string
  ): Promise<boolean> {
    return this.sendEmail({
      to: email,
      subject,
      html: content,
    });
  }
}
