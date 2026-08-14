# Qrush Agent — desktop client

Electron desktop shell for [Qrush Agent](../README.qrush.md). It spawns the built `dsh web` runtime on a loopback port and opens a native window — the whole Web UI (client plugin tree, cache panel, tool cards) is reused unchanged over the existing HTTP/SSE carrier. This directory is deliberately **outside the pnpm workspace** so the Electron toolchain never joins the harness's `pnpm install`.

## Prerequisites

- Node ≥ 22.19
- The harness built: `pnpm install && pnpm run build` from the repo root (produces `apps/cli/lib/bin.js` and `apps/web/dist`).

## Run

```sh
cd desktop
npm install          # downloads Electron (once)
npm start            # spawns dsh web on 127.0.0.1:3090 and opens a window
```

Configuration:

| Env | Default | Meaning |
|---|---|---|
| `QRUSH_PORT` | `3090` | Loopback port the runtime binds |
| `QRUSH_HOST` | `127.0.0.1` | Bind host (keep loopback unless you know what you're exposing) |

## Architecture

```
desktop (Electron main)
  │ spawn process.execPath apps/cli/lib/bin.js web --port 3090
  ▼
dsh web runtime (host + HTTP/SSE carrier + frontend dist)
  │ loadURL http://127.0.0.1:3090
  ▼
BrowserWindow (native shell)
```

This is the wrapper route: zero changes to the web stack. The [GUI layering RFC](../.agents/notes/implemented/architecture/2026-07-19-gui-layering-and-rpc-protocol.md) reserves the deeper single-process route — frontend over `file://` + an Electron IPC `doFetch` subclass of `AbstractApiClient`, host in-process — for when a no-server build is required. `main.mjs` keeps the spawn boundary isolated so that upgrade is a replacement of the `child` block, not a rewrite.

## Known Limitations

- The runtime is spawned per app launch; a separate "always-on daemon + connect" mode is not yet implemented.
- No signed installers or auto-update; this is a run-from-source client.
