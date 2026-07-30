@echo off
if "%1"=="--version" (
  echo 0.30.0
  exit /b 0
)
if "%1"=="web" (
  echo Open http://127.0.0.1:%4/#token=fake-token-for-tests
  timeout /t 600 /nobreak >nul
  exit /b 0
)
exit /b 1
