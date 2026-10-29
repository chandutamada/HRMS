@echo off
title Android Studio & USB Reverse Port Forward
color 0A
echo ======================================================================
echo    FORWARDING PORT 4000 TO CONNECTED ANDROID PHONE OVER USB
echo ======================================================================
echo.
set ADB="C:\Users\chand\AppData\Local\Android\Sdk\platform-tools\adb.exe"

if exist %ADB% (
    %ADB% devices
    echo.
    echo Running: adb reverse tcp:4000 tcp:4000
    %ADB% reverse tcp:4000 tcp:4000
    echo.
    echo Reverse port forwarding active!
    echo On your Android phone, select 'localhost:4000' in the app to connect.
) else (
    echo adb.exe not found at standard path. Please ensure Android SDK is installed.
)
echo.
pause
