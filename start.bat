@echo off
echo Starting Memoir Studio...
cd /d "%~dp0"
start "" "http://localhost:3000"
npm run dev
