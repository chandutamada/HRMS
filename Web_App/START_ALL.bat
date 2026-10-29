@echo off
title HRMS Web App & Backend Launcher
color 0B
echo ======================================================================
echo    STARTING HRMS WEB APPLICATION & BACKEND API
echo ======================================================================
echo.
echo [1/2] Starting Backend API on http://localhost:4000/api ...
start "HRMS API (Port 4000)" cmd /k "cd /d %~dp0 && npm.cmd run api:dev"

echo [2/2] Waiting 4 seconds, then starting Web Portal on http://localhost:3000 ...
timeout /t 4 /nobreak >nul
start "HRMS Web (Port 3000)" cmd /k "cd /d %~dp0 && npm.cmd run web:dev"

timeout /t 3 /nobreak >nul
start http://localhost:3000
exit
