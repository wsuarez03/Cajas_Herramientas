# Servidor local sencillo para probar service worker/offline
# Uso: clic derecho > Run with PowerShell

$port = 8080
Write-Host "Iniciando servidor local en http://localhost:$port ..."
python -m http.server $port
