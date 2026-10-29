# Superbee Aeronautics — HRMS Web Portal & Backend API

This folder contains the complete Web Portal and Backend API system.

---

### Folder Structure
- `apps/web`: Next.js 14 frontend web application (`http://localhost:3000`).
- `apps/api`: NestJS enterprise backend API (`http://localhost:4000/api`).
- `packages/database`: Prisma ORM schema & MySQL database configurations.

---

### How to Run

#### Option 1: 1-Click Launch (Recommended)
Double-click `START_ALL.bat` in this folder (or `RUN_WEBPAGE.bat` in the root folder).
This opens the Backend API and Web Portal simultaneously and launches your browser at `http://localhost:3000`.

#### Option 2: Running from Terminal
```powershell
cd C:\Users\chand\OneDrive\Desktop\HR-APPLICATION\Web_App

# Start Backend API
npm run api:dev

# In a second terminal, start Next.js Web Portal
npm run web:dev
```

---

### URLs & Ports
- **Web Portal**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:4000/api](http://localhost:4000/api)
- **Swagger Documentation**: [http://localhost:4000/api/docs](http://localhost:4000/api/docs)

---

### Default Credentials
- **Admin Email**: `hr@gramtarang.org`
- **Employee Code**: `SB-001`
- **Password**: `Password@123`
