# @deepseek-ai/dsh-qrush-cache-anchor

English | 中文

Qrush cache-anchor diagnostic: observes every request's `{ system, tools }` prefix and reports its sha256 fingerprint plus a per-session reset count. It is a read-only observation — it never rewrites or short-circuits the LLM call.

The service is `ctx.cacheAnchor`. `anchorFingerprint(system, tools)` is the pure sha256 fold; `CacheAnchor.observe(options)` records one request and returns 1 when the prefix changed; `CacheAnchor.snapshot(sessionId)` returns `{ fingerprint, resets, lastChangedAt }`.

## Config

None. The service takes no settings; `observe` is driven by the `llm/stream` waterfall it listens to globally.

## Model Experience

None. This package neither assembles nor sends a provider request; it observes the request envelope the loop already built.

## KV Cache effect

None by itself — it only fingerprints and counts. Its purpose is diagnosis: DeepSeek's automatic prefix cache anchors on the byte-identical `tools + system + messages` prefix, so `resets` counts how many times the stable `{ system, tools }` part changed and therefore how often the cache anchor was re-primed.

## Known Limitations and Deferred Work

- `observe` is a live runtime observation, not a durable session event: the anchor history is not replayable after a process restart. A durable projection over `request/header` would make it replayable.
- The fingerprint covers `system` and `tools` only, not the message history; the message prefix is append-only by loop construction, so `system`/`tools` is the part a session can actually churn.
