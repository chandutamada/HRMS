import {
  PrismaClient,
  UserRoleType,
  EmploymentStatus,
  Gender,
  CompanyStatus,
  UserStatus,
  WorkLocationType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Cleaning Database & Initializing Real Organization Data ---');

  // Disable FK checks to safely wipe mock data
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

  const tablesToClear = [
    'attendance_events',
    'attendance_corrections',
    'attendance_records',
    'route_points',
    'checkpoints',
    'timeline_stops',
    'tracking_sessions',
    'live_locations',
    'geofence_audit_logs',
    'helpdesk_messages',
    'helpdesk_tickets',
    'notifications',
    'circular_acknowledgements',
    'circular_target_companies',
    'circulars',
    'payroll_line_items',
    'payroll_records',
    'payroll_periods',
    'payroll_templates',
    'salary_structures',
    'leave_balance_transactions',
    'leave_balances',
    'leave_applications',
    'leave_policies',
    'leave_types',
    'holidays',
    'stored_documents',
    'employees',
    'user_roles',
    'refresh_tokens',
    'users',
    'shifts',
    'designations',
    'departments',
    'office_locations',
    'companies',
  ];

  for (const table of tablesToClear) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${table}\`;`);
    } catch (e: any) {
      console.warn(`Could not truncate ${table}:`, e.message);
    }
  }

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
  console.log('✓ Successfully wiped all mock companies, mock locations, and mock employees.');

  // 1. Roles & Permissions
  const roles = [
    { name: UserRoleType.SUPER_ADMIN, description: 'Super Administrator with global access' },
    { name: UserRoleType.HR_ADMIN, description: 'HR Administrator with organization management access' },
    { name: UserRoleType.HR_MANAGER, description: 'HR Manager with review and approval permissions' },
    { name: UserRoleType.EMPLOYEE, description: 'Employee with self-service attendance, leave, and profile access' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  console.log('✓ Roles configured.');

  // Common Permissions
  const permissionsData = [
    { name: 'companies:manage', module: 'COMPANIES', action: 'MANAGE', description: 'Create and edit companies' },
    { name: 'employees:read', module: 'EMPLOYEES', action: 'READ', description: 'View employees' },
    { name: 'employees:manage', module: 'EMPLOYEES', action: 'MANAGE', description: 'Create and update employees' },
    { name: 'offices:manage', module: 'OFFICES', action: 'MANAGE', description: 'Configure office geofences and locations' },
    { name: 'attendance:view_all', module: 'ATTENDANCE', action: 'READ', description: 'View all employee attendance' },
    { name: 'attendance:check_in_out', module: 'ATTENDANCE', action: 'CREATE', description: 'Check-in or check-out' },
    { name: 'attendance:approve_correction', module: 'ATTENDANCE', action: 'APPROVE', description: 'Approve or reject attendance correction' },
    { name: 'attendance:manual_override', module: 'ATTENDANCE', action: 'UPDATE', description: 'Manual attendance override with reason' },
    { name: 'leave:apply', module: 'LEAVE', action: 'CREATE', description: 'Apply for leaves' },
    { name: 'leave:approve', module: 'LEAVE', action: 'APPROVE', description: 'Approve leave applications' },
    { name: 'leave:configure', module: 'LEAVE', action: 'MANAGE', description: 'Configure leave types and policies' },
    { name: 'payroll:view', module: 'PAYROLL', action: 'READ', description: 'View payroll records' },
    { name: 'payroll:process', module: 'PAYROLL', action: 'MANAGE', description: 'Process, finalize, and override payroll' },
    { name: 'circulars:publish', module: 'CIRCULARS', action: 'CREATE', description: 'Publish circulars' },
    { name: 'reports:view', module: 'REPORTS', action: 'READ', description: 'View and export HR reports' },
    { name: 'audit:view', module: 'AUDIT', action: 'READ', description: 'View system audit trails' },
  ];

  for (const perm of permissionsData) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: perm,
      create: perm,
    });
  }
  console.log('✓ Permissions created.');

  // 2. Real Company: Superbee Aeronautics Private Limited
  const company = await prisma.company.create({
    data: {
      code: 'SUPERBEE',
      name: 'Superbee Aeronautics Private Limited',
      legalName: 'Superbee Aeronautics Private Limited',
      email: 'hr@gramtarang.org',
      phone: '+91 891 234 5678',
      website: 'https://superbeeaeronautics.com/',
      address: 'C/o Centurion University of Technology and Management Survey NO: 157-1 TO 6, Tekkali Village, Nellimarla, 535 003, Andhra Pradesh 535003',
      status: CompanyStatus.ACTIVE,
    },
  });
  console.log('✓ Real Company created: Superbee Aeronautics Private Limited');

  // 3. Real Office Location with 50m Geofence at Centurion University Campus, Nellimarla
  const office = await prisma.officeLocation.create({
    data: {
      companyId: company.id,
      name: 'Centurion University Campus (Nellimarla HQ)',
      code: 'SB-NLM-01',
      address: 'C/o Centurion University of Technology and Management Survey NO: 157-1 TO 6, Tekkali Village, Nellimarla, 535 003, Andhra Pradesh 535003',
      latitude: 18.1895500,
      longitude: 83.3871110,
      radiusMeters: 50,
      timezone: 'Asia/Kolkata',
      isActive: true,
    },
  });
  console.log(`✓ Real Office Geofence configured: 18.189550, 83.387111 (50m radius)`);

  // 4. Real Departments
  const deptNames = [
    { name: 'Aeronautical Engineering', code: 'AERO' },
    { name: 'Drone Operations & Piloting', code: 'DRONE_OPS' },
    { name: 'Avionics & Embedded Software', code: 'AVIONICS' },
    { name: 'Quality Assurance & Flight Testing', code: 'QA_TEST' },
    { name: 'Human Resources', code: 'HR' },
    { name: 'Administration & Operations', code: 'ADMIN' },
  ];

  const departments: Record<string, any> = {};
  for (const d of deptNames) {
    departments[d.code] = await prisma.department.create({
      data: {
        companyId: company.id,
        name: d.name,
        code: d.code,
      },
    });
  }

  // 5. Designations
  const desigNames = [
    { title: 'Drone Pilot & Flight Operator', code: 'PILOT' },
    { title: 'Aeronautical Engineer', code: 'AERO_ENG' },
    { title: 'Avionics & Embedded Engineer', code: 'AVIONICS_ENG' },
    { title: 'Flight Test Technician', code: 'TEST_TECH' },
    { title: 'HR Manager & Lead', code: 'HR_MGR' },
    { title: 'Operations Lead', code: 'OPS_LEAD' },
  ];

  const designations: Record<string, any> = {};
  for (const des of desigNames) {
    designations[des.code] = await prisma.designation.create({
      data: {
        companyId: company.id,
        title: des.title,
        code: des.code,
      },
    });
  }

  // 6. Standard Shifts
  const generalShift = await prisma.shift.create({
    data: {
      companyId: company.id,
      name: 'General Day Schedule',
      code: 'GS-01',
      startTime: '09:00',
      endTime: '17:30',
      lunchStartTime: '13:00',
      lunchEndTime: '14:00',
      gracePeriodMinutes: 30,
      lateExceptionMaxMinutes: 60,
      netWorkSpanMinutes: 450,
      totalSpanMinutes: 510,
      isDefault: true,
    },
  });

  // 7. Leave Types
  const leaveTypesData = [
    { name: 'Casual Leave', code: 'CL', entitlement: 12 },
    { name: 'Sick Leave', code: 'SL', entitlement: 12 },
    { name: 'Earned Leave', code: 'EL', entitlement: 15 },
  ];

  const leaveTypes: Record<string, any> = {};
  for (const lt of leaveTypesData) {
    leaveTypes[lt.code] = await prisma.leaveType.create({
      data: {
        companyId: company.id,
        name: lt.name,
        code: lt.code,
        annualEntitlement: lt.entitlement,
        isPaid: true,
        maxConsecutiveDays: 7,
        requiresDocProof: false,
        allowHalfDay: true,
        isActive: true,
      },
    });
  }

  // 8. Passwords
  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);
  const superAdminPasswordHash = await bcrypt.hash('Admin@123456', 10);

  // Retrieve Role IDs
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: UserRoleType.SUPER_ADMIN } });
  const hrAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: UserRoleType.HR_ADMIN } });
  const employeeRole = await prisma.role.findUniqueOrThrow({ where: { name: UserRoleType.EMPLOYEE } });

  // 9. Create Master Super Admin User
  await prisma.user.create({
    data: {
      email: 'superadmin@superbeeaeronautics.com',
      employeeCode: 'ADMIN-001',
      passwordHash: superAdminPasswordHash,
      isSuperAdmin: true,
      companyId: company.id,
      status: UserStatus.ACTIVE,
      roles: {
        create: [
          { roleId: superAdminRole.id },
          { roleId: hrAdminRole.id },
        ],
      },
    },
  });

  // 10. Create Real HR Administrator User & Employee Record: hr@gramtarang.org (Employee Code: SB-001)
  await prisma.user.create({
    data: {
      email: 'hr@gramtarang.org',
      employeeCode: 'SB-001',
      passwordHash: defaultPasswordHash,
      isSuperAdmin: true,
      companyId: company.id,
      status: UserStatus.ACTIVE,
      roles: {
        create: [
          { roleId: hrAdminRole.id },
          { roleId: employeeRole.id },
          { roleId: superAdminRole.id },
        ],
      },
      employee: {
        create: {
          companyId: company.id,
          employeeCode: 'SB-001',
          firstName: 'HR',
          lastName: 'Manager',
          email: 'hr@gramtarang.org',
          phone: '+91 891 234 5678',
          joiningDate: new Date(),
          employmentStatus: EmploymentStatus.FULL_TIME,
          workLocationType: WorkLocationType.ON_SITE,
          gender: Gender.OTHER,
          departmentId: departments['HR'].id,
          designationId: designations['HR_MGR'].id,
          officeLocationId: office.id,
          shiftId: generalShift.id,
          leaveBalances: {
            create: [
              {
                companyId: company.id,
                leaveTypeId: leaveTypes['CL'].id,
                year: 2026,
                entitledDays: 12,
                availableDays: 12,
                usedDays: 0,
                pendingDays: 0,
              },
              {
                companyId: company.id,
                leaveTypeId: leaveTypes['SL'].id,
                year: 2026,
                entitledDays: 12,
                availableDays: 12,
                usedDays: 0,
                pendingDays: 0,
              },
              {
                companyId: company.id,
                leaveTypeId: leaveTypes['EL'].id,
                year: 2026,
                entitledDays: 15,
                availableDays: 15,
                usedDays: 0,
                pendingDays: 0,
              },
            ],
          },
        },
      },
    },
  });

  console.log('✓ HR Administrator user & SB-001 employee created: hr@gramtarang.org');

  // 11. Seed GTIDS and GTIB Organizations & Separate Tenant Data
  const { seedGtidsAndGtib } = await import('./seed-gtids-gtib');
  await seedGtidsAndGtib();

  console.log('========================================================');
  console.log('✅ DATABASE INITIALIZATION COMPLETE FOR REAL ORGANIZATION!');
  console.log('========================================================');
  console.log('🏢 Company: Superbee Aeronautics Private Limited');
  console.log('📍 Office:  Centurion University Campus (Nellimarla, AP - 535003)');
  console.log('🌐 Coordinates: Lat 18.189550, Lng 83.387111 (50m Geofence)');
  console.log('--------------------------------------------------------');
  console.log('🔑 HR Admin Login (Web Dashboard & Mobile App):');
  console.log('   Email / ID: hr@gramtarang.org or SB-001');
  console.log('   Password:   Password@123');
  console.log('🔑 Master Super Admin:');
  console.log('   Email:      superadmin@superbeeaeronautics.com');
  console.log('   Password:   Admin@123456');
  console.log('========================================================');
}

main()
  .catch((e) => {
    console.error('Seed Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
