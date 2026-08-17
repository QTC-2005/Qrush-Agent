/**
 * Qrush Agent desktop client — Electron main process.
 *
 * Architecture (wrapper, not a reimplementation): this process spawns the
 * built dsh web runtime (`apps/cli/lib/bin.js web`) on a loopback port and
 * opens a native BrowserWindow at that URL. The whole Web UI — the client
 * plugin tree, the cache panel, tool cards — is reused unchanged over the
 * existing HTTP/SSE carrier. No fork of the web stack.
 *
 * The official architecture note reserves a deeper route — load the built
 * frontend over `file://` and bridge fetch/SSE through an Electron IPC carrier
 * (`AbstractApiClient` doFetch subclass) with the host running in-process — for
 * when a no-server, single-process desktop build is required. This wrapper is
 * the running first step on that path.
 *
 * @module qrush-desktop/main
 */

import { app, BrowserWindow, dialog } from 'electron'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
// main.mjs lives at desktop/src; two hops up is the repo root, where apps/
// sits. The built dsh CLI is the runtime we wrap.
const repoRoot = path.resolve(dirname, '..', '..')
const dshBin = path.join(repoRoot, 'apps', 'cli', 'lib', 'bin.js')

const PORT = Number.parseInt(process.env.QRUSH_PORT ?? '3090', 10)
// dsh deliberately refuses `--host 0.0.0.0` (remote code execution risk), so
// mobile/LAN access must go through a reverse proxy or tunnel — the
// `dsh-pocket` plugin provides that (cloudflared + QR). QRUSH_HOST overrides
// the bind for other setups; the desktop window always loads loopback.
const HOST = process.env.QRUSH_HOST ?? '127.0.0.1'
const WINDOW_URL = `http://127.0.0.1:${PORT}`

/**
 * Locate a real Node on PATH. Electron's embedded Node is v20 — below the dsh
 * runtime's ^22.19 engine floor — and fails to resolve the @deepseek-ai
 * workspace packages, so we must spawn the system Node, not process.execPath.
 */
function findSystemNode() {
  const exe = process.platform === 'win32' ? 'node.exe' : 'node'
  const dirs = (process.env.Path ?? process.env.PATH ?? '').split(path.delimiter)
  for (const dir of dirs) {
    if (dir === '') continue
    const candidate = path.join(dir, exe)
    try {
      if (existsSync(candidate)) return candidate
    } catch {
      // keep scanning
    }
  }
  return process.execPath
}

const nodeExe = findSystemNode()
// Only when PATH has no Node at all do we fall back to Electron-as-node.
const spawnEnv = nodeExe === process.execPath
  ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  : { ...process.env }

/** Spawn the dsh web runtime; the child is reaped on every exit path. */
const spawnArgs = [dshBin, 'web', '--host', HOST, '--port', String(PORT)]
const child = spawn(nodeExe, spawnArgs, {
  stdio: 'inherit',
  env: spawnEnv,
})

/** Poll until the runtime answers, so the window never paints a dead URL. */
async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(WINDOW_URL)
      if (response.ok) return
    } catch {
      // Runtime not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`dsh web did not become ready at ${WINDOW_URL} within ${timeoutMs}ms`)
}

async function createWindow() {
  await waitForServer()
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Qrush Agent',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  await win.loadURL(WINDOW_URL)
}

app.whenReady().then(() => {
  createWindow().catch((error) => {
    dialog.showErrorBox('Qrush Agent', String(error))
    app.quit()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow().catch(() => {})
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

// Reap the runtime no matter how the app exits.
app.on('will-quit', () => { child.kill() })
process.on('exit', () => { child.kill() })
