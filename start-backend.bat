@echo off
echo ====================================
echo Starting FileDrop Backend Server...
echo ====================================
cd backend
if not exist .venv (
    echo Creating Python virtual environment...
    python -m venv .venv
)
call .venv\Scripts\activate.bat
echo Running FileDrop Backend on http://localhost:8000...
python server.py
pause
