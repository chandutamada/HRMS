# Local Setup & Development Guide

## 1. System Requirements & Prerequisites

Ensure the following tools are installed on your workstation:

| Component | Minimum Version | Verified Local Environment |
| :--- | :--- | :--- |
| **Operating System** | Windows 10/11, macOS, or Ubuntu 22.04+ | Windows 11 64-bit |
| **Node.js** | Node.js 18.x or 20.x LTS | Node.js v20.x (x64) |
| **Package Manager** | npm 9+ | npm (use `npm.cmd` on Windows) |
| **Database** | MySQL 8.4 LTS | MySQL 8.4.9 on Port 3306 |
| **Flutter SDK** | Flutter 3.22+ & Dart 3.4+ | Flutter 3.27+ |
| **Android SDK** | Android API Level 34 (Android 14) | Android SDK Build-Tools 34.0.0 |
| **Java** | JDK 17 (recommended for Gradle) | OpenJDK 17 |

> [!IMPORTANT]
> **Windows PowerShell Execution Policy**:
> On Windows systems where `.ps1` execution is restricted, always invoke package commands using `npm.cmd` and `npx.cmd`.

---

## 2. Environment Variables Configuration

### 2.1 Monorepo Root & API Configuration (`.env` and `apps/api/.env`)

Ensure the root `.env` or `apps/api/.env` has the following keys:

```env
# Database Connection (MySQL 8.4 LTS)
DATABASE_URL="mysql://root:Chanduu%40444444@localhost:3306/hrms_db?schema=public&connection_limit=10"

# Server Port & Host
PORT=4000
NODE_ENV=development

# JWT Authentication
JWT_ACCESS_SECRET="hrms_super_secret_jwt_access_key_2026_production"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_SECRET="hrms_super_secret_jwt_refresh_key_2026_production"
JWT_REFRESH_EXPIRES_IN="7d"

# CORS Allowed Origins
CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"

# Timezone standard
TZ="Asia/Kolkata"

# Google Maps API (Optional for server geocoding)
GOOGLE_MAPS_API_KEY=""
```

### 2.2 Next.js HR Web Admin Configuration (`apps/web/.env.local`)

Create or verify `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
```

> [!NOTE]
> When `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is omitted or empty, the web dashboard automatically activates an interactive vector radar preview that accurately visualizes the 50m geofence radius.

---

## 3. Database Initialization & Seeding

1. Open PowerShell and navigate to the project directory:
   ```powershell
   cd c:\Users\chand\OneDrive\Desktop\HR-APPLICATION
   ```

2. Generate the Prisma Client:
   ```powershell
   npm.cmd run db:generate
   ```

3. Push the schema into MySQL 8.4 LTS:
   ```powershell
   npm.cmd run db:push
   ```

4. Populate the database with initial companies, offices, shifts, admin accounts, and employees:
   ```powershell
   npm.cmd run db:seed
   ```

---

## 4. Starting the Services

### 4.1 Launch NestJS REST API
In a new terminal window:
```powershell
cd c:\Users\chand\OneDrive\Desktop\HR-APPLICATION\apps\api
npm.cmd run dev
```
- API will be accessible at: `http://localhost:4000/api`
- Swagger OpenAPI Explorer: `http://localhost:4000/api/docs`

### 4.2 Launch Next.js HR Web Admin
In a separate terminal window:
```powershell
cd c:\Users\chand\OneDrive\Desktop\HR-APPLICATION\apps\web
npm.cmd run dev
```
- Open browser at: `http://localhost:3000`

### 4.3 Launch Flutter Android Application
1. Connect an Android device with USB Debugging enabled, or launch an Android Virtual Device (AVD).
2. Configure your local machine's IP in `apps/mobile/lib/services/api_service.dart` (Default for Android emulator: `http://10.0.2.2:4000/api`).
3. Run the Flutter app:
```powershell
cd c:\Users\chand\OneDrive\Desktop\HR-APPLICATION\apps\mobile
flutter run
```

---

## 5. Pre-Configured Test Accounts

| Role | Company | Email / Identifier | Password | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | *Global* | `superadmin@hrms.internal` | `Admin@123456` | Unrestricted global multi-company access. |
| **HR Admin** | SUPERBEE | `hr.superbee@hrms.internal` | `Password@123` | HR administrator for Bangalore Tech Park. |
| **HR Admin** | GTIDS | `hr.gtids@hrms.internal` | `Password@123` | HR administrator for Hyderabad Hitec City. |
| **HR Admin** | GTIB | `hr.gtib@hrms.internal` | `Password@123` | HR administrator for Mumbai BKC. |
| **Employee** | SUPERBEE | `SB-001` or `arun.kumar@superbee.internal` | `Password@123` | Senior Software Engineer at Superbee. |
| **Employee** | SUPERBEE | `SB-002` or `priya.sharma@superbee.internal` | `Password@123` | UI/UX Designer at Superbee. |
| **Employee** | GTIDS | `GT-001` or `vikram.reddy@gtids.internal` | `Password@123` | Cloud Architect at GTIDS. |
| **Employee** | GTIB | `GB-001` or `neha.patel@gtib.internal` | `Password@123` | Financial Analyst at GTIB. |
