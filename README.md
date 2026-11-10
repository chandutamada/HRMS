# HRMS & Field Workforce Management System

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![NestJS 11](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs)](https://nestjs.com/)
[![Flutter 3](https://img.shields.io/badge/Flutter-3.x-02569B?logo=flutter)](https://flutter.dev/)
[![Prisma ORM](https://img.shields.io/badge/Prisma-6.4-2D3748?logo=prisma)](https://www.prisma.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?logo=socketdotio)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)

A cloud-native, full-stack **Human Resource Management System (HRMS) & Real-Time Field Operations Platform** engineered for modern enterprises managing both stationary office personnel and mobile field operational teams (e.g., aeronautical engineers, drone pilots, and field technicians).

The platform bridges real-time mobile telemetry with core HR administration:
- **Mobile First**: Geofenced punch in/out with Haversine distance validation, biometric authentication (fingerprint/face unlock), field route GPS telemetry, and instant employee self-service (leaves, regularizations, and payslips).
- **Administrative Precision**: Multi-tenant enterprise hierarchy, automated attendance derivation, unapproved absence / Loss of Pay (LOP) salary deductions, automated payroll calculation, PDF generation, and real-time live map tracking with OSRM road-snapping.

---

## System Architecture

```mermaid
flowchart TD
    subgraph MobileApp["📱 Android Mobile Client (Flutter)"]
        MA1[Geofenced Punch In/Out]
        MA2[Biometric Auth & Local Storage]
        MA3[GPS Telemetry & Waypoint Logging]
        MA4[Self-Service: Leaves & Payslips]
    end

    subgraph WebApp["💻 HR & Admin Web Portal (Next.js 14)"]
        WA1[Live Operations Dashboard]
        WA2[Offices & Geofence Manager]
        WA3[Attendance & Regularization Hub]
        WA4[Payroll Engine & LOP Manager]
        WA5[Live Field Map & Route Playback]
    end

    subgraph BackendAPI["⚙️ Backend Core API (NestJS 11)"]
        API1[Auth & RBAC Guards]
        API2[Attendance & Geofence Engine]
        API3[OSRM Road-Snapping & Tracking Service]
        API4[Payroll & PDFKit Engine]
        API5[Socket.io Real-Time Gateway]
    end

    subgraph Database["🗄️ Relational Storage (Prisma ORM)"]
        DB[(PostgreSQL / TiDB Database)]
    end

    MobileApp -->|HTTPS REST & Bearer JWT| BackendAPI
    WebApp -->|HTTPS REST & WebSockets| BackendAPI
    BackendAPI -->|Prisma Client Queries| Database
    MobileApp -.->|Live Location Pings| BackendAPI
    BackendAPI -.->|Real-Time Telemetry Broadcast| WebApp
```

---

## End-to-End Operational Flow

```mermaid
sequenceDiagram
    autonumber
    actor Emp as 📱 Employee (Mobile App)
    participant API as ⚙️ NestJS API Server
    participant DB as 🗄️ Prisma Database
    actor HR as 💻 HR Admin (Web Portal)

    %% 1. Geofenced Punch
    Note over Emp, HR: 1. Geofenced Attendance Validation
    Emp->>API: POST /attendance/punch (lat, lng, deviceId)
    API->>DB: Query assigned Office Geofence & Shift Window
    DB-->>API: Coordinates within 50m radius (Haversine formula)
    API->>DB: Upsert AttendanceRecord (Status: PRESENT)
    API-->>Emp: 200 OK (Punch In Recorded)
    API-->>HR: Push Real-Time Attendance Notification

    %% 2. Live Field Tracking
    Note over Emp, HR: 2. Field Telemetry & Real-Time Tracking
    Emp->>API: POST /tracking/ping (lat, lng, speed, battery)
    API->>API: OSRM Road-Snapping & Polyline Reconstruction
    API->>DB: Store TrackingPoint
    API-->>HR: Broadcast live location via WebSocket (Socket.io)

    %% 3. Unapproved Absence & LOP Detection
    Note over Emp, HR: 3. Unapproved Absence & LOP Detection
    Emp->>Emp: Takes unapproved absence (no leave request)
    HR->>API: GET /payroll/monthly-overview (Year: 2026, Month: 10)
    API->>DB: Scan attendance records for unapproved ABSENT days
    API-->>HR: Return Overview: Auto-detected LOP Days per Employee

    %% 4. Salary Setup & Finalization
    Note over HR, Emp: 4. Payroll Run & Automated LOP Deduction
    HR->>HR: Review Salary Setup (Auto-populated LOP Days)
    HR->>API: POST /payroll/individual-generate or PUT /finalize-all
    API->>API: Compute: Net Pay = Gross - (PerDayRate * LOPDays) - Statutory Deductions
    API->>DB: Commit PayrollRecord & Itemized LOP Deductions
    API->>API: Compile Official PDF Payslip via PDFKit
    API-->>HR: Payslips Finalized & Published

    %% 5. Mobile Payslip Retrieval
    Note over Emp: 5. Mobile Payslip Retrieval
    Emp->>API: GET /payroll/payslips/my
    API->>DB: Fetch Published & Finalized Payslips
    API-->>Emp: Return Payslip (Net Take-Home reflects LOP & Allowances)
```

---

## Key Modules & Core Capabilities

### 1. 📱 Android Mobile Application (`Android_App/`)
- **Biometric Security**: Hardware fingerprint and facial recognition login using `local_auth` and encrypted JWT key storage (`flutter_secure_storage`).
- **Geofenced Punch In/Out**: Real-time GPS verification against corporate office geofences using the Haversine spherical distance formula.
- **Field Telemetry & Route Logging**: Background GPS waypoint recording with battery monitoring and automatic retry mechanisms.
- **Employee Self-Service**:
  - Apply for Casual, Sick, or Earned leaves with real-time balance tracking.
  - Submit attendance regularizations with custom justifications.
  - View published monthly payslips with a single-year calendar filter (e.g., `2026`) and itemized earnings/deductions breakdown.
- **Multi-Environment Switcher**: One-tap server switching between Live Cloud (Render), Localhost (USB Port Forwarding), and Local Wi-Fi.

### 2. 💻 Web Administration Portal (`Web_App/apps/web/`)
- **Executive Operations Dashboard**: Live workforce metrics, today's presence percentage, late arrivals, on-leave employees, and pending approvals.
- **Offices & Geofence Manager**: Visual map interface to configure office locations, coordinates (Latitude/Longitude), and custom boundary radii (default 50m).
- **Attendance & Regularization Hub**: Daily, monthly, and in/out attendance audits with 1-click approvals/rejections for regularization requests.
- **Enterprise Payroll Engine**:
  - Salary structure configuration (Basic, HRA, DA, Conveyance, Special Allowances).
  - Statutory deduction automation: EPF (12%), ESI (0.75%), Professional Tax (PT), and TDS withholding.
  - **Automated Loss of Pay (LOP)**: Auto-derives unapproved absences from daily attendance, calculates per-day salary rate, and applies strict per-employee isolated deductions.
  - Bulk Excel/CSV upload, batch payroll runs, and instant mobile publishing.
- **Live Field Tracking & Route Playback**:
  - OpenStreetMap & Leaflet integration with **OSRM road-snapped polyline reconstruction**.
  - Distinct visual markers for field personnel vs. office employees.
  - Variable speed route replay (`1x`, `2x`, `5x`) with timeline pins, speed telemetry, and IST-formatted timestamps.

### 3. ⚙️ High-Performance Backend API (`Web_App/apps/api/`)
- **Architecture**: Modular NestJS 11 with strict dependency injection, DTO validation (`class-validator`), and JWT role-based access guards (`SUPER_ADMIN`, `HR_ADMIN`, `HR_MANAGER`, `EMPLOYEE`).
- **Real-Time Gateway**: Low-latency WebSocket gateway (`socket.io`) for live telemetry streaming to admin consoles.
- **PDF Generation Engine**: Programmatic server-side payslip generation via `pdfkit` complete with company branding and itemized tax breakdowns.
- **Automated Schedulers**: Background cron jobs (`@nestjs/schedule`) for midnight attendance roll-ups and shift closures.

---

## Complete Technology Stack

| Domain | Technology / Library | Description |
| :--- | :--- | :--- |
| **Mobile Frontend** | Flutter 3.x / Dart | Cross-platform native mobile application |
| **Mobile Networking** | `dio: ^5.7.0` | HTTP client with JWT interceptors & error handlers |
| **Mobile Security** | `flutter_secure_storage: ^9.2.2` | Encrypted device keystore token persistence |
| **Mobile Biometrics** | `local_auth: ^2.3.0` | Fingerprint & facial recognition hardware auth |
| **Mobile Geolocation**| `geolocator: ^13.0.2` | High-accuracy GPS positioning |
| **Web Frontend** | Next.js 14 (App Router) | React Server Components, responsive SaaS UI |
| **Web Styling** | Tailwind CSS 3.4 & Lucide Icons | Enterprise design system |
| **Web Mapping** | Leaflet 1.9 & Google Maps API | Interactive maps, geofences & telemetry replay |
| **Backend Core** | NestJS 11.0 / Node.js | Modular REST API & WebSocket server |
| **Database & ORM** | Prisma ORM 6.4 & PostgreSQL / TiDB | Relational SQL database with strict migrations |
| **Real-Time Engine** | Socket.io 4.8 | Bidirectional event-based telemetry streaming |
| **PDF Engine** | PDFKit 0.16 | Server-side cryptographic payslip generation |
| **API Docs** | Swagger / OpenAPI 3.0 | Interactive endpoint testing suite |

---

## Workspace Structure

The project has been systematically organized into standalone, dedicated workspaces:

```
HR-APPLICATION/
├── Android_App/               <-- Standalone Flutter & Android Mobile Application
│   ├── lib/                   <-- Flutter screens, providers, models & services
│   ├── android/               <-- Native Android Gradle wrapper & manifests
│   └── CONNECT_DEVICE_PORT_FORWARD.bat
├── Web_App/                   <-- Standalone Next.js Web Portal, NestJS API & Database
│   ├── apps/
│   │   ├── api/               <-- NestJS Backend API & WebSockets (Port 4000)
│   │   └── web/               <-- Next.js 14 Web Portal (Port 3000)
│   ├── packages/
│   │   └── database/          <-- Prisma ORM schema, migrations & seed scripts
│   ├── uploads/               <-- Local file upload storage directory
│   └── START_ALL.bat          <-- 1-Click launcher for Web Portal & API
├── docs/                      <-- Complete Engineering Specifications & User Guides
│   ├── APPLICATION_SPECIFICATION_AND_USER_GUIDE.md  <-- Master System & User Guide
│   ├── api-documentation.md   <-- API Endpoints, Request/Response DTOs
│   ├── architecture.md        <-- Architectural diagrams & component designs
│   ├── database-design.md     <-- Complete ER diagrams & table structures
│   ├── setup-guide.md         <-- Local environment installation instructions
│   └── deployment-guide.md    <-- Cloud hosting & container deployment guide
├── RUN_WEBPAGE.bat            <-- 1-Click Root Launcher for Web Portal & Backend API
└── RUN_ANDROID.bat            <-- 1-Click Root Launcher for Android Studio & ADB
```

---

## Self-Hosted Production Deployment & Endpoints

| Service | Environment | URL / Endpoint |
| :--- | :--- | :--- |
| **Web Portal Dashboard** | Production (Nginx) | `https://fieldtracking.gramtarang.org` |
| **Backend REST API**     | Production (Nginx) | `https://fieldtracking.gramtarang.org/api` |
| **WebSocket Gateway**    | Production (Nginx) | `wss://fieldtracking.gramtarang.org` |
| **Swagger OpenAPI**      | Production (Nginx) | `https://fieldtracking.gramtarang.org/api/docs` |
| **Local Web Portal**     | Localhost          | `http://localhost:3000` (or `http://localhost:3001` standalone) |
| **Local Backend API**    | Localhost          | `http://localhost:4000/api` (or `http://localhost:3000/api`) |

---

## Production Server Deployment (PM2 + Nginx + Native MySQL)

This application is 100% self-hosted and vendor-agnostic (zero dependencies on Render, Vercel, or TiDB).

### 1. Database Setup (MySQL 8.0 / 8.4)
On your Ubuntu/Debian production server:
```bash
# Create database
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS hrms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Import the complete pre-seeded production database dump
mysql -u root -p hrms_db < database_dump.sql
```

### 2. Configure Environment
Copy `.env.example` to `.env.production` at the repository root and customize credentials:
```bash
cp .env.example .env.production
nano .env.production
```

### 3. Build & Launch with PM2
```bash
# 1. Install dependencies
cd Web_App
npm install

# 2. Build Backend API and Standalone Web Portal
npm run api:build
npm run web:build

# 3. Launch both services using the included PM2 configuration
cd ..
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 4. Configure Nginx Reverse Proxy
Copy the provided [nginx.conf](file:///nginx.conf) to your Nginx sites directory:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/fieldtracking.gramtarang.org
sudo ln -s /etc/nginx/sites-available/fieldtracking.gramtarang.org /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Getting Started Locally

### Prerequisites
- **Node.js**: `v18.x` or `v20.x`
- **Flutter SDK**: `v3.x`
- **Database**: PostgreSQL or MySQL / TiDB instance

### Option 1: 1-Click Launchers (Windows)
- **Run Web Portal & Backend API**: Double-click `RUN_WEBPAGE.bat` in the root folder.
- **Run Android Studio**: Double-click `RUN_ANDROID.bat` in the root folder.
- **Connect Physical Device over USB**: Double-click `CONNECT_DEVICE_PORT_FORWARD.bat` in `Android_App/` to forward port 4000.

### Option 2: Terminal Execution

#### 1. Start Web Portal & Backend API:
```bash
cd Web_App

# Install dependencies
npm install

# Setup Prisma Database
npx prisma generate --schema=./packages/database/prisma/schema.prisma
npx prisma db push --schema=./packages/database/prisma/schema.prisma

# Start Backend API (Port 4000)
npm run api:dev

# In a separate terminal, start Next.js Web Portal (Port 3000)
npm run web:dev
```

#### 2. Start Android Mobile App:
```bash
cd Android_App

# Get Flutter packages
flutter pub get

# Run on connected device or emulator
flutter run
```

---

## System Credentials

| Role | Email / Identifier | Employee Code | Strong Password | Access Scope |
| :--- | :--- | :--- | :--- | :--- |
| **HR Administrator** | `hr@gramtarang.org` | `SB-001` | `HrAdmin@GramTarang2026!` | Full HR portal, payroll runs, attendance geofence, live field tracking & mobile punch |
| **Super Admin**      | `superadmin@superbeeaeronautics.com` | `ADMIN-001` | `SuperAdmin@FieldTrack2026#` | Global multi-company administration, tenant config, and full HR access |
| **Field Officer**    | `venkat@gramtarang.org` | `SB-002` | `Password@123` | Mobile punch, GPS waypoint tracking & field duty |
| **Employee**         | `chandutamada4@gmail.com` | `SB-004` | `Password@123` | Geofenced office punch, leave requests & payslip viewing |

---

## System Documentation Index

For detailed engineering deep-dives, consult the files in `docs/`:
- [Master Application Specification & User Guide](file:///docs/APPLICATION_SPECIFICATION_AND_USER_GUIDE.md) — Comprehensive technical workflows, HR walkthroughs, and FAQs.
- [Architecture & Flow Design](file:///docs/architecture.md) — Multi-tier architectural specifications.
- [API Documentation](file:///docs/api-documentation.md) — Full endpoint contracts, request schemas, and responses.
- [Database Schema Design](file:///docs/database-design.md) — Relational ER diagrams, indexing strategies, and model definitions.
- [Deployment Guide](file:///docs/deployment-guide.md) — Docker, reverse-proxy, and cloud deployment procedures.
