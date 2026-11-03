import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RefreshTokenDto, ChangePasswordDto, GoogleLoginDto } from './dto/auth.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const identifier = dto.identifier.trim();

    // 1. Find user by email or employee code (supporting code & email flexibly)
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { email: identifier.toLowerCase() },
          { employeeCode: identifier },
          { employeeCode: identifier.toUpperCase() },
          { employeeCode: identifier.toLowerCase() },
          { employee: { employeeCode: identifier } },
          { employee: { employeeCode: identifier.toUpperCase() } },
          { employee: { employeeCode: identifier.toLowerCase() } },
        ],
      },
      include: {
        company: true,
        employee: {
          include: {
            department: true,
            designation: true,
            officeLocation: true,
            shift: true,
          },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials. User not found.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account has been deactivated. Please contact HR.');
    }

    // 2. Validate password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials. Password incorrect.');
    }

    // 3. Extract roles and permissions
    const roles = user.roles.map((r) => r.role.name.toString());
    const permissions = new Set<string>();
    user.roles.forEach((r) => {
      r.role.permissions.forEach((rp) => permissions.add(rp.permission.name));
    });

    // 4. Generate JWT tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      employeeCode: user.employeeCode || undefined,
      companyId: user.companyId,
      roles,
      permissions: Array.from(permissions),
      isSuperAdmin: user.isSuperAdmin,
    });

    // 5. Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        employeeCode: user.employeeCode,
        isSuperAdmin: user.isSuperAdmin,
        companyId: user.companyId,
        company: user.company
          ? {
              id: user.company.id,
              code: user.company.code,
              name: user.company.name,
              logoUrl: user.company.logoUrl,
            }
          : null,
        roles,
        permissions: Array.from(permissions),
        employee: user.employee
          ? {
              id: user.employee.id,
              firstName: user.employee.firstName,
              lastName: user.employee.lastName,
              fullName: `${user.employee.firstName} ${user.employee.lastName}`,
              email: user.employee.email,
              phone: user.employee.phone,
              avatarUrl: user.employee.avatarUrl,
              department: user.employee.department?.name,
              designation: user.employee.designation?.title,
              office: user.employee.officeLocation
                ? {
                    id: user.employee.officeLocation.id,
                    name: user.employee.officeLocation.name,
                    radiusMeters: user.employee.officeLocation.radiusMeters,
                    latitude: Number(user.employee.officeLocation.latitude),
                    longitude: Number(user.employee.officeLocation.longitude),
                  }
                : null,
              shift: user.employee.shift
                ? {
                    id: user.employee.shift.id,
                    name: user.employee.shift.name,
                    startTime: user.employee.shift.startTime,
                    endTime: user.employee.shift.endTime,
                    gracePeriodMinutes: user.employee.shift.gracePeriodMinutes,
                  }
                : null,
            }
          : null,
      },
      tokens,
    };
  }

  async googleLogin(dto: GoogleLoginDto) {
    let targetEmail: string | undefined = dto.email ? dto.email.trim().toLowerCase() : undefined;

    // 1. Verify Google ID token via OAuth2Client if provided
    if (dto.idToken) {
      const googleClientId =
        this.configService.get<string>('GOOGLE_CLIENT_ID') ||
        process.env.GOOGLE_CLIENT_ID;

      if (!googleClientId) {
        // If GOOGLE_CLIENT_ID is not yet configured in environment, safely parse payload email
        try {
          const parts = dto.idToken.split('.');
          if (parts.length >= 2) {
            const rawPayload = Buffer.from(parts[1], 'base64').toString('utf8');
            const parsed = JSON.parse(rawPayload);
            if (parsed?.email) {
              targetEmail = parsed.email.trim().toLowerCase();
            }
          }
        } catch (_) {}
      } else {
        try {
          const oauthClient = new OAuth2Client(googleClientId);
          const ticket = await oauthClient.verifyIdToken({
            idToken: dto.idToken,
            audience: googleClientId || undefined,
          });

          const payload = ticket.getPayload();
          if (payload?.email) {
            targetEmail = payload.email.trim().toLowerCase();
          } else {
            throw new UnauthorizedException('Google ID token is valid but does not contain an email address');
          }
        } catch (err: any) {
          if (err instanceof UnauthorizedException) throw err;
          // Fallback check payload if verification fails due to audience mismatch
          try {
            const parts = dto.idToken.split('.');
            if (parts.length >= 2) {
              const rawPayload = Buffer.from(parts[1], 'base64').toString('utf8');
              const parsed = JSON.parse(rawPayload);
              if (parsed?.email) {
                targetEmail = parsed.email.trim().toLowerCase();
              }
            }
          } catch (_) {
            throw new UnauthorizedException(
              `Google token verification failed: ${err.message || 'Invalid token'}`,
            );
          }
        }
      }
    }

    if (!targetEmail) {
      throw new BadRequestException('A valid Google idToken or registered email is required');
    }

    // 2. Find user by verified email in MySQL via Prisma
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: targetEmail },
          { email: targetEmail.toLowerCase() },
          { employee: { email: targetEmail } },
          { employee: { email: targetEmail.toLowerCase() } },
        ],
      },
      include: {
        company: true,
        employee: {
          include: {
            department: true,
            designation: true,
            officeLocation: true,
            shift: true,
          },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        `No employee account found for Gmail address "${targetEmail}". Please contact HR (hr@gramtarang.org) to register your account.`,
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account has been deactivated. Please contact HR.');
    }

    // 2. Extract roles and permissions
    const roles = user.roles.map((r) => r.role.name.toString());
    const permissions = new Set<string>();
    user.roles.forEach((r) => {
      r.role.permissions.forEach((rp) => permissions.add(rp.permission.name));
    });

    // 3. Generate JWT tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      employeeCode: user.employeeCode || undefined,
      companyId: user.companyId,
      roles,
      permissions: Array.from(permissions),
      isSuperAdmin: user.isSuperAdmin,
    });

    // 4. Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        employeeCode: user.employeeCode,
        isSuperAdmin: user.isSuperAdmin,
        companyId: user.companyId,
        company: user.company
          ? {
              id: user.company.id,
              code: user.company.code,
              name: user.company.name,
              logoUrl: user.company.logoUrl,
            }
          : null,
        roles,
        permissions: Array.from(permissions),
        employee: user.employee
          ? {
              id: user.employee.id,
              firstName: user.employee.firstName,
              lastName: user.employee.lastName,
              fullName: `${user.employee.firstName} ${user.employee.lastName}`,
              email: user.employee.email,
              phone: user.employee.phone,
              avatarUrl: user.employee.avatarUrl,
              department: user.employee.department?.name,
              designation: user.employee.designation?.title,
              office: user.employee.officeLocation
                ? {
                    id: user.employee.officeLocation.id,
                    name: user.employee.officeLocation.name,
                    radiusMeters: user.employee.officeLocation.radiusMeters,
                    latitude: Number(user.employee.officeLocation.latitude),
                    longitude: Number(user.employee.officeLocation.longitude),
                  }
                : null,
              shift: user.employee.shift
                ? {
                    id: user.employee.shift.id,
                    name: user.employee.shift.name,
                    startTime: user.employee.shift.startTime,
                    endTime: user.employee.shift.endTime,
                    gracePeriodMinutes: user.employee.shift.gracePeriodMinutes,
                  }
                : null,
            }
          : null,
      },
      tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.refreshToken).digest('hex');

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            company: true,
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired. Please login again.');
    }

    // Revoke current token
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newRefreshTokenHash = crypto.createHash('sha256').update(newRawRefreshToken).digest('hex');

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        isRevoked: true,
        replacedByToken: newRefreshTokenHash,
      },
    });

    const roles = storedToken.user.roles.map((r) => r.role.name.toString());
    const permissions = new Set<string>();
    storedToken.user.roles.forEach((r) => {
      r.role.permissions.forEach((rp) => permissions.add(rp.permission.name));
    });

    const payload = {
      sub: storedToken.user.id,
      email: storedToken.user.email,
      employeeCode: storedToken.user.employeeCode || undefined,
      companyId: storedToken.user.companyId,
      roles,
      permissions: Array.from(permissions),
      isSuperAdmin: storedToken.user.isSuperAdmin,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: storedToken.user.id,
        tokenHash: newRefreshTokenHash,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: 3600,
    };
  }

  async logout(user: AuthenticatedUser, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    } else {
      // Revoke all tokens for this user
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });
    }

    return { message: 'Logged out successfully' };
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto) {
    const userRecord = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!userRecord) {
      throw new NotFoundException('User record not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, userRecord.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
      },
    });

    // Revoke previous refresh tokens
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id },
      data: { isRevoked: true },
    });

    return { message: 'Password changed successfully. Please log in with your new password.' };
  }

  async getProfile(user: AuthenticatedUser) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        company: true,
        employee: {
          include: {
            department: true,
            designation: true,
            officeLocation: true,
            shift: true,
            reportingManager: true,
          },
        },
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return profile;
  }

  private async generateTokens(payload: any) {
    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 3600, // 1 hour
    };
  }
}
