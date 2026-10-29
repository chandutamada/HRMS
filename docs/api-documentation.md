# REST API Documentation

## 1. Overview & Base Configuration

The HRMS REST API is built with **NestJS 10** and serves both the Next.js HR Web Dashboard and the Flutter Android application.

- **Base URL**: `http://localhost:4000/api`
- **Interactive Swagger Docs**: `http://localhost:4000/api/docs`
- **Format**: JSON (`Content-Type: application/json`)
- **Authentication**: Bearer Token in `Authorization` header (`Authorization: Bearer <access_token>`).

---

## 2. Standard Response Envelope

All API endpoints return responses structured with standard status envelopes:

```json
{
  "statusCode": 200,
  "message": "Operation successful",
  "data": { ... }
}
```

Error responses conform to:

```json
{
  "statusCode": 400,
  "message": "Detailed error message or validation errors array",
  "error": "Bad Request",
  "timestamp": "2026-10-16T02:00:00.000Z"
}
```

---

## 3. Authentication & Session Endpoints (`/api/auth`)

### 3.1 Login
- **Endpoint**: `POST /api/auth/login`
- **Access**: Public
- **Request Body**:
```json
{
  "identifier": "superadmin@hrms.internal", // or employee ID e.g., "SB-001"
  "password": "Password@123"
}
```
- **Response**:
```json
{
  "statusCode": 200,
  "data": {
    "user": {
      "id": "uuid",
      "email": "superadmin@hrms.internal",
      "employeeCode": "SA-001",
      "isSuperAdmin": true,
      "roles": ["SUPER_ADMIN"],
      "company": null,
      "employee": null
    },
    "tokens": {
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "4ff009...",
      "expiresIn": 3600
    }
  }
}
```

### 3.2 Refresh Token
- **Endpoint**: `POST /api/auth/refresh`
- **Request Body**:
```json
{
  "refreshToken": "7b8e..."
}
```

### 3.3 Get Profile
- **Endpoint**: `GET /api/auth/profile`
- **Headers**: `Authorization: Bearer <token>`

### 3.4 Change Password
- **Endpoint**: `POST /api/auth/change-password`
- **Request Body**:
```json
{
  "currentPassword": "Password@123",
  "newPassword": "NewStrongPassword@2026"
}
```

---

## 4. Office & Geofence Management (`/api/offices`)

### 4.1 List Offices
- **Endpoint**: `GET /api/offices`
- **Query Params**: `companyId` (optional for Super Admin)

### 4.2 Get Office Geofence Details
- **Endpoint**: `GET /api/offices/:id`

### 4.3 Update Office Geofence Configuration
- **Endpoint**: `PATCH /api/offices/:id/geofence`
- **Access**: `SUPER_ADMIN`, `HR_ADMIN`
- **Request Body**:
```json
{
  "latitude": 13.0498300,
  "longitude": 77.6202400,
  "radiusMeters": 50,
  "attendanceValidationEnabled": true,
  "reason": "Office entrance shifted to North Gate"
}
```

---

## 5. Attendance & Geofencing Endpoints (`/api/attendance`)

### 5.1 Mobile Attendance Punch
- **Endpoint**: `POST /api/attendance/punch`
- **Access**: `EMPLOYEE`
- **Request Body**:
```json
{
  "punchType": "CHECK_IN", // or "CHECK_OUT"
  "latitude": 13.0498300,
  "longitude": 77.6202400,
  "accuracy": 8.5
}
```
- **Success Response (Inside 50m Geofence)**:
```json
{
  "statusCode": 201,
  "data": {
    "status": "VALID",
    "distance": 0.6,
    "isWithinGeofence": true,
    "message": "Punch recorded successfully",
    "eventTime": "2026-10-16T09:12:44.000Z"
  }
}
```
- **Rejection Response (Outside Geofence)**:
```json
{
  "statusCode": 201,
  "data": {
    "status": "OUTSIDE_GEOFENCE",
    "distance": 185.7,
    "isWithinGeofence": false,
    "message": "Punch outside office geofence. Distance: 185.7m exceeds permitted 50m radius."
  }
}
```

### 5.2 Today's Attendance Status
- **Endpoint**: `GET /api/attendance/today`
- **Access**: Authenticated Employee

### 5.3 Attendance History
- **Endpoint**: `GET /api/attendance/history`
- **Query Params**: `month`, `year`

### 5.4 Live HR Attendance Monitor
- **Endpoint**: `GET /api/attendance/live`
- **Access**: `SUPER_ADMIN`, `HR_ADMIN`, `HR_MANAGER`
- **Query Params**: `companyId`, `date`, `departmentId`

### 5.5 Manual HR Attendance Override
- **Endpoint**: `POST /api/attendance/override`
- **Access**: `HR_ADMIN`, `SUPER_ADMIN`
- **Request Body**:
```json
{
  "attendanceRecordId": "uuid",
  "newStatus": "PRESENT",
  "reason": "Client onsite duty regularized"
}
```

### 5.6 Attendance Correction Request
- **Endpoint**: `POST /api/attendance/corrections/request`
- **Access**: `EMPLOYEE`
- **Request Body**:
```json
{
  "requestDate": "2026-10-15",
  "reason": "Biometric terminal outage at reception"
}
```

### 5.7 Review Attendance Correction
- **Endpoint**: `PATCH /api/attendance/corrections/:id/review`
- **Access**: `HR_ADMIN`, `SUPER_ADMIN`
- **Request Body**:
```json
{
  "status": "APPROVED", // or "REJECTED"
  "reviewRemarks": "Verified with floor manager"
}
```

---

## 6. Leave Desk Endpoints (`/api/leave`)

### 6.1 List Available Leave Types
- **Endpoint**: `GET /api/leave/types`

### 6.2 Get My Leave Balances
- **Endpoint**: `GET /api/leave/balances/my`

### 6.3 Apply for Leave
- **Endpoint**: `POST /api/leave/apply`
- **Request Body**:
```json
{
  "leaveTypeId": "uuid-for-casual-leave",
  "startDate": "2026-10-20",
  "endDate": "2026-10-21",
  "isHalfDay": false,
  "reason": "Personal family commitment"
}
```

### 6.4 Review Leave Application (HR)
- **Endpoint**: `PATCH /api/leave/requests/:id/review`
- **Access**: `HR_ADMIN`, `HR_MANAGER`, `SUPER_ADMIN`
- **Request Body**:
```json
{
  "status": "APPROVED", // or "REJECTED"
  "reviewRemarks": "Approved as per leave entitlement"
}
```

---

## 7. Calendar View (`/api/calendar`)

- **Endpoint**: `GET /api/calendar/view`
- **Query Params**:
  - `type`: `Holidays` | `Payslips` | `Attendance` | `Office Timing`
  - `year`: e.g. `2026`
  - `month`: e.g. `10`

---

## 8. Attendance-Linked Payroll (`/api/payroll`)

### 8.1 Run Payroll Calculation
- **Endpoint**: `POST /api/payroll/calculate`
- **Access**: `HR_ADMIN`, `SUPER_ADMIN`
- **Request Body**:
```json
{
  "companyId": "uuid",
  "year": 2026,
  "month": 10
}
```

### 8.2 Finalize Payroll
- **Endpoint**: `POST /api/payroll/finalize`
- **Request Body**:
```json
{
  "payrollPeriodId": "uuid"
}
```

### 8.3 Download PDF Payslip
- **Endpoint**: `GET /api/payroll/records/:id/payslip.pdf`
- **Response**: Binary PDF file (`Content-Type: application/pdf`)

---

## 9. Circulars & Policies (`/api/circulars`)

### 9.1 List Circulars
- **Endpoint**: `GET /api/circulars`

### 9.2 Create Circular (HR)
- **Endpoint**: `POST /api/circulars`
- **Access**: `HR_ADMIN`, `SUPER_ADMIN`
- **Request Body**:
```json
{
  "title": "Diwali Festival Office Schedule",
  "content": "Office will remain closed on November 1st for Diwali celebrations.",
  "targetCompanyIds": ["uuid-superbee", "uuid-gtids", "uuid-gtib"],
  "expiresAt": "2026-11-05T23:59:59.000Z"
}
```

### 9.3 Acknowledge Circular (Employee)
- **Endpoint**: `POST /api/circulars/:id/acknowledge`

---

## 10. Helpdesk Tickets (`/api/helpdesk`)

- `POST /api/helpdesk`: Create support ticket.
- `GET /api/helpdesk`: List user or company tickets.
- `POST /api/helpdesk/:id/reply`: Add conversation response message.
- `PATCH /api/helpdesk/:id/status`: Update status (`OPEN`, `RESOLVED`, `CLOSED`).

---

## 11. Reports & Audit Trail (`/api/reports` & `/api/audit`)

- `GET /api/reports/headcount`: Departmental employee counts.
- `GET /api/reports/geofence`: Geofence validation statistics.
- `GET /api/reports/attendance/csv`: Download attendance report as CSV.
- `GET /api/audit`: Paginated audit log of all system changes.
