# One-click mobile access for Qrush: installs the dsh-pocket plugin (GPL-2.0,
# third-party) into the active web profile, giving a phone on the same LAN a
# QR code to open Qrush, plus an optional cloudflared public tunnel.
#
# dsh deliberately refuses `--host 0.0.0.0` (remote code execution risk), so
# mobile access MUST go through a proxy/tunnel — dsh-pocket provides exactly
# that. After install, restart `dsh web` (or the Qrush desktop app) and open
# Settings → 手机访问.
#
# Usage:  pwsh scripts/install-mobile-access.ps1   (from the repo root)

$ErrorActionPreference = 'Stop'

$env:PATH = "$env:LOCALAPPDATA\corepack-bin;$env:PATH"

Write-Host '==> 安装 dsh-pocket（手机访问插件，GPL-2.0 第三方）到 web profile ...'
pnpm dsh plugin --profile web add dsh-pocket -w
if ($LASTEXITCODE -ne 0) { throw "dsh-pocket 安装失败（exit $LASTEXITCODE）" }

Write-Host ''
Write-Host '✔ 完成！'
Write-Host '  1) 重启 Qrush（桌面端 npm start，或 dsh web）'
Write-Host '  2) 打开 设置 → 手机访问'
Write-Host '     - 局域网：手机连同一 WiFi，扫二维码即开'
Write-Host '     - 公网：点「开启公网访问」（cloudflared 隧道），4G 也能访问'
Write-Host ''
Write-Host '  安全提醒：公网 URL 即钥匙（dsh web 能执行代码），勿转发给他人。'
