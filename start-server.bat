@echo off
echo Stopping any existing server processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000') do (
    echo Killing process %%a
    taskkill /PID %%a /F >nul 2>&1
)

echo Starting Wagehire server...
npm start 