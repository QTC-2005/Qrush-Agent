# @deepseek-ai/dsh-client-ui-skill-toolview

English | 中文

Qrush skill toolview: renders `skill(name)` tool calls in the conversation as an explicit skill-retrieval card (📚 检索技能：`name`) instead of the generic tool row — the visible cue that the model is loading a skill. On settled calls it also shows a short preview of the loaded content.

## Config

None. The view is registered into the keyed `tool.call.toolview` hole that `dsh-client-ui-tool` declares; it activates whenever the model calls the `skill` tool.

## Model Experience

None. Pure browser presentation over the tool call node.

## KV Cache effect

None.

## Known Limitations and Deferred Work

- The preview is a plain-text truncation of the skill body; a richer expandable view is deferred.
