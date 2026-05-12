import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/services/prisma.service';
import { MailService } from '../../common/services/mail.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { VerifyEmailDto } from './dto/index';
import { ForgotPasswordDto } from './dto/index';
import { ResetPasswordDto } from './dto/index';
import { ResendVerificationEmailDto } from './dto/index';
import { generateRandomToken } from '../../common/utils/token.util';
import * as crypto from 'crypto';

interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  sessionId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async signup(createUserDto: CreateUserDto) {
    const { email, password, phone } = createUserDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Hash password
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(password, bcryptRounds);

    try {
      // Create user with Farmer role by default
      const farmerRole = await this.prisma.role.findUnique({
        where: { name: 'Farmer' },
      });

      if (!farmerRole) {
        throw new Error('Farmer role not found in database');
      }

      const newUser = await this.prisma.user.create({
        data: {
          email,
          phone,
          passwordHash: hashedPassword,
          status: 'active',
          userRoles: {
            create: [
              {
                roleId: farmerRole.id,
              },
            ],
          },
        },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      // Generate email verification token
      const verificationToken = generateRandomToken();
      const hashedToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');

      await this.prisma.emailVerificationToken.create({
        data: {
          userId: newUser.id,
          token: hashedToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      // Send verification email
      await this.mailService.sendVerificationEmail(email, verificationToken);

      const { passwordHash, ...userWithoutPassword } = newUser;

      return {
        message: 'User registered successfully. Please verify your email.',
        user: {
          ...userWithoutPassword,
          roles: newUser.userRoles.map((ur) => ur.role.name),
        },
      };
    } catch (error) {
      this.logger.error('Signup error:', error);
      throw error;
    }
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in'
      );
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('User account is not active');
    }

    // Generate tokens
    const roles = user.userRoles.map((ur) => ur.role.name);
    const sessionId = crypto.randomUUID();

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        roles,
        sessionId,
      } as JwtPayload,
      {
        expiresIn: process.env.JWT_EXPIRATION || '15m',
        algorithm: 'HS256',
      }
    );

    // Generate refresh token
    const refreshToken = generateRandomToken();
    const hashedRefreshToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashedRefreshToken,
        expiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ), // 7 days
        deviceFingerprint: this.generateDeviceFingerprint(),
      },
    });

    const { passwordHash, userRoles, ...userWithoutPassword } = user;

    return {
      accessToken,
      refreshToken,
      user: {
        ...userWithoutPassword,
        roles,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenRecord.revokedAt) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = tokenRecord.user;
    const roles = user.userRoles.map((ur) => ur.role.name);
    const sessionId = crypto.randomUUID();

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const newAccessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        roles,
        sessionId,
      } as JwtPayload,
      {
        expiresIn: process.env.JWT_EXPIRATION || '15m',
        algorithm: 'HS256',
      }
    );

    const newRefreshToken = generateRandomToken();
    const hashedNewRefreshToken = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex');

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: hashedNewRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deviceFingerprint: this.generateDeviceFingerprint(),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(userId: string) {
    // Revoke all refresh tokens for this user
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { message: 'Logged out successfully' };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { token } = verifyEmailDto;

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const tokenRecord = await this.prisma.emailVerificationToken.findUnique({
      where: { token: hashedToken },
      include: {
        user: true,
      },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid verification token');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new BadRequestException('Verification token expired');
    }

    if (tokenRecord.verifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    // Mark email as verified
    await this.prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { emailVerified: true },
    });

    // Mark token as used
    await this.prisma.emailVerificationToken.update({
      where: { id: tokenRecord.id },
      data: { verifiedAt: new Date() },
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerificationEmail(
    resendDto: ResendVerificationEmailDto
  ) {
    const { email } = resendDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Invalidate existing tokens
    await this.prisma.emailVerificationToken.deleteMany({
      where: {
        userId: user.id,
        verifiedAt: null,
      },
    });

    // Generate new token
    const verificationToken = generateRandomToken();
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Send email
    await this.mailService.sendVerificationEmail(email, verificationToken);

    return { message: 'Verification email sent' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists
      return { message: 'If email exists, password reset link has been sent' };
    }

    // Invalidate existing reset tokens
    await this.prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    // Generate reset token
    const resetToken = generateRandomToken();
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // Send email
    await this.mailService.sendPasswordResetEmail(email, resetToken);

    return { message: 'If email exists, password reset link has been sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const tokenRecord = await this.prisma.passwordResetToken.findUnique({
      where: { token: hashedToken },
      include: {
        user: true,
      },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid reset token');
    }

    if (new Date() > tokenRecord.expiresAt) {
      throw new BadRequestException('Reset token expired');
    }

    if (tokenRecord.usedAt) {
      throw new BadRequestException('Reset token already used');
    }

    // Hash new password
    const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    const hashedPassword = await bcrypt.hash(newPassword, bcryptRounds);

    // Update password
    await this.prisma.user.update({
      where: { id: tokenRecord.userId },
      data: { passwordHash: hashedPassword },
    });

    // Mark token as used
    await this.prisma.passwordResetToken.update({
      where: { id: tokenRecord.id },
      data: { usedAt: new Date() },
    });

    return { message: 'Password reset successfully' };
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    return {
      userId: user.id,
      email: user.email,
      roles: user.userRoles.map((ur) => ur.role.name),
    };
  }

  private generateDeviceFingerprint(): string {
    // In a real application, this would use request headers
    // For now, generate a random fingerprint
    return crypto.randomUUID();
  }
}
