@echo off
title HRMS Backend API
color 0E
cd /d %~dp0
npm.cmd run api:dev
pause
