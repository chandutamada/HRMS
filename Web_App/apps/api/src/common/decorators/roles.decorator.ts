import { SetMetadata } from '@nestjs/common';
import { UserRoleType } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: (UserRoleType | string)[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
