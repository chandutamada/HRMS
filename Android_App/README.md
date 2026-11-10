# Superbee Aeronautics — Android Mobile App

This folder is a standalone **Flutter & Android** mobile project.

---

### How to Open & Run in Android Studio

1. Open **Android Studio**.
2. Click **File → Open...** (or *Open* from the welcome screen).
3. Select this folder directly:
   ```
   C:\Users\chand\OneDrive\Desktop\HR-APPLICATION\Android_App
   ```
4. Wait for Android Studio to index Dart/Flutter dependencies and Gradle.
5. Select your connected Android phone or emulator in the device selector dropdown.
6. Click the green **Run (Play)** button or press `Shift + F10`.

---

### Connecting Phone to Backend API

- **Via Production Server (Default Live Environment)**:
  - Select **`Production (fieldtracking)`** (`https://fieldtracking.gramtarang.org/api`) on the login screen for direct live cloud connection.
- **Via USB Cable (Local Testing)**:
  - Connect phone with USB debugging enabled.
  - Double-click `CONNECT_DEVICE_PORT_FORWARD.bat` in this folder (or run `adb reverse tcp:4000 tcp:4000`).
  - On the app login screen, tap the **`USB / ADB Localhost`** chip (`http://localhost:4000/api`).
- **Via Local Wi-Fi**:
  - Connect your phone to the same Wi-Fi as your development PC.
  - Select the **`Wi-Fi PC`** chip on the app login screen.
- **Via Android Emulator**:
  - Select the **`Emulator`** chip (`http://10.0.2.2:4000/api`).

---

### Key Capabilities & Architecture
- **100% Dynamic Synchronization (Zero Mock Data)**:
  - Attendance transactions and historical punches from `/attendance/history`.
  - Leave balances and applications from `/leave/balances/my` and `/leave/applications/my`.
  - Pending manager approvals (Leaves, Regularizations, Live Field Team) synced via `/leave/applications`, `/attendance/corrections/pending`, and `/tracking/team/live`.
  - Colleague directory and org structure dynamically queried from `/employees`.
  - Calendar holidays synchronized with the central company `/calendar/holidays` schedule.
- **Anti-Spoofing & Geofencing**: Strict Haversine geofence calculation with hardware-level mock GPS detection.
- **Biometric Authentication**: Fingerprint and Face Unlock support via `local_auth` and encrypted JWT keystore storage.

---

### Default Credentials
- **Email / ID**: `hr@gramtarang.org` (or `SB-001`)
- **Password**: `Password@123`
