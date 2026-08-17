# One-click memory layer for Qrush: installs dsh-memoir (Apache-2.0,
# third-party) into the active web profile, giving Qrush a persistent
# cross-session memory:
#   - auto-distill: each worked turn ends with a steer asking the agent to
#     distill the turn into memoir_record entries (work / lessons / actions);
#   - storage: per-project PROJECT_MEMORY.md (committed with git) plus a
#     cross-project index at ~/.dsh/dsh-memoir.json;
#   - injection: every new session auto-injects the project's hot memory into
#     the system prompt under a token budget (snapshot frozen per session, so
#     the DeepSeek prefix cache keeps hitting);
#   - GUI: a "记忆" panel in the web sidebar (project/global tabs, search,
#     manual record/delete).
#
# The plugin source lives OUTSIDE the Qrush repo at <repoRoot>\..\vendored\
# dsh-memoir (the repo stays MIT-pure; Apache-2.0 needs no isolation, this is
# the same vendoring convention as the mobile-access script). It is installed
# with pnpm's `file:` protocol so its peer dependencies (@deepseek-ai/dsh-llm,
# @deepseek-ai/dsh-tools) resolve from the profile's own node_modules — a
# plain `link:` fails at boot because node resolves deps from the vendored
# directory, which is outside any node_modules tree.
#
# Usage:  pwsh scripts/install-memory.ps1 [-Headless]   (from the repo root)
#   -Headless  also installs into the headless profile (for CLI testing).

param(
  [switch]$Headless
)

$ErrorActionPreference = 'Stop'

$env:PATH = "$env:LOCALAPPDATA\corepack-bin;$env:PATH"

$repoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$vendoredDir = Join-Path (Split-Path -Parent $repoRoot) 'vendored\dsh-memoir'

Write-Host "==> dsh-memoir vendored dir: $vendoredDir"

# 1) Ensure the vendored copy exists (clone on first use, with retries).
if (-not (Test-Path (Join-Path $vendoredDir 'package.json'))) {
  Write-Host '    vendored copy missing — cloning from GitHub ...'
  New-Item -ItemType Directory -Force -Path $vendoredDir | Out-Null
  $cloned = $false
  for ($attempt = 1; $attempt -le 3 -and -not $cloned; $attempt++) {
    git clone --depth 1 https://github.com/Qinling-Melon-Farmers/dsh-memoir.git $vendoredDir 2>$null
    $cloned = Test-Path (Join-Path $vendoredDir 'package.json')
    if (-not $cloned) {
      Write-Host "    clone attempt $attempt failed — retrying ..."
      Remove-Item $vendoredDir -Recurse -Force -ErrorAction SilentlyContinue
      New-Item -ItemType Directory -Force -Path $vendoredDir | Out-Null
    }
  }
  if (-not $cloned) { throw 'clone failed after 3 attempts — place dsh-memoir at the vendored path manually and re-run' }
}

# 2) Rebase the peer range rc.6 -> rc.5 (Qrush is a 0.1.0-rc.5 fork; the DSH
#    APIs memoir uses — tools.register / systemPrompt.section / agent.steer /
#    agent/turn-stopping — all exist in rc.5, verified). Textual replace keeps
#    the rest of the manifest byte-identical; writes back without BOM.
$pkgPath = Join-Path $vendoredDir 'package.json'
$pkgText = [System.IO.File]::ReadAllText($pkgPath)
$newText = [regex]::Replace($pkgText, '"@deepseek-ai/dsh-llm": "\^0\.1\.0-rc\.6"', '"@deepseek-ai/dsh-llm": "^0.1.0-rc.5"')
$newText = [regex]::Replace($newText, '"@deepseek-ai/dsh-tools": "\^0\.1\.0-rc\.6"', '"@deepseek-ai/dsh-tools": "^0.1.0-rc.5"')
if ($newText -ne $pkgText) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($pkgPath, $newText, $utf8NoBom)
  Write-Host '    patched peerDependencies rc.6 -> rc.5'
}

# 3) Install into the web profile (and optionally the headless profile).
Write-Host '==> 安装 dsh-memoir（项目持久记忆插件，Apache-2.0 第三方）到 web profile ...'
pnpm dsh plugin --profile web add "file:$vendoredDir"
if ($LASTEXITCODE -ne 0) { throw "dsh-memoir 安装到 web 失败（exit $LASTEXITCODE）" }

if ($Headless) {
  Write-Host '==> 同时安装到 headless profile（供 CLI 测试）...'
  pnpm dsh plugin --profile headless add "file:$vendoredDir"
  if ($LASTEXITCODE -ne 0) { throw "dsh-memoir 安装到 headless 失败（exit $LASTEXITCODE）" }
}

Write-Host ''
Write-Host '✔ 完成！'
Write-Host '  1) 重启 Qrush（桌面端 npm start，或 dsh web）'
Write-Host '  2) 侧边栏出现「记忆」入口：项目记忆 / 全局记忆 / 检索 / 手动记录'
Write-Host '  3) 之后每轮有实质工作的回合结束，agent 会自动把结论沉淀为项目记忆；'
Write-Host '     新会话开始时会自动注入本项目的高优先级记忆（缓存友好的冻结快照）'
Write-Host ''
Write-Host '  管理记忆：设置 → 记忆，或让 agent 直接调用 memoir_record / memoir_read。'
