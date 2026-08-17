/**
 * `dev_tool_search` — on-demand tool discovery and unlock for the Qrush
 * anchor's resident phase.
 *
 * The promoted phase keeps the full catalog minus the heavy tools (see
 * `HEAVY_TOOLS` in the plugin body): internet, delegation, workflows, goals,
 * images, background jobs, and multi-agent control are not dumped into the
 * resident catalog. This tool lets the model discover what exists (searches
 * the FULL assembled catalog through `ctx.tools.schemas(agent)`) and unlock
 * tools by exact name. Unlocked names are recorded as durable `tool/call`
 * arguments, and the assemble filter exposes them from the next request on
 * (resume-safe — derived from the durable log).
 *
 * The tool description doubles as a capability index: the model should reach
 * for `dev_tool_search` the moment a task needs any of the listed
 * capabilities, not work around them with the resident filesystem tools.
 *
 * Adapted from dsh-anchored-standard's `dev-tool-search.mjs` (MIT,
 * xiaobright).
 *
 * @module @deepseek-ai/dsh-qrush-anchor/dev-tool-search
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { Context } from '@deepseek-ai/cordis'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'

const MAX_RESULTS = 25

/** The capability index: resident tools cannot cover these, so the model must search and unlock. */
const UNLOCKABLE_INDEX = [
  'web_search — internet search and web retrieval',
  'subagent / subagent_fork — delegate work to sub-agents',
  'workflow — run multi-agent workflow scripts',
  'ralph — fresh-agent iterative loop',
  'create_goal / get_goal / update_goal — long-running goals',
  'read_image — read image files',
  'job_list / job_output / job_kill — background jobs',
  'interrupt_agent / send_message / list_agents — multi-agent control',
]

/** One text content block (the only render shape this tool emits). */
function text(value: string): ContentBlock[] {
  return [{ type: 'text', text: value }]
}

/**
 * Register the model-facing `dev_tool_search` tool.
 * @param ctx - Cordis context carrying the tools registry.
 * @param heavyTools - the heavy tool names the resident phase hides (used to
 *   tell the model what it can unlock).
 */
export function registerDevToolSearch(ctx: Context, heavyTools: ReadonlySet<string>): () => void {
  return ctx.tools.register(defineTool({
    name: 'dev_tool_search',
    description: [
      'Discover and unlock tools that are NOT currently available.',
      '',
      'The current catalog hides heavy tools; unlock one by exact name and it appears from the next request on (stays unlocked for the session).',
      '',
      'If the current task needs any of the following, call dev_tool_search FIRST — do not try to work around them with the filesystem tools:',
      ...UNLOCKABLE_INDEX.map(line => `- ${line}`),
      '',
      'Usage: pass `query` to search the full catalog (returns matching tool names + descriptions), then pass `toolNames` with exact names to unlock them.',
    ].join('\n'),
    parameters: {
      query: {
        type: 'string',
        description: 'search keywords (e.g. "web", "subagent"); omit to just unlock',
      },
      toolNames: {
        type: 'array',
        items: { type: 'string' },
        description: 'exact tool names to unlock (e.g. ["web_search"])',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
        },
      },
      render: (_args, value) => text(value.text),
    },
    async execute(args: { query?: unknown; toolNames?: unknown }, exec: ToolRunContext | undefined) {
      const query = typeof args.query === 'string' ? args.query.trim() : ''
      const unlock = Array.isArray(args.toolNames)
        ? args.toolNames.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : []

      const lines: string[] = []
      if (unlock.length > 0) {
        const known = unlock.filter(name => heavyTools.has(name))
        const unknown = unlock.filter(name => !heavyTools.has(name))
        if (known.length > 0) lines.push(`Unlocked for the next request: ${known.join(', ')}`)
        if (unknown.length > 0) lines.push(`Already available (no unlock needed): ${unknown.join(', ')}`)
      }
      if (query.length === 0) {
        if (lines.length === 0) lines.push('Provide `query` to search the catalog, or `toolNames` to unlock tools.')
        return { text: lines.join('\n') }
      }

      try {
        // The executing agent IS the viewing scope: preset tools register into
        // the agent-scope layer of the tools registry, and schemas() with no
        // scope only sees the global layer — every preset-provided tool would
        // be invisible to keyword search.
        const schemas = ctx.tools.schemas(exec?.agent)
        const wanted = query.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean)
        const all = schemas.filter((schema) => {
          const haystack = `${schema.name} ${schema.description ?? ''}`.toLowerCase()
          return wanted.every(token => haystack.includes(token))
        })
        const matches = all.slice(0, MAX_RESULTS)
        if (all.length === 0) {
          lines.push(`No tools match "${query}".`)
        } else {
          lines.push(`Matching tools (${matches.length}${all.length > MAX_RESULTS ? ` of ${all.length}` : ''}):`)
          for (const schema of matches) {
            const desc = (schema.description ?? '').split('\n')[0]?.slice(0, 90) ?? ''
            lines.push(`- ${schema.name}: ${desc}`)
          }
          if (all.length > MAX_RESULTS) {
            lines.push(`(truncated at ${MAX_RESULTS} — add tokens to narrow the query)`)
          }
          lines.push('Unlock with dev_tool_search({"toolNames": ["<exact name>"]}).')
        }
      } catch (error) {
        lines.push(`catalog search unavailable: ${String((error && (error as Error).message) || error)}`)
      }
      return { text: lines.join('\n') }
    },
  }))
}
