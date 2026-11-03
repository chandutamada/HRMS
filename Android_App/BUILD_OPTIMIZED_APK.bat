@echo off
setlocal
cd /d "%~dp0"

echo ==========================================================
echo   Superbee HRMS Mobile - Optimized Release Build
echo ==========================================================
echo.
echo 1. Build Split-per-ABI APKs (Recommended for direct install: ~18 MB each)
echo 2. Build Universal Release APK (All-in-one APK: ~40-45 MB)
echo 3. Build Google Play App Bundle (.aab) (Recommended for Play Store: ~15 MB user download)
echo.

set /p choice="Select build option (1, 2, or 3): "

if "%choice%"=="1" (
    echo Building Split-per-ABI APKs with R8 Shrinking and Obfuscation...
    call flutter build apk --release --split-per-abi --obfuscate --split-debug-info=build/app/outputs/symbols
    echo.
    echo Finished! Output APKs are located in:
    echo %~dp0build\app\outputs\flutter-apk\
    echo.
    echo Modern phones use: app-arm64-v8a-release.apk
) else if "%choice%"=="2" (
    echo Building Universal Release APK...
    call flutter build apk --release --obfuscate --split-debug-info=build/app/outputs/symbols
    echo.
    echo Finished! Output APK is located in:
    echo %~dp0build\app\outputs\flutter-apk\app-release.apk
) else if "%choice%"=="3" (
    echo Building Android App Bundle (.aab)...
    call flutter build appbundle --release --obfuscate --split-debug-info=build/app/outputs/symbols
    echo.
    echo Finished! Output Bundle is located in:
    echo %~dp0build\app\outputs\bundle\release\app-release.aab
) else (
    echo Invalid option selected.
)

pause
