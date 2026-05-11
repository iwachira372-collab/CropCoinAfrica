import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

// Mock user store - will be replaced with database in Phase 2
const mockUsers: any[] = [];

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async signup(createUserDto: CreateUserDto) {
    // Check if user exists
    const existingUser = mockUsers.find(u => u.email === createUserDto.email);
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);

    const newUser = {
      id: `user_${Date.now()}`,
      email: createUserDto.email,
      password: hashedPassword,
      createdAt: new Date(),
      emailVerified: false,
    };

    mockUsers.push(newUser);

    const { password, ...userWithoutPassword } = newUser;
    return {
      message: 'User registered successfully. Verification email sent.',
      user: userWithoutPassword,
    };
  }

  async login(loginUserDto: LoginUserDto) {
    const user = mockUsers.find(u => u.email === loginUserDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(loginUserDto.password, user.password);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: 'farmer', // Will be dynamic in Phase 2
    });

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      },
    };
  }
}
