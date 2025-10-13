# PowerShell script to start tunnel mode with proxy server
Set-Location $PSScriptRoot

Write-Host "🚀 Starting Stonetify in Tunnel Mode..." -ForegroundColor Green

# Start proxy server in background
Write-Host "📡 Starting CORS Proxy Server..." -ForegroundColor Yellow
Start-Process -NoNewWindow PowerShell -ArgumentList "-Command", "Set-Location '$PSScriptRoot'; node proxy-server.js"

# Wait a moment for proxy to start
Start-Sleep 3

# Start Expo in tunnel mode
Write-Host "🌐 Starting Expo in Tunnel Mode..." -ForegroundColor Yellow
npx expo start --tunnel

Write-Host "✅ All servers started!" -ForegroundColor Green
Write-Host "📱 Scan QR code with Expo Go app" -ForegroundColor Cyan
Write-Host "🌐 Web tunnel available at: https://[tunnel-url]" -ForegroundColor Cyan
Write-Host "🔗 Proxy server: http://localhost:3001/proxy/api/" -ForegroundColor Cyan
