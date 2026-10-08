# Built-in Agent engine

OmniCut owns this copy of DeepSeek Harness. A normal installation uses the root
`npm run setup` command and never needs a neighboring DSH checkout. The original
`@deepseek-ai/*` package names remain intact because Cordis profiles, plugin
resolution, native chat and subagents depend on them.

- `source/`: the code, package tests, native sources, build scripts, lockfile and
  documentation from official tag `dsh-v0.2.0-rc.2`, commit
  `639ed015397290b3745d163aafe02ffee4aa3f84`. Upstream maintainer instructions,
  internal agent history and GitHub workflow metadata are omitted; build inputs
  and the small public instruction test fixtures are kept.
- `runtime/`: the 278 DSH packages and 7 Cordis packages used by this release,
  including native chat's browser assets. These are the matching published
  artifacts, with development dependencies removed and `private: true` added.
  They are root npm workspaces, not a copied `node_modules` directory.
- `manifest.json`: versions, source locations, upstream archive checksum and a
  checksum for every runtime package. `LICENSE` and `THIRD_PARTY_NOTICES.md`, plus
  package-specific notices, retain the upstream licensing.

Ordinary npm dependencies still provide third-party libraries and platform
binaries such as node-pty, the system addon and LibreOffice. They are installed by
the root lockfile; no other application repository is used at runtime.

## Checking and changing the engine

Verify the included runtime without launching an app or calling a model:

```sh
node engines/agent/verify.mjs
```

Edit the corresponding implementation under `source/`, then rebuild and replace
the runtime packages from the OmniCut root:

```sh
node engines/agent/rebuild.mjs
npm install
```

This maintainer-only command requires pnpm and the native build tools required by
the upstream project. It installs the pinned source dependencies, runs the full
upstream build (including the web frontend), packs exactly the shipped package
set with pnpm's workspace dependency rewriting, checks every package, and updates
`runtime/` and `manifest.json`. All packages finish successfully before runtime
replacement begins. `--skip-install` reuses source dependencies; `--from-build`
packs a build already completed in `source/`. Normal users do not need either
command: compiled runtime artifacts are checked in.

Keep source and runtime versions together. Updating to another DSH release is a
separate migration because it can change persisted session schemas. Validate
native chat, tool use and subagents using isolated, keyless OmniCut tests after a
rebuild. The initial import preserves the already deployed rc.2 artifacts; it
does not migrate sessions or change model providers.
