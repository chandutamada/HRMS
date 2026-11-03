import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  employeeCode?: string;
  isSuperAdmin: boolean;
  companyId?: string | null;
  activeCompanyId?: string | null;
  companyCode?: string | null;
  roles: string[];
  permissions: string[];
  employeeId?: string | null;
  officeLocationId?: string | null;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    if (user) {
      const headerCompanyId = request.headers['x-company-id'];
      const queryCompanyId = request.query?.companyId;
      const isPrivileged =
        user.isSuperAdmin ||
        user.roles?.includes('SUPER_ADMIN') ||
        user.roles?.includes('HR_ADMIN') ||
        user.roles?.includes('HR_MANAGER');

      if (isPrivileged) {
        if (headerCompanyId === 'ALL' || queryCompanyId === 'ALL') {
          user.activeCompanyId = null;
        } else if (headerCompanyId && headerCompanyId !== 'null' && headerCompanyId !== 'undefined') {
          user.activeCompanyId = headerCompanyId as string;
        } else if (queryCompanyId && queryCompanyId !== 'null' && queryCompanyId !== 'undefined') {
          user.activeCompanyId = queryCompanyId as string;
        } else {
          user.activeCompanyId = user.companyId || null;
        }
      } else {
        user.activeCompanyId = user.companyId || null;
      }
    }
    return data ? user?.[data] : user;
  },
);

