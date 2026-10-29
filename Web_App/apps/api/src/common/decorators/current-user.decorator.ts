import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  employeeCode?: string;
  isSuperAdmin: boolean;
  companyId?: string | null;
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
    return data ? user?.[data] : user;
  },
);
