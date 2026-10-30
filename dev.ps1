# Starts the database, the API and the frontend in one terminal. Stop everything with Ctrl+C.
# Usage (from the project folder): .\dev.ps1

Set-Location $PSScriptRoot
docker compose up -d --wait

$api = Start-Process -FilePath ".\backend\.venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--reload" `
    -NoNewWindow -PassThru

try {
    Push-Location frontend
    npx vite --host
}
finally {
    Pop-Location
    # /T also stops the reloader's child process
    taskkill /PID $api.Id /T /F | Out-Null
}
