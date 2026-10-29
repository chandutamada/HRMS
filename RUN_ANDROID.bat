@echo off
title HRMS Android Studio Launcher
color 0B
echo ======================================================================
echo    SUPERBEE AERONAUTICS - ANDROID MOBILE APP LAUNCHER
echo ======================================================================
echo.

set STUDIO="C:\Program Files\Android\Android Studio\bin\studio64.exe"
set ADB="C:\Users\chand\AppData\Local\Android\Sdk\platform-tools\adb.exe"

if exist %ADB% (
    echo [1/2] Connecting to ADB and checking connected devices...
    %ADB% devices
    echo.
    echo [2/2] Forwarding port 4000 for backend communication...
    %ADB% reverse tcp:4000 tcp:4000 >nul 2>&1
    echo Port forward active (tcp:4000 -^> tcp:4000).
) else (
    echo [Notice] ADB platform-tools not found at default location.
)

echo.
if exist %STUDIO% (
    echo Opening Android_App in Android Studio...
    start "" %STUDIO% "%~dp0Android_App"
) else (
    echo Android Studio not found at default path.
    echo Please open Android Studio manually and open the 'Android_App' folder.
)

echo.
echo Ready!
timeout /t 3 /nobreak >nul
exit
