import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  token: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter, and one number',
  })
  newPassword: string;
}

export class ResendVerificationEmailDto {
  @IsEmail()
  email: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken?: string; // Optional, can also be in HTTP-only cookie
}
