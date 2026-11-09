@echo off
echo ====================================
echo Starting FileDrop Frontend...
echo ====================================
cd frontend
if not exist node_modules (
    echo Installing node dependencies...
    npx yarn install || npm install --legacy-peer-deps
)
echo Starting React dev server on http://localhost:3000...
npx yarn start || npm start
pause

