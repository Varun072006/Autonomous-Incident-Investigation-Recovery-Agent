# One-command launcher: seeds DB, starts API (8000) and UI (5173).
$root = $PSScriptRoot
$env:PYTHONPATH = "$root\backend"
Push-Location "$root\backend"; python -m app.seed | Select-Object -Last 2; Pop-Location
if (-not (Test-Path "$root\frontend\node_modules")) { Push-Location "$root\frontend"; npm install; Pop-Location }
Start-Process python -ArgumentList "-m","uvicorn","app.main:app","--host","127.0.0.1","--port","8000" -WorkingDirectory "$root\backend"
Start-Process npm.cmd -ArgumentList "run","dev","--","--host","127.0.0.1","--port","5173" -WorkingDirectory "$root\frontend"
Write-Host "UI: http://127.0.0.1:5173   API docs: http://127.0.0.1:8000/docs"
