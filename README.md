# Superbee Aeronautics — HRMS Application

The project has been systematically segregated into dedicated, standalone workspaces for **Android** and **Webpage**:

```
HR-APPLICATION/
├── Android_App/               <-- Standalone Flutter & Android Mobile Application
├── Web_App/                   <-- Standalone Next.js Web Portal, NestJS API & Database
├── docs/                      <-- System Architecture, Database Design & API Documentation
├── RUN_WEBPAGE.bat            <-- 1-Click Launcher to run the Webpage & Backend API
├── RUN_ANDROID.bat            <-- 1-Click Launcher to start Android Studio & Port Forwarding
└── _archive/                  <-- Archived legacy monorepo & scratch tools
```

---

### 1. Android Mobile App (`Android_App/`)
- **Technology**: Flutter (Dart) & Android Native SDK.
- **How to Run**:
  - **Option 1**: Double-click `RUN_ANDROID.bat` in the root folder.
  - **Option 2**: Open **Android Studio** → **File → Open** → select `Android_App`.
- **Physical Device over USB**: Double-click `CONNECT_DEVICE_PORT_FORWARD.bat` inside `Android_App/` to forward port `4000`.

---

### 2. Web Portal & Backend API (`Web_App/`)
- **Technology**: Next.js 14 (Frontend), NestJS (Backend REST API & WebSockets), Prisma ORM & MySQL.
- **Includes**: Web portal (`apps/web`), API (`apps/api`), database schema (`packages/database`), and file uploads (`uploads/`).
- **How to Run**:
  - **Option 1 (1-Click)**: Double-click `RUN_WEBPAGE.bat` in the root folder (or `START_ALL.bat` inside `Web_App/`).
  - **Option 2 (Terminal)**:
    ```bash
    cd Web_App
    npm run api:dev    # Starts API on http://localhost:4000/api
    npm run web:dev    # Starts Web on http://localhost:3000
    ```
- **Access URLs**:
  - Web Portal: [http://localhost:3000](http://localhost:3000)
  - Backend API: [http://localhost:4000/api](http://localhost:4000/api)
  - Swagger Documentation: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

---

### 3. Documentation (`docs/`)
Contains complete markdown specifications:
- `api-documentation.md`: Endpoints and DTO definitions.
- `architecture.md`: System design and component diagrams.
- `database-design.md`: Tables, relationships, and ER schemas.
- `setup-guide.md` & `deployment-guide.md`: Installation and deployment procedures.

---

### Default Credentials
- **HR Admin Email**: `hr@gramtarang.org`
- **Employee ID**: `SB-001`
- **Password**: `Password@123`
