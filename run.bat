@echo off
title Mega Tools - Starting Server...
color 0A
echo ============================================
echo         MEGA TOOLS - STARTUP
echo ============================================
echo.

:: Start Backend
echo [1/3] Starting Backend Server...
start "MegaTools-Backend" cmd /k "cd /d "C:\Users\megat\Desktop\my tools\backend" && node server.js"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

:: Start Frontend
echo [2/3] Starting Frontend Server...
start "MegaTools-Frontend" cmd /k "cd /d "C:\Users\megat\Desktop\my tools\frontend" && npm run dev"

:: Wait for frontend to initialize
echo [3/3] Opening Browser...
timeout /t 5 /nobreak >nul

:: Open Browser
start http://localhost:5173/login

echo.
echo ============================================
echo   ALL SERVICES STARTED SUCCESSFULLY!
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:5173
echo   Login:    http://localhost:5173/login
echo ============================================
echo.
echo Admin Login:
echo   Email:    admin@controlhub.local
echo   Password: admin123
echo.
echo Press any key to exit this window...
pause >nul