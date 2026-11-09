@echo off
title Atelier Nusantara - Local Server
echo ====================================================
echo Menjalankan Web Server Toko Atelier Nusantara...
echo ====================================================
echo.

node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js belum terinstall atau belum masuk ke PATH.
    echo Silakan install Node.js dari https://nodejs.org/
    pause
    exit /b
)

echo Membuka browser ke http://localhost:3000/?admin=1 ...
start http://localhost:3000/?admin=1

echo Menjalankan server lokal di port 3000...
node server.js
pause
