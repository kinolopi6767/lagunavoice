<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Workflow rules (owner-mandated — do not remove)

1. **Auto-push**: after ANY code change is made and verified (lint/typecheck/build), commit and push to the remote automatically — never wait to be asked.
2. **Confirmation line**: every assistant response that finishes a turn of work MUST end with a line exactly `push=confirmed` (tells the owner the latest state is on GitHub). Only omit it if a push genuinely failed — then say why.
3. **Remote**: `https://github.com/kinolopi6767/lagunavoice.git` (credentials live in the git remote URL / credential store — NEVER write the PAT or any secret into files that get committed).
4. Commit style: concise `type: summary` messages on the current branch (`main`).

