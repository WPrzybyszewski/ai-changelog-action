# 10x AI Changelog Generator

A GitHub Action that automatically generates CHANGELOG.md from recent commits using Google's Gemini Flash AI.

## Features

- Analyzes recent commits using GitHub API
- Generates changelog entries with AI (Gemini Flash)
- Automatically creates Pull Request with CHANGELOG.md updates
- Supports configurable number of commits to analyze
- Works as a composite action for easy integration

## Usage

Add this action to your workflow:

```yaml
name: Generate Changelog

on:
  push:
    branches:
      - main

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: przeprogramowani/ai-action@master
        with:
          GOOGLE_API_KEY: ${{ secrets.GOOGLE_API_KEY }}
          COMMIT_COUNT: "10"  # Optional, default: 10
          BRANCH: "main"      # Optional, default: main
```

## Inputs

- `GOOGLE_API_KEY` (required): Google AI Studio API Key
- `COMMIT_COUNT` (optional): Number of recent commits to analyze (default: 10)
- `BRANCH` (optional): Target branch to analyze commits from and create PR to (default: main)

## Outputs

- `pr_number`: Number of the created Pull Request
- `pr_url`: URL of the created Pull Request

## How It Works

This action uses a modular approach:

1. **GitHub API Integration**: Uses the GitHub SDK (`@actions/github`) to fetch recent commits
2. **AI Analysis**: Processes commit messages through Google's Gemini Flash AI model to generate changelog entries
3. **Changelog Update**: Creates or updates CHANGELOG.md with the new entry
4. **PR Creation**: Automatically creates a Pull Request with the changelog changes

## Changelog Format

The generated changelog follows this format:

```markdown
## [Repository Name] - Changelog

### DD.MM.YYYY - DD.MM.YYYY

- Brief description of change 1
- Brief description of change 2
- Brief description of change 3
```

## Development

The action is structured in a modular way:

- `src/github-utils.js` - Handles GitHub API interactions (commits, PRs, files)
- `src/sumarize-changelog.js` - Contains the AI changelog generation logic
- `src/index.js` - Main orchestration file
- `action.yml` - Defines the GitHub Action

To modify:

1. Clone the repository
2. Make changes to the source files
3. Run `npm run build` to update the dist directory
4. Commit and push your changes