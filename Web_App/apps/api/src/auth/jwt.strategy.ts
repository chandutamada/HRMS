import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  employeeCode?: string;
  companyId?: string | null;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'super_secret_hrms_jwt_access_key_2026_superbee_gtids_gtib!',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        company: true,
        employee: true,
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

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is inactive, suspended, or does not exist');
    }

    const roles = user.roles.map((r) => r.role.name.toString());
    const permissions = new Set<string>();
    user.roles.forEach((r) => {
      r.role.permissions.forEach((rp) => permissions.add(rp.permission.name));
    });

    return {
      id: user.id,
      email: user.email,
      employeeCode: user.employeeCode || undefined,
      isSuperAdmin: user.isSuperAdmin,
      companyId: user.companyId,
      companyCode: user.company?.code || null,
      roles,
      permissions: Array.from(permissions),
      employeeId: user.employee?.id || null,
      officeLocationId: user.employee?.officeLocationId || null,
    };
  }
}
