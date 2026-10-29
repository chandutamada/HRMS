# Privacy, Security & Compliance Policy

## 1. Employee Location Privacy Framework

The HRMS platform enforces an **Event-Based Location Collection Policy**. Safeguarding employee privacy while maintaining attendance integrity is a core architectural requirement.

### 1.1 Strict Privacy Principles
1. **No Background Tracking**:
   - The Flutter mobile application **never** tracks employee movements in the background.
   - There is no background location service, no movement timeline, and no live geolocation map of employees.
2. **Explicit User-Triggered Punches**:
   - Device coordinates are requested **strictly** when an employee explicitly taps the "Check In", "Check Out", or "Regularize Punch" buttons.
3. **Data Purpose Limitation**:
   - Location data is utilized solely to calculate the Haversine distance to the employee's assigned office and determine whether the punch was inside the configured radius (default 50m).
4. **Data Retention & Pruning**:
   - High-precision GPS coordinates (`Decimal(10, 7)`) in `attendance_events` are retained for active operational auditing (90 days).
   - Historical aggregate status (`PRESENT`, `ABSENT`, `HALF_DAY`, `LATE`) is retained permanently in `attendance_records` for statutory compliance and payroll history.

---

## 2. In-App Employee Privacy Notice

The Flutter application surfaces the following transparent notice during permission onboarding and in the profile/settings view:

> **Employee Privacy Notice**:
> *"HRMS requires location access solely to verify that your attendance check-in or check-out occurs within your company's authorized office geofence. Your location is read only at the instant you tap the punch button. The application does not monitor your location while closed or running in the background."*

---

## 3. Application & Infrastructure Security Architecture

### 3.1 Authentication & Session Management
- **Passwords**: Hashed with `bcrypt` using 10 salt rounds. Plaintext passwords are never logged or stored.
- **Short-Lived Access Tokens**: Signed JWTs with a 15-minute lifespan containing `sub` (userId), `role`, `companyId`, and `employeeId`.
- **Refresh Token Rotation**:
  - Refresh tokens have a 7-day lifespan and are stored in the MySQL database (`refresh_tokens` table).
  - Upon token refresh, the previous token is marked `isRevoked = true`, and a new pair is issued.
  - Logging out immediately marks active refresh tokens revoked in the database.
- **Secure Storage**:
  - Mobile client: Tokens stored using `flutter_secure_storage` backed by Android Keystore (hardware-backed AES encryption).
  - Web client: Tokens stored in secure HTTP-only cookies or encrypted session state.

### 3.2 Multi-Company Data Isolation Guard
Cross-company data leakage is structurally prevented at the API layer:
```typescript
@Injectable()
export class CompanyIsolationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Super Admin has global visibility across companies
    if (user.role === 'SUPER_ADMIN') return true;

    // HR Admins and Employees can only query their assigned company
    const targetCompanyId = request.params.companyId || request.query.companyId || request.body.companyId;
    if (targetCompanyId && targetCompanyId !== user.companyId) {
      throw new ForbiddenException('Access denied: You are not authorized to access data for another company.');
    }
    return true;
  }
}
```

### 3.3 Protection Against GPS Spoofing & Mock Locations
While operating system-level location mocks cannot be 100% prevented on rooted hardware, the system includes multiple defensive layers:
1. **Event Accuracy Filtering**: Events with an accuracy threshold exceeding $\pm 100\text{ m}$ are marked as untrusted and flagged for HR review.
2. **Server-Side Verification**: Client coordinates are validated only by calculating distances against the server-persisted office coordinates.
3. **Suspicious Event Logging**: Repeated rejected attempts from coordinates far outside the city boundary trigger audit alerts in the HR dashboard.
4. **Audit Trail**: Every punch attempt (whether accepted or rejected) is permanently logged with distance and timestamp for manual review.

### 3.4 Rate Limiting & Network Defenses
- **Throttler Guard**: API routes are rate-limited to 60 requests per minute per IP address, with sensitive authentication endpoints limited to 5 attempts per minute.
- **Security Headers (Helmet)**: Enforces `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and Content Security Policies.
- **Zero Third-Party Tracking**: No external Firebase trackers, advertising IDs, or telemetry libraries are bundled in the application.

---

## 4. Audit Trail & Sensitive Operation Logs

The system records all high-privilege operations in the `audit_logs` table:

1. **Geofence Changes**: Logs previous radius, updated radius, editor identity, and justification reason.
2. **Attendance Overrides**: Logs manual status modifications and HR justification remarks.
3. **Salary Changes**: Logs modifications to basic, allowances, and deduction structures.
4. **Payroll Finalization**: Logs the exact timestamp, period, and user locking the payroll run.
