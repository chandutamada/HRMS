import {
  PrismaClient,
  UserRoleType,
  EmploymentStatus,
  Gender,
  CompanyStatus,
  UserStatus,
  WorkLocationType,
  AttendanceStatus,
  PayrollStatus,
  PayrollRecordStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export async function seedGtidsAndGtib() {
  console.log('--- Seeding/Ensuring GTIDS and GTIB Companies & Separate Databases ---');

  const defaultPasswordHash = await bcrypt.hash('Password@123', 10);
  const employeeRole = await prisma.role.findUniqueOrThrow({ where: { name: UserRoleType.EMPLOYEE } });
  const hrAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: UserRoleType.HR_ADMIN } });
  const superAdminRole = await prisma.role.findUniqueOrThrow({ where: { name: UserRoleType.SUPER_ADMIN } });

  // =========================================================================
  // 1. COMPANY 2: GTIDS (Gram Tarang Inclusive Development Services Private Limited)
  // =========================================================================
  let gtidsCompany = await prisma.company.findUnique({ where: { code: 'GTIDS' } });
  if (!gtidsCompany) {
    gtidsCompany = await prisma.company.create({
      data: {
        code: 'GTIDS',
        name: 'Gram Tarang Inclusive Development Services Private Limited',
        legalName: 'Gram Tarang Inclusive Development Services Private Limited',
        email: 'hr@gtids.in',
        phone: '+91 891 234 5679',
        website: 'https://gramtarang.org/',
        address: 'Centurion University Campus, Tekkali Village, Nellimarla, Vizianagaram, Andhra Pradesh 535003',
        status: CompanyStatus.ACTIVE,
      },
    });
    console.log('✓ Created Company: GTIDS (Gram Tarang Inclusive Development Services Private Limited)');
  } else {
    console.log('ℹ GTIDS company already exists.');
  }

  // Office Location for GTIDS
  let gtidsOffice = await prisma.officeLocation.findFirst({
    where: { companyId: gtidsCompany.id, code: 'GTIDS-NLM-01' },
  });
  if (!gtidsOffice) {
    gtidsOffice = await prisma.officeLocation.create({
      data: {
        companyId: gtidsCompany.id,
        name: 'GTIDS Operations Center (Nellimarla HQ)',
        code: 'GTIDS-NLM-01',
        address: 'Centurion University Campus, Tekkali Village, Nellimarla, Vizianagaram, AP 535003',
        latitude: 18.1895500,
        longitude: 83.3871110,
        radiusMeters: 50,
        timezone: 'Asia/Kolkata',
        isActive: true,
      },
    });
    console.log('✓ Created GTIDS Office Location & 50m Geofence');
  }

  // Departments for GTIDS
  const gtidsDeptData = [
    { name: 'Inclusive Financial Services & Banking', code: 'GTIDS_FIN' },
    { name: 'Skill Training & Rural Livelihoods', code: 'GTIDS_SKILL' },
    { name: 'Field Operations & Banking Correspondents', code: 'GTIDS_BC_OPS' },
    { name: 'Quality, Audit & Compliance', code: 'GTIDS_COMPL' },
    { name: 'Human Resources & Talent Management', code: 'GTIDS_HR' },
    { name: 'Administration & Finance', code: 'GTIDS_ADMIN' },
  ];
  const gtidsDepartments: Record<string, any> = {};
  for (const d of gtidsDeptData) {
    let dept = await prisma.department.findFirst({
      where: { companyId: gtidsCompany.id, code: d.code },
    });
    if (!dept) {
      dept = await prisma.department.create({
        data: { companyId: gtidsCompany.id, name: d.name, code: d.code },
      });
    }
    gtidsDepartments[d.code] = dept;
  }

  // Designations for GTIDS
  const gtidsDesigData = [
    { title: 'Field Project Coordinator', code: 'GTIDS_COORD' },
    { title: 'Banking Correspondent Lead', code: 'GTIDS_BC_LEAD' },
    { title: 'Skill Development Trainer', code: 'GTIDS_TRAINER' },
    { title: 'Compliance & Quality Officer', code: 'GTIDS_AUDITOR' },
    { title: 'HR Lead', code: 'GTIDS_HR_LEAD' },
    { title: 'Operations Manager', code: 'GTIDS_OPS_MGR' },
  ];
  const gtidsDesignations: Record<string, any> = {};
  for (const des of gtidsDesigData) {
    let desig = await prisma.designation.findFirst({
      where: { companyId: gtidsCompany.id, code: des.code },
    });
    if (!desig) {
      desig = await prisma.designation.create({
        data: { companyId: gtidsCompany.id, title: des.title, code: des.code },
      });
    }
    gtidsDesignations[des.code] = desig;
  }

  // Shift for GTIDS
  let gtidsShift = await prisma.shift.findFirst({
    where: { companyId: gtidsCompany.id, code: 'GTIDS-GS' },
  });
  if (!gtidsShift) {
    gtidsShift = await prisma.shift.create({
      data: {
        companyId: gtidsCompany.id,
        name: 'General Day Schedule (GTIDS)',
        code: 'GTIDS-GS',
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
  } else {
    gtidsShift = await prisma.shift.update({
      where: { id: gtidsShift.id },
      data: {
        startTime: '09:00',
        endTime: '17:30',
        netWorkSpanMinutes: 450,
        totalSpanMinutes: 510,
      },
    });
  }

  // Leave Types for GTIDS
  const leaveTypesData = [
    { name: 'Casual Leave', code: 'CL', entitlement: 12 },
    { name: 'Sick Leave', code: 'SL', entitlement: 12 },
    { name: 'Earned Leave', code: 'EL', entitlement: 15 },
  ];
  const gtidsLeaveTypes: Record<string, any> = {};
  for (const lt of leaveTypesData) {
    let lType = await prisma.leaveType.findFirst({
      where: { companyId: gtidsCompany.id, code: lt.code },
    });
    if (!lType) {
      lType = await prisma.leaveType.create({
        data: {
          companyId: gtidsCompany.id,
          name: lt.name,
          code: lt.code,
          annualEntitlement: lt.entitlement,
          isPaid: true,
          maxConsecutiveDays: 7,
          allowHalfDay: true,
          isActive: true,
        },
      });
    }
    gtidsLeaveTypes[lt.code] = lType;
  }

  // Employees for GTIDS
  const gtidsEmployeesData = [
    {
      code: 'GTIDS-001',
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@gtids.in',
      phone: '+91 98480 11001',
      workLocationType: WorkLocationType.ON_SITE,
      deptCode: 'GTIDS_FIN',
      desigCode: 'GTIDS_COORD',
      basic: 38000,
      gross: 65000,
      net: 59800,
    },
    {
      code: 'GTIDS-002',
      firstName: 'Manoj',
      lastName: 'Kumar',
      email: 'manoj.kumar@gtids.in',
      phone: '+91 98480 11002',
      workLocationType: WorkLocationType.OFF_SITE, // Field Banking Correspondent with GPS tracking
      deptCode: 'GTIDS_BC_OPS',
      desigCode: 'GTIDS_BC_LEAD',
      basic: 32000,
      gross: 54000,
      net: 49800,
    },
    {
      code: 'GTIDS-003',
      firstName: 'Sunita',
      lastName: 'Rao',
      email: 'sunita.rao@gtids.in',
      phone: '+91 98480 11003',
      workLocationType: WorkLocationType.ON_SITE,
      deptCode: 'GTIDS_SKILL',
      desigCode: 'GTIDS_TRAINER',
      basic: 30000,
      gross: 50000,
      net: 46200,
    },
    {
      code: 'GTIDS-004',
      firstName: 'Amit',
      lastName: 'Verma',
      email: 'amit.verma@gtids.in',
      phone: '+91 98480 11004',
      workLocationType: WorkLocationType.ON_SITE,
      deptCode: 'GTIDS_ADMIN',
      desigCode: 'GTIDS_OPS_MGR',
      basic: 45000,
      gross: 78000,
      net: 71500,
    },
  ];

  for (const empData of gtidsEmployeesData) {
    let user = await prisma.user.findFirst({ where: { email: empData.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: empData.email,
          employeeCode: empData.code,
          passwordHash: defaultPasswordHash,
          companyId: gtidsCompany.id,
          status: UserStatus.ACTIVE,
          roles: {
            create: [{ roleId: employeeRole.id }],
          },
        },
      });
    }

    let employee = await prisma.employee.findFirst({ where: { employeeCode: empData.code } });
    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          userId: user.id,
          companyId: gtidsCompany.id,
          employeeCode: empData.code,
          firstName: empData.firstName,
          lastName: empData.lastName,
          email: empData.email,
          phone: empData.phone,
          joiningDate: new Date('2024-01-15'),
          employmentStatus: EmploymentStatus.FULL_TIME,
          workLocationType: empData.workLocationType,
          gender: Gender.FEMALE,
          departmentId: gtidsDepartments[empData.deptCode].id,
          designationId: gtidsDesignations[empData.desigCode].id,
          officeLocationId: gtidsOffice.id,
          shiftId: gtidsShift.id,
        },
      });

      // Salary structure
      await prisma.salaryStructure.create({
        data: {
          employeeId: employee.id,
          companyId: gtidsCompany.id,
          effectiveDate: new Date('2026-01-01'),
          basicSalary: empData.basic,
          hra: Math.round(empData.basic * 0.4),
          conveyance: 2500,
          specialAllowance: 4500,
          medicalAllowance: 1500,
          grossMonthly: empData.gross,
          epfEmployee: Math.round(empData.basic * 0.12),
          professionalTax: 200,
          totalDeductions: empData.gross - empData.net,
          netMonthly: empData.net,
          ctcAnnual: empData.gross * 12,
          isActive: true,
        },
      });

      // Leave Balances
      for (const ltCode of ['CL', 'SL', 'EL']) {
        await prisma.leaveBalance.create({
          data: {
            companyId: gtidsCompany.id,
            employeeId: employee.id,
            leaveTypeId: gtidsLeaveTypes[ltCode].id,
            year: 2026,
            entitledDays: ltCode === 'EL' ? 15 : 12,
            availableDays: ltCode === 'EL' ? 14 : 11,
            usedDays: 1,
            pendingDays: 0,
          },
        });
      }

      // Today attendance record
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingRecord = await prisma.attendanceRecord.findFirst({
        where: { employeeId: employee.id, date: today },
      });
      if (!existingRecord) {
        await prisma.attendanceRecord.create({
          data: {
            employeeId: employee.id,
            companyId: gtidsCompany.id,
            date: today,
            status: AttendanceStatus.PRESENT,
            firstCheckIn: new Date(today.getTime() + (9 * 60 + 5) * 60000),
            lastCheckOut: null,
            totalWorkMinutes: 420,
            isLate: false,
            lateMinutes: 0,
          },
        });
      }
    }

    // Live Location & Field Tracking for GTIDS-002
    if (empData.code === 'GTIDS-002') {
      const fieldLat = 18.192500;
      const fieldLng = 83.391500;
      await prisma.liveLocation.upsert({
        where: { userId: user.id },
        update: {
          latitude: fieldLat,
          longitude: fieldLng,
          isMoving: true,
          speed: 18.5,
          batteryLevel: 88,
          isWithinOfficeHours: true,
          isWithinGeofence: false,
          distanceToOfficeMeters: 550,
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          employeeId: employee.id,
          latitude: fieldLat,
          longitude: fieldLng,
          accuracy: 5.5,
          speed: 18.5,
          isMoving: true,
          batteryLevel: 88,
          isWithinOfficeHours: true,
          isWithinGeofence: false,
          distanceToOfficeMeters: 550,
        },
      });

      // Tracking Session with route points
      const sessionId = `GTIDS-SESS-${Date.now()}`;
      await prisma.trackingSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          employeeId: employee.id,
          companyId: gtidsCompany.id,
          startTime: new Date(Date.now() - 3600000 * 2),
          distanceKm: 4.8,
          status: 'IN_PROGRESS',
          areaName: 'Vizianagaram Rural Financial Center Corridor',
          state: 'Andhra Pradesh',
          routePoints: {
            create: [
              { latitude: 18.189550, longitude: 83.387111, timestamp: new Date(Date.now() - 3600000 * 2), speed: 0 },
              { latitude: 18.190800, longitude: 83.388900, timestamp: new Date(Date.now() - 3600000 * 1.5), speed: 20 },
              { latitude: 18.192500, longitude: 83.391500, timestamp: new Date(Date.now() - 60000), speed: 18.5 },
            ],
          },
        },
      });
    }
  }

  // =========================================================================
  // 2. COMPANY 3: CUTMAP (Centurion University Admission Staff)
  // =========================================================================
  let gtibCompany = await prisma.company.findFirst({ where: { OR: [{ code: 'CUTMAP' }, { code: 'GTIB' }] } });
  if (gtibCompany) {
    if (gtibCompany.code !== 'CUTMAP' || gtibCompany.name !== 'Centurion University Admission Staff') {
      gtibCompany = await prisma.company.update({
        where: { id: gtibCompany.id },
        data: {
          code: 'CUTMAP',
          name: 'Centurion University Admission Staff',
          legalName: 'Centurion University Admission Staff',
        },
      });
      console.log('✓ Updated Company: CUTMAP (Centurion University Admission Staff)');
    } else {
      console.log('ℹ CUTMAP company already exists.');
    }
  } else {
    gtibCompany = await prisma.company.create({
      data: {
        code: 'CUTMAP',
        name: 'Centurion University Admission Staff',
        legalName: 'Centurion University Admission Staff',
        email: 'admissions@cutmap.ac.in',
        phone: '+91 891 234 5680',
        website: 'https://cutm.ac.in/',
        address: 'Centurion University Campus, Tekkali Village, Nellimarla, Vizianagaram, Andhra Pradesh 535003',
        status: CompanyStatus.ACTIVE,
      },
    });
    console.log('✓ Created Company: CUTMAP (Centurion University Admission Staff)');
  }

  // Office Location for GTIB
  let gtibOffice = await prisma.officeLocation.findFirst({
    where: { companyId: gtibCompany.id, code: 'GTIB-NLM-01' },
  });
  if (!gtibOffice) {
    gtibOffice = await prisma.officeLocation.create({
      data: {
        companyId: gtibCompany.id,
        name: 'GTIB Corporate Hub (Nellimarla HQ)',
        code: 'GTIB-NLM-01',
        address: 'Centurion University Campus, Tekkali Village, Nellimarla, Vizianagaram, AP 535003',
        latitude: 18.1895500,
        longitude: 83.3871110,
        radiusMeters: 50,
        timezone: 'Asia/Kolkata',
        isActive: true,
      },
    });
    console.log('✓ Created GTIB Office Location & 50m Geofence');
  }

  // Departments for GTIB
  const gtibDeptData = [
    { name: 'Insurance Broking & Risk Advisory', code: 'GTIB_BROK' },
    { name: 'Underwriting & Claims Settlement', code: 'GTIB_UNDER' },
    { name: 'Corporate Policy Distribution', code: 'GTIB_SALES' },
    { name: 'Actuarial & Regulatory Compliance', code: 'GTIB_ACT' },
    { name: 'Human Resources', code: 'GTIB_HR' },
    { name: 'Accounts & Finance', code: 'GTIB_ACCTS' },
  ];
  const gtibDepartments: Record<string, any> = {};
  for (const d of gtibDeptData) {
    let dept = await prisma.department.findFirst({
      where: { companyId: gtibCompany.id, code: d.code },
    });
    if (!dept) {
      dept = await prisma.department.create({
        data: { companyId: gtibCompany.id, name: d.name, code: d.code },
      });
    }
    gtibDepartments[d.code] = dept;
  }

  // Designations for GTIB
  const gtibDesigData = [
    { title: 'Senior Insurance Broker', code: 'GTIB_SR_BROKER' },
    { title: 'Claims Assessment Specialist', code: 'GTIB_CLAIMS_SPEC' },
    { title: 'Risk & Underwriting Lead', code: 'GTIB_UNDER_LEAD' },
    { title: 'Corporate Advisory Officer', code: 'GTIB_CORP_ADV' },
    { title: 'HR Lead', code: 'GTIB_HR_LEAD' },
    { title: 'Branch Operations Lead', code: 'GTIB_BRANCH_LEAD' },
  ];
  const gtibDesignations: Record<string, any> = {};
  for (const des of gtibDesigData) {
    let desig = await prisma.designation.findFirst({
      where: { companyId: gtibCompany.id, code: des.code },
    });
    if (!desig) {
      desig = await prisma.designation.create({
        data: { companyId: gtibCompany.id, title: des.title, code: des.code },
      });
    }
    gtibDesignations[des.code] = desig;
  }

  // Shift for GTIB
  let gtibShift = await prisma.shift.findFirst({
    where: { companyId: gtibCompany.id, code: 'GTIB-GS' },
  });
  if (!gtibShift) {
    gtibShift = await prisma.shift.create({
      data: {
        companyId: gtibCompany.id,
        name: 'General Day Schedule (GTIB)',
        code: 'GTIB-GS',
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
  } else {
    gtibShift = await prisma.shift.update({
      where: { id: gtibShift.id },
      data: {
        startTime: '09:00',
        endTime: '17:30',
        netWorkSpanMinutes: 450,
        totalSpanMinutes: 510,
      },
    });
  }

  // Leave Types for GTIB
  const gtibLeaveTypes: Record<string, any> = {};
  for (const lt of leaveTypesData) {
    let lType = await prisma.leaveType.findFirst({
      where: { companyId: gtibCompany.id, code: lt.code },
    });
    if (!lType) {
      lType = await prisma.leaveType.create({
        data: {
          companyId: gtibCompany.id,
          name: lt.name,
          code: lt.code,
          annualEntitlement: lt.entitlement,
          isPaid: true,
          maxConsecutiveDays: 7,
          allowHalfDay: true,
          isActive: true,
        },
      });
    }
    gtibLeaveTypes[lt.code] = lType;
  }

  // Employees for GTIB
  const gtibEmployeesData = [
    {
      code: 'GTIB-001',
      firstName: 'Deepak',
      lastName: 'Mohanty',
      email: 'deepak.mohanty@gtib.in',
      phone: '+91 98480 22001',
      workLocationType: WorkLocationType.ON_SITE,
      deptCode: 'GTIB_BROK',
      desigCode: 'GTIB_SR_BROKER',
      basic: 42000,
      gross: 72000,
      net: 66400,
    },
    {
      code: 'GTIB-002',
      firstName: 'Kavita',
      lastName: 'Singh',
      email: 'kavita.singh@gtib.in',
      phone: '+91 98480 22002',
      workLocationType: WorkLocationType.ON_SITE,
      deptCode: 'GTIB_UNDER',
      desigCode: 'GTIB_UNDER_LEAD',
      basic: 48000,
      gross: 82000,
      net: 75200,
    },
    {
      code: 'GTIB-003',
      firstName: 'Rakesh',
      lastName: 'Panda',
      email: 'rakesh.panda@gtib.in',
      phone: '+91 98480 22003',
      workLocationType: WorkLocationType.OFF_SITE, // Corporate Policy Advisory with field movement
      deptCode: 'GTIB_SALES',
      desigCode: 'GTIB_CORP_ADV',
      basic: 35000,
      gross: 60000,
      net: 55200,
    },
    {
      code: 'GTIB-004',
      firstName: 'Sneha',
      lastName: 'Mishra',
      email: 'sneha.mishra@gtib.in',
      phone: '+91 98480 22004',
      workLocationType: WorkLocationType.ON_SITE,
      deptCode: 'GTIB_UNDER',
      desigCode: 'GTIB_CLAIMS_SPEC',
      basic: 32000,
      gross: 54000,
      net: 49800,
    },
  ];

  for (const empData of gtibEmployeesData) {
    let user = await prisma.user.findFirst({ where: { email: empData.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: empData.email,
          employeeCode: empData.code,
          passwordHash: defaultPasswordHash,
          companyId: gtibCompany.id,
          status: UserStatus.ACTIVE,
          roles: {
            create: [{ roleId: employeeRole.id }],
          },
        },
      });
    }

    let employee = await prisma.employee.findFirst({ where: { employeeCode: empData.code } });
    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          userId: user.id,
          companyId: gtibCompany.id,
          employeeCode: empData.code,
          firstName: empData.firstName,
          lastName: empData.lastName,
          email: empData.email,
          phone: empData.phone,
          joiningDate: new Date('2024-03-01'),
          employmentStatus: EmploymentStatus.FULL_TIME,
          workLocationType: empData.workLocationType,
          gender: Gender.FEMALE,
          departmentId: gtibDepartments[empData.deptCode].id,
          designationId: gtibDesignations[empData.desigCode].id,
          officeLocationId: gtibOffice.id,
          shiftId: gtibShift.id,
        },
      });

      // Salary structure
      await prisma.salaryStructure.create({
        data: {
          employeeId: employee.id,
          companyId: gtibCompany.id,
          effectiveDate: new Date('2026-01-01'),
          basicSalary: empData.basic,
          hra: Math.round(empData.basic * 0.4),
          conveyance: 2500,
          specialAllowance: 5000,
          medicalAllowance: 1500,
          grossMonthly: empData.gross,
          epfEmployee: Math.round(empData.basic * 0.12),
          professionalTax: 200,
          totalDeductions: empData.gross - empData.net,
          netMonthly: empData.net,
          ctcAnnual: empData.gross * 12,
          isActive: true,
        },
      });

      // Leave Balances
      for (const ltCode of ['CL', 'SL', 'EL']) {
        await prisma.leaveBalance.create({
          data: {
            companyId: gtibCompany.id,
            employeeId: employee.id,
            leaveTypeId: gtibLeaveTypes[ltCode].id,
            year: 2026,
            entitledDays: ltCode === 'EL' ? 15 : 12,
            availableDays: ltCode === 'EL' ? 15 : 12,
            usedDays: 0,
            pendingDays: 0,
          },
        });
      }

      // Today attendance record
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingRecord = await prisma.attendanceRecord.findFirst({
        where: { employeeId: employee.id, date: today },
      });
      if (!existingRecord) {
        await prisma.attendanceRecord.create({
          data: {
            employeeId: employee.id,
            companyId: gtibCompany.id,
            date: today,
            status: AttendanceStatus.PRESENT,
            firstCheckIn: new Date(today.getTime() + (8 * 60 + 58) * 60000),
            lastCheckOut: null,
            totalWorkMinutes: 440,
            isLate: false,
            lateMinutes: 0,
          },
        });
      }
    }

    // Live Location & Field Tracking for GTIB-003
    if (empData.code === 'GTIB-003') {
      const fieldLat = 18.185200;
      const fieldLng = 83.382100;
      await prisma.liveLocation.upsert({
        where: { userId: user.id },
        update: {
          latitude: fieldLat,
          longitude: fieldLng,
          isMoving: true,
          speed: 24.0,
          batteryLevel: 92,
          isWithinOfficeHours: true,
          isWithinGeofence: false,
          distanceToOfficeMeters: 720,
          updatedAt: new Date(),
        },
        create: {
          userId: user.id,
          employeeId: employee.id,
          latitude: fieldLat,
          longitude: fieldLng,
          accuracy: 4.8,
          speed: 24.0,
          isMoving: true,
          batteryLevel: 92,
          isWithinOfficeHours: true,
          isWithinGeofence: false,
          distanceToOfficeMeters: 720,
        },
      });

      // Tracking Session with route points
      const sessionId = `GTIB-SESS-${Date.now()}`;
      await prisma.trackingSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          employeeId: employee.id,
          companyId: gtibCompany.id,
          startTime: new Date(Date.now() - 3600000 * 3),
          distanceKm: 6.2,
          status: 'IN_PROGRESS',
          areaName: 'Vizianagaram Industrial & Corporate Advisory Route',
          state: 'Andhra Pradesh',
          routePoints: {
            create: [
              { latitude: 18.189550, longitude: 83.387111, timestamp: new Date(Date.now() - 3600000 * 3), speed: 0 },
              { latitude: 18.187200, longitude: 83.384500, timestamp: new Date(Date.now() - 3600000 * 2), speed: 22 },
              { latitude: 18.185200, longitude: 83.382100, timestamp: new Date(Date.now() - 60000), speed: 24 },
            ],
          },
        },
      });
    }
  }

  console.log('========================================================');
  console.log('✅ GTIDS & GTIB DATA SEEDED SUCCESSFULLY!');
  console.log('🏢 GTIDS: Gram Tarang Inclusive Development Services Private Limited');
  console.log('🏢 GTIB:  Gram Tarang Insurance and Brokering Private Limited');
  console.log('========================================================');
}

if (require.main === module) {
  seedGtidsAndGtib()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
