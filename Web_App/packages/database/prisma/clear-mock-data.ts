import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearMockData() {
  console.log('--- PURGING MOCK DATA ---');

  // 1. Telemetry and Tracking
  const rp = await prisma.routePoint.deleteMany({});
  console.log(`Deleted RoutePoints: ${rp.count}`);

  const cp = await prisma.checkpoint.deleteMany({});
  console.log(`Deleted Checkpoints: ${cp.count}`);

  const ts = await prisma.timelineStop.deleteMany({});
  console.log(`Deleted TimelineStops: ${ts.count}`);

  const sessions = await prisma.trackingSession.deleteMany({});
  console.log(`Deleted TrackingSessions: ${sessions.count}`);

  const ll = await prisma.liveLocation.deleteMany({});
  console.log(`Deleted LiveLocations: ${ll.count}`);

  // 2. Attendance & Geofence
  const ga = await prisma.geofenceAuditLog.deleteMany({});
  console.log(`Deleted GeofenceAuditLogs: ${ga.count}`);

  const acr = await prisma.attendanceCorrectionRequest.deleteMany({});
  console.log(`Deleted AttendanceCorrectionRequests: ${acr.count}`);

  const ae = await prisma.attendanceEvent.deleteMany({});
  console.log(`Deleted AttendanceEvents: ${ae.count}`);

  const ar = await prisma.attendanceRecord.deleteMany({});
  console.log(`Deleted AttendanceRecords: ${ar.count}`);

  // 3. Leaves
  const lbt = await prisma.leaveBalanceTransaction.deleteMany({});
  console.log(`Deleted LeaveBalanceTransactions: ${lbt.count}`);

  const la = await prisma.leaveApplication.deleteMany({});
  console.log(`Deleted LeaveApplications: ${la.count}`);

  const lb = await prisma.leaveBalance.deleteMany({});
  console.log(`Deleted LeaveBalances: ${lb.count}`);

  // 4. Payroll
  const pli = await prisma.payrollLineItem.deleteMany({});
  console.log(`Deleted PayrollLineItems: ${pli.count}`);

  const pr = await prisma.payrollRecord.deleteMany({});
  console.log(`Deleted PayrollRecords: ${pr.count}`);

  const pp = await prisma.payrollPeriod.deleteMany({});
  console.log(`Deleted PayrollPeriods: ${pp.count}`);

  const ss = await prisma.salaryStructure.deleteMany({});
  console.log(`Deleted SalaryStructures: ${ss.count}`);

  // 5. Circulars & Notifications & Helpdesk
  const ca = await prisma.circularAcknowledgement.deleteMany({});
  console.log(`Deleted CircularAcknowledgements: ${ca.count}`);

  const ctc = await prisma.circularTargetCompany.deleteMany({});
  console.log(`Deleted CircularTargetCompanies: ${ctc.count}`);

  const circ = await prisma.circular.deleteMany({});
  console.log(`Deleted Circulars: ${circ.count}`);

  const notifs = await prisma.notification.deleteMany({});
  console.log(`Deleted Notifications: ${notifs.count}`);

  const hm = await prisma.helpdeskMessage.deleteMany({});
  console.log(`Deleted HelpdeskMessages: ${hm.count}`);

  const ht = await prisma.helpdeskTicket.deleteMany({});
  console.log(`Deleted HelpdeskTickets: ${ht.count}`);

  const al = await prisma.auditLog.deleteMany({});
  console.log(`Deleted AuditLogs: ${al.count}`);

  const rt = await prisma.refreshToken.deleteMany({});
  console.log(`Deleted RefreshTokens: ${rt.count}`);

  const docs = await prisma.storedDocument.deleteMany({});
  console.log(`Deleted StoredDocuments: ${docs.count}`);

  // 6. Delete all mock employees and users except the Super Admin and HR Admin
  const adminEmails = ['superadmin@superbeeaeronautics.com', 'hr@gramtarang.org'];

  const mockEmployees = await prisma.employee.findMany({
    where: {
      email: { notIn: adminEmails },
    },
    select: { id: true, userId: true, email: true },
  });

  const empIds = mockEmployees.map((e) => e.id);
  const userIds = mockEmployees.map((e) => e.userId).filter(Boolean) as string[];

  console.log(`Found ${empIds.length} mock employees to delete.`);

  if (empIds.length > 0) {
    const deletedEmps = await prisma.employee.deleteMany({
      where: { id: { in: empIds } },
    });
    console.log(`Deleted Employees: ${deletedEmps.count}`);
  }

  // Find any remaining mock users (non-admins)
  const remainingMockUsers = await prisma.user.findMany({
    where: {
      email: { notIn: adminEmails },
    },
    select: { id: true, email: true },
  });

  const allMockUserIds = Array.from(new Set([...userIds, ...remainingMockUsers.map((u) => u.id)]));
  console.log(`Found ${allMockUserIds.length} mock users to delete.`);

  if (allMockUserIds.length > 0) {
    const deletedUserRoles = await prisma.userRole.deleteMany({
      where: { userId: { in: allMockUserIds } },
    });
    console.log(`Deleted UserRoles: ${deletedUserRoles.count}`);

    const deletedUsers = await prisma.user.deleteMany({
      where: { id: { in: allMockUserIds } },
    });
    console.log(`Deleted Users: ${deletedUsers.count}`);
  }

  console.log('--- PURGE COMPLETE ---');
  const remainingEmployees = await prisma.employee.count();
  const remainingUsers = await prisma.user.count();
  const remainingCompanies = await prisma.company.count();
  const remainingOffices = await prisma.officeLocation.count();
  const remainingShifts = await prisma.shift.count();

  console.log(`Remaining Companies: ${remainingCompanies}`);
  console.log(`Remaining Office Geofences: ${remainingOffices}`);
  console.log(`Remaining Shifts: ${remainingShifts}`);
  console.log(`Remaining Admins: ${remainingUsers}`);
  console.log(`Remaining Employees: ${remainingEmployees}`);
}

clearMockData()
  .catch((e) => {
    console.error('Error during cleanup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
