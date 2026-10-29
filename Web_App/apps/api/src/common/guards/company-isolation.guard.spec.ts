import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CompanyIsolationGuard } from './company-isolation.guard';

describe('CompanyIsolationGuard (Multi-Company Authorization)', () => {
  let guard: CompanyIsolationGuard;

  beforeEach(() => {
    guard = new CompanyIsolationGuard();
  });

  const createMockContext = (user: any, requestData: any = {}): ExecutionContext => {
    const request = {
      user,
      ...requestData,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as any;
  };

  it('should allow Super Admin to access any company data', () => {
    const user = {
      id: 'sa-1',
      isSuperAdmin: true,
      roles: ['SUPER_ADMIN'],
      companyId: null,
    };
    const context = createMockContext(user, { params: { companyId: 'other-company' } });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow user accessing their own authorized company', () => {
    const user = {
      id: 'emp-1',
      isSuperAdmin: false,
      roles: ['EMPLOYEE'],
      companyId: 'company-superbee',
    };
    const context = createMockContext(user, { params: { companyId: 'company-superbee' } });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should strictly throw ForbiddenException when accessing another company data', () => {
    const user = {
      id: 'emp-1',
      isSuperAdmin: false,
      roles: ['HR_ADMIN'],
      companyId: 'company-superbee',
    };
    const context = createMockContext(user, { params: { companyId: 'company-gtids' } });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
