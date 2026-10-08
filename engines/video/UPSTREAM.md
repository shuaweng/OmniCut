# Vendored video engine

This directory contains Hypit 0.2.17, copied from the Git-tracked source files at:

- Repository: https://github.com/hypit-ai/hypit
- Commit: `1f8f4e1b8a00ecf8e5680233dfc6584e736a0eea`
- License: [the original Hypit license](LICENSE), including its additional conditions

The source packages, protocol names, CLI, documentation, skills, examples and license are retained. OmniCut's host adapters live outside this directory. Application users do not need a separate Hypit checkout; the installation script installs dependencies in this directory using the included pnpm workspace and lockfile.

The upstream `.git` directory, installed dependencies, caches, credentials and generated local state are not included. Two editor-specific skill discovery symlinks (`.claude/skills/hypit` and `.codex/skills/hypit`) were omitted; the actual skill source under `skills/` is included and loaded by the application. Git-tracked example media fixtures are included; no untracked demonstration media was copied.

Upstream's `.gitignore` ignores generated files under example asset directories, although the original repository also tracks selected fixtures there. Those existing tracked fixtures must remain in this vendored snapshot when preparing a source archive or Git commit.
