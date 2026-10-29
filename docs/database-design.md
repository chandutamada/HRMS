# Database Design Specification

## 1. Overview & DBMS Specifications

The HRMS database is hosted on **MySQL 8.4 LTS** and managed through **Prisma ORM**. The database schema is fully normalized, strongly typed, and enforces relational integrity via foreign key constraints, composite unique indexes, and audit logs.

### Database Attributes
- **Engine**: InnoDB (Default for MySQL 8.4 LTS).
- **Charset**: `utf8mb4` with `utf8mb4_unicode_ci` collation.
- **Connection**: Managed via Prisma Client connection pooling (`mysql://root:****@localhost:3306/hrms_db`).
- **Precision**:
  - Geographic Coordinates: `Decimal(10, 7)` providing sub-centimetre spatial resolution.
  - Financial & Payroll Amounts: `Decimal(12, 2)` preventing floating-point rounding errors.
  - Timezone: Stored consistently as `Asia/Kolkata` (UTC+05:30).

---

## 2. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    Company ||--o{ OfficeLocation : "operates"
    Company ||--o{ Department : "contains"
    Company ||--o{ Designation : "defines"
    Company ||--o{ Shift : "schedules"
    Company ||--o{ User : "authenticates"
    Company ||--o{ Employee : "employs"
    Company ||--o{ Holiday : "observes"
    Company ||--o{ LeaveType : "configures"
    Company ||--o{ PayrollPeriod : "runs"
    Company ||--o{ AuditLog : "tracks"

    OfficeLocation ||--o{ Employee : "assigned to"
    OfficeLocation ||--o{ GeofenceAuditLog : "audited by"
    OfficeLocation ||--o{ AttendanceEvent : "validates"

    Department ||--o{ Employee : "assigned"
    Designation ||--o{ Employee : "holds"
    Shift ||--o{ Employee : "assigned"

    User ||--o{ Role : "assigned"
    User ||--o{ RefreshToken : "possesses"
    User ||--o{ AuditLog : "initiates"

    Employee ||--o{ AttendanceRecord : "records daily"
    Employee ||--o{ AttendanceEvent : "punches"
    Employee ||--o{ AttendanceCorrectionRequest : "submits"
    Employee ||--o{ LeaveBalance : "maintains"
    Employee ||--o{ LeaveApplication : "requests"
    Employee ||--o{ SalaryStructure : "receives"
    Employee ||--o{ PayrollRecord : "generates"
    Employee ||--o{ CircularAcknowledgment : "acknowledges"
    Employee ||--o{ HelpdeskTicket : "creates"

    AttendanceRecord ||--o{ AttendanceEvent : "contains punches"
    LeaveType ||--o{ LeavePolicy : "governs"
    LeaveType ||--o{ LeaveBalance : "allocates"
    LeaveType ||--o{ LeaveApplication : "categorizes"
    
    Circular ||--o{ CircularTargetCompany : "targeted to"
    Circular ||--o{ CircularAcknowledgment : "acknowledged by"

    HelpdeskTicket ||--o{ HelpdeskMessage : "contains"
    PayrollPeriod ||--o{ PayrollRecord : "includes"
```

---

## 3. Module Schemas & Data Dictionary

### 3.1 Company & Organization Hierarchy

| Table | Primary Key | Key Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `companies` | `id` (UUID) | `code`, `name`, `status`, `legalName` | Represents corporate tenant (`SUPERBEE`, `GTIDS`, `GTIB`). |
| `offices` | `id` (UUID) | `companyId`, `code`, `latitude`, `longitude`, `radiusMeters` | Configures physical office coordinates and geofence radius (50m default). |
| `geofence_audit_logs` | `id` (UUID) | `officeId`, `oldRadius`, `newRadius`, `changedById` | Audit log tracking every geofence or coordinate change. |
| `departments` | `id` (UUID) | `companyId`, `name`, `code` | Organizational departments (Engineering, HR, Sales, etc.). |
| `designations` | `id` (UUID) | `companyId`, `title`, `code` | Organizational job titles. |
| `shifts` | `id` (UUID) | `companyId`, `startTime`, `endTime`, `gracePeriodMinutes`, `lateArrivalThresholdMinutes` | Shift schedules (e.g. Standard 09:00 - 17:30, 30m grace). |

### 3.2 Authentication & User Security

| Table | Primary Key | Key Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `users` | `id` (UUID) | `email`, `employeeId`, `passwordHash`, `roleId`, `isActive` | Central authentication identity for Mobile and Web users. |
| `roles` | `id` (UUID) | `name`, `description` | Roles: `SUPER_ADMIN`, `HR_ADMIN`, `HR_MANAGER`, `EMPLOYEE`. |
| `permissions` | `id` (UUID) | `action`, `resource` | Granular capability definitions. |
| `role_permissions` | `(roleId, permissionId)` | Composite PK | Role-to-permission mapping. |
| `refresh_tokens` | `id` (UUID) | `userId`, `tokenHash`, `expiresAt`, `isRevoked` | Secure refresh token rotation and revocation. |

### 3.3 Employee Profile & Lifecycle

| Table | Primary Key | Key Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `employees` | `id` (UUID) | `employeeId`, `companyId`, `officeId`, `departmentId`, `shiftId`, `reportingManagerId` | Comprehensive employee profile, employment history, bank, PF, and emergency contacts. |
| `employee_documents`| `id` (UUID) | `employeeId`, `fileName`, `fileType`, `storagePath` | Secure employee document store (resumes, ID proofs, certificates). |

### 3.4 Geofencing & Attendance

| Table | Primary Key | Key Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `attendance_records`| `id` (UUID) | `employeeId`, `date`, `firstCheckIn`, `lastCheckOut`, `totalWorkHours`, `status` | Daily summary records (`PRESENT`, `ABSENT`, `HALF_DAY`, `LATE`, `ON_LEAVE`, `HOLIDAY`). |
| `attendance_events` | `id` (UUID) | `attendanceRecordId`, `punchType`, `latitude`, `longitude`, `accuracy`, `distanceMeters`, `status` | Individual punch event capturing GPS coordinates and geofence outcome (`VALID`, `OUTSIDE_GEOFENCE`, `MOCKED_LOCATION`). |
| `attendance_corrections` | `id` (UUID) | `employeeId`, `requestDate`, `reason`, `status`, `reviewedById` | Employee requests for punch regularizations or eligible late exceptions. |

### 3.5 Leave Management & Holidays

| Table | Primary Key | Key Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `leave_types` | `id` (UUID) | `companyId`, `code`, `name`, `defaultDaysPerYear` | CL (Casual), SL (Sick), EL (Earned). |
| `leave_policies` | `id` (UUID) | `leaveTypeId`, `maxConsecutiveDays`, `requiresProof` | Granular rules for leave deduction. |
| `leave_balances` | `id` (UUID) | `employeeId`, `leaveTypeId`, `year`, `allocatedDays`, `usedDays`, `availableDays` | Current active leave credits. |
| `leave_applications`| `id` (UUID) | `employeeId`, `leaveTypeId`, `startDate`, `endDate`, `status`, `isHalfDay` | Formal leave requests with workflow approval and HR remarks. |
| `holidays` | `id` (UUID) | `companyId`, `name`, `date`, `isMandatory` | Company-specific and national holidays. |

### 3.6 Payroll Engine & Payslips

| Table | Primary Key | Key Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `salary_structures` | `id` (UUID) | `employeeId`, `basicMonthly`, `hraMonthly`, `specialAllowance`, `pfMonthly`, `effectiveFrom` | Employee salary breakdown. |
| `payroll_periods` | `id` (UUID) | `companyId`, `year`, `month`, `totalWorkingDays`, `status` | Monthly payroll cycle (`DRAFT`, `PROCESSING`, `FINALIZED`). |
| `payroll_records` | `id` (UUID) | `payrollPeriodId`, `employeeId`, `grossEarnings`, `lossOfPayAmount`, `netPayable`, `pdfPath` | Attendance-calculated payroll with LOP deductions and generated PDF path. |

### 3.7 Collaboration, Communication & Audit

| Table | Primary Key | Key Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `circulars` | `id` (UUID) | `title`, `content`, `publishedAt`, `expiresAt` | Organizational notices and policy announcements. |
| `circular_targets` | `(circularId, companyId)`| Composite PK | Target company assignment for circulars (`SUPERBEE`, `GTIDS`, `GTIB`). |
| `circular_acknowledgments` | `(circularId, employeeId)` | Composite PK | Tracks employee read and acknowledgment timestamps. |
| `notifications` | `id` (UUID) | `userId`, `title`, `message`, `type`, `isRead` | In-app notifications feed. |
| `helpdesk_tickets` | `id` (UUID) | `employeeId`, `category`, `subject`, `priority`, `status` | HR support tickets (e.g. Payroll, Attendance, General). |
| `helpdesk_messages` | `id` (UUID) | `ticketId`, `senderId`, `message` | Conversation thread on a support ticket. |
| `audit_logs` | `id` (UUID) | `companyId`, `actorId`, `action`, `resource`, `details`, `ipAddress` | Comprehensive audit trail for sensitive actions. |

---

## 4. Key Performance Indexes

To support rapid search and high-throughput mobile punch logging:

1. **Company Scoping**:
   - `CREATE INDEX idx_employees_company ON employees(company_id, status);`
   - `CREATE INDEX idx_attendance_records_emp_date ON attendance_records(employee_id, date);`
   - `CREATE INDEX idx_payroll_period ON payroll_periods(company_id, year, month);`
2. **Geofence Validation**:
   - `CREATE INDEX idx_attendance_events_record ON attendance_events(attendance_record_id, event_time);`
   - `CREATE INDEX idx_offices_company ON offices(company_id, is_active);`
3. **Leave Tracking**:
   - `CREATE UNIQUE INDEX idx_leave_balances_emp_type_year ON leave_balances(employee_id, leave_type_id, year);`

---

## 5. Migration & Maintenance Commands

```bash
# Generate Prisma Client after schema changes
npm.cmd run db:generate

# Push schema directly to MySQL 8.4 LTS
npm.cmd run db:push

# Seed database with initial companies, offices, admin and employee accounts
npm.cmd run db:seed
```
