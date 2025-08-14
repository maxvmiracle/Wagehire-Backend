@echo off
echo Checking Wagehire server status...
netstat -ano | findstr :5000
if %errorlevel% equ 0 (
    echo Server is running on port 5000
) else (
    echo Server is not running on port 5000
) 