import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional, IsMobilePhone } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(32)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one lowercase letter, one uppercase letter, and one number',
  })
  password: string;

  @IsOptional()
  @IsMobilePhone()
  phone?: string;

  @IsString()
  @MinLength(2)
  firstName?: string;

  @IsString()
  @MinLength(2)
  lastName?: string;
}
