# OpenCode Prompt Improver Plugin

An OpenCode plugin that automatically evaluates prompts for clarity and triggers research-based clarification when prompts are vague or ambiguous.

Based on [claude-code-prompt-improver](https://github.com/severity1/claude-code-prompt-improver).

## Installation

```bash
bun add @codymclain/opencode-prompt-improver
```

Or add to your OpenCode config:

```json
{
  "plugins": ["@codymclain/opencode-prompt-improver"]
}
```

## How It Works

The plugin intercepts user messages and evaluates them for clarity using pattern matching. When a prompt is determined to be vague (score < 60/100), it automatically injects context instructing the agent to:

1. **Research Phase**: Explore the codebase, check conversation history, find relevant files
2. **Generate Clarifying Questions**: Ask 1-4 targeted questions with options grounded in actual codebase findings
3. **Wait for User Response**: Don't proceed until clarification is received
4. **Execute with Context**: Use original intent + clarifications + research findings

## Evaluation Criteria

Prompts are scored on:

- **Target Specificity**: Does it mention specific files, functions, or components?
- **Action Clarity**: Is the action clearly defined with specifics?
- **Success Criteria**: Are expected outcomes described?
- **Context**: Is there sufficient context to execute?

## Bypass Prefixes

The following prefixes bypass evaluation:

- `*` - Force immediate execution
- `/` - Slash commands
- `#` - Memory/notes
- `!` - Shell commands

## Tools Provided

### `evaluate_prompt`

Manually evaluate a prompt for clarity.

```
evaluate_prompt("fix the bug")
// Returns: { isVague: true, score: 15, reasons: [...], suggestions: [...] }
```

### `improve_prompt`

Generate improvement context for a vague prompt.

```
improve_prompt("add authentication")
// Returns detailed research and clarification instructions
```

## Examples

### Vague Prompt (Triggers Clarification)

```
User: "fix the bug"

Plugin injects context instructing agent to:
1. Search for TODOs, failing tests, recent commits
2. Ask which specific bug to fix with options from codebase
3. Wait for user selection before proceeding
```

### Clear Prompt (Passes Through)

```
User: "Refactor getUserById in src/api/users.ts to use async/await"

Plugin: Score 85/100 - Clear enough, no clarification needed
```

## Development

```bash
# Install dependencies
bun install

# Type check
bun tsc --noEmit

# Build
mise run build

# Test
mise run test
```

## License

MIT
