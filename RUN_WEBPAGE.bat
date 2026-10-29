@echo off
title HRMS Web & Backend Launcher
color 0A
echo ======================================================================
echo    SUPERBEE AERONAUTICS - HRMS WEB & BACKEND LAUNCHER
echo ======================================================================
echo.

set "TARGET_DIR=%~dp0"
if exist "%~dp0Web_App" set "TARGET_DIR=%~dp0Web_App"

echo [1/3] Starting NestJS Backend API on http://localhost:4000/api ...
start "HRMS Backend API (Port 4000)" cmd /k "cd /d %TARGET_DIR% && npm.cmd run api:dev"

echo [2/3] Waiting 4 seconds for backend initialization...
timeout /t 4 /nobreak >nul

echo [3/3] Starting Next.js Web Portal on http://localhost:3000 ...
start "HRMS Web Portal (Port 3000)" cmd /k "cd /d %TARGET_DIR% && npm.cmd run web:dev"

echo.
echo ======================================================================
echo  Servers are starting in separate terminal windows!
echo  - Web Application: http://localhost:3000
echo  - Backend API:     http://localhost:4000/api
echo  - Swagger Docs:    http://localhost:4000/api/docs
echo ======================================================================
echo.
timeout /t 3 /nobreak >nul
start http://localhost:3000
exit
