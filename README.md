# copilot-aiu

Analyze local GitHub Copilot CLI session usage, AI credits, token details, and mixed-model breakdowns.

## Features

- **Interactive TUI**: Browse sessions and drill down into usage details.
- **Classic CLI**: Script-friendly output for listing and showing session details.
- **JSON Support**: Export data in JSON format for further analysis.
- **Detailed Metrics**: AI credits, USD estimates, token usage (including cache write), model breakdowns, and session run history.

## Usage

### Interactive TUI

Run the TUI to browse all sessions:

```bash
copilot-aiu
```

Or only sessions for the current directory:

```bash
copilot-aiu tui --current
```

### Classic CLI

List sessions in a table format:

```bash
copilot-aiu list
```

Export session list as JSON:

```bash
copilot-aiu list --format json
```

Show details for a specific session:

```bash
copilot-aiu show <id-or-name>
```

Show specific session details as JSON:

```bash
copilot-aiu show <id-or-name> --format json
```

Show latest session:

```bash
copilot-aiu last
```

## Development

```bash
npm install
npm run dev      # Run in development mode
npm run build    # Build the project
npm run typecheck # Run type checking
```
