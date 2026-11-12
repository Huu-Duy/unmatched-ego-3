@echo off
title Unmatched Ego 2 - Local Server & Database
cd /d "%~dp0"
echo ========================================================
echo    DANG KHOI DONG SERVER & DATABASE CHO UNMATCHED EGO 2
echo ========================================================
echo.
echo Server dang khoi dong tai: http://localhost:8080
echo Cua so trinh duyet se tu dong mo len...
echo (De dung server, hay dong cua so nay)
echo.
start http://localhost:8080
node server.js
pause
