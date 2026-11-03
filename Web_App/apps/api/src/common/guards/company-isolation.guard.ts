import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class CompanyIsolationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (!user) {
      throw new ForbiddenException('User session required for company authorization');
    }

    // Super Admin can access all companies
    if (user.isSuperAdmin || user.roles?.includes('SUPER_ADMIN') || user.roles?.includes('HR_ADMIN')) {
      const explicitCompany =
        request.headers['x-company-id'] ||
        request.query?.companyId ||
        request.params?.companyId ||
        request.body?.companyId;

      request.activeCompanyId =
        explicitCompany === 'ALL'
          ? null
          : explicitCompany || user.companyId || null;
      return true;
    }

    // Every other user MUST have an assigned company
    if (!user.companyId) {
      throw new ForbiddenException('User is not assigned to any authorized company');
    }

    // Check if the request explicitly targets another company
    const requestedCompanyId =
      request.params?.companyId ||
      request.query?.companyId ||
      request.body?.companyId ||
      request.headers['x-company-id'];

    if (requestedCompanyId && requestedCompanyId !== user.companyId) {
      throw new ForbiddenException(
        'Cross-company access violation. You are not authorized to view or mutate data for another company.',
      );
    }

    // Force companyId to user's authorized company in all request parameters
    request.activeCompanyId = user.companyId;

    return true;
  }
}
