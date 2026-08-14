# @deepseek-ai/dsh-client-ui-cache-panel

English | 中文

Qrush cache panel: a compact strip in the composer's input dock showing the session's cache hit rate and its cache-anchor reset count. Both facts arrive as whole projected snapshots — `tokenUsage` (provider billing) and `cacheAnchor` (the request `{ system, tools }` fingerprint change count) — so this plugin owns no store, no event listener, and no refresh chain.

## Config

None. The strip renders only while at least one of the two projections carries a value.

## Model Experience

None. The panel is a read-only browser surface over durable session projections.

## KV Cache effect

None directly — it surfaces the effect. `cacheAnchor.resets` counts how many times the stable `{ system, tools }` prefix changed (each change re-primes DeepSeek's automatic prefix cache), and the hit percentage is `cacheReadTokens / (cacheReadTokens + uncachedInputTokens)` from the token meter.

## Known Limitations and Deferred Work

- No cost-savings figure yet: the strip shows tokens and resets, not the monetary delta between hit and miss pricing.
- The anchor reset count reflects the durable `request/header` fold; a reset introduced and reverted within one header span is invisible to it (it only counts net header changes).
