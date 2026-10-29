@echo off
title HRMS Web Portal
color 0F
cd /d %~dp0
npm.cmd run web:dev
pause
