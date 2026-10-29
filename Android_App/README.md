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

- **Via USB Cable**:
  - Connect phone with USB debugging enabled.
  - Double-click `CONNECT_DEVICE_PORT_FORWARD.bat` in this folder (or run `adb reverse tcp:4000 tcp:4000`).
  - On the app login screen, tap the **`localhost:4000`** chip.
- **Via Local Wi-Fi**:
  - Connect your phone to the same Wi-Fi as your PC.
  - Select **`172.16.200.156:4000`** on the app login screen.

---

### Default Credentials
- **Email / ID**: `hr@gramtarang.org` (or `SB-001`)
- **Password**: `Password@123`
