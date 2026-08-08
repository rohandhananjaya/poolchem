---
description: Fetches a Trello card (full URL like https://trello.com/c/UvbW8V4Z, shortId, or full card id), brainsfroams an implementation plan grounded in the current codebase, then writes the plan back to the card description.
---

Given Trello card "$ARGUMENTS":

1. **Resolve the card:** `$1` may be a full URL (`https://trello.com/c/<shortId>`), a bare shortId (`UvbW8V4Z`), or a full 24-hex card id. Extract the shortId from a URL. If you only have a shortId/URL, use `trello_trello_search` (query = shortId) to resolve the full card id; if you already have a full id, use `trello_get_card` directly.

2. **Fetch context:**
   - `trello_get_card` (includeDetails: true) for name, description, checklists, labels, list, board.
   - `trello_trello_get_board_cards` on the card's boardId to see sibling/dependent cards — note dependencies, what is already Done, and ordering.
   - `trello_trello_get_card_actions` for recent comments/context.

3. **Ground in the codebase:**
   - Read the relevant codebase maps first: `CLAUDE.md`, `src/lib/db/CLAUDE.md`, `src/lib/offline/CLAUDE.md`, `src/app/CLAUDE.md`, `src/components/CLAUDE.md` (whichever apply).
   - Then read the actual files the card touches (db helpers, Server Actions, hooks, components, schema). Determine what already exists, what is stubbed, what is missing. Check `git log --oneline` for recent related work.
   - Load project skills as relevant (`solid-principles`, `auth-tenancy`, `prisma-db`, `ui-design`, `testing-patterns`) before proposing changes.

4. **Brainstorm the plan:** Produce a concrete implementation plan grounded in the real code:
   - Architecture: new/changed modules, responsibilities (SRP/OCP), interfaces, and how they wire into existing code.
   - Data layer: schema/migration changes, new fields/tables, tenancy implications.
   - UI: new/changed components, following the `ui-design` skill.
   - Tests: which to add/update, following `testing-patterns`.
   - Verification: exact commands (`npm run lint`, `npm test`, targeted `npx vitest run -t "<name>"`).
   - Trade-offs, open decisions, and HIGHEST RISK steps called out.

5. **Write the plan back to the card:** `trello_update_card` — append a `## Implementation plan` section to the card description (preserve the existing text; replace the section in place if it already exists). Add a short `trello_trello_add_comment` summarizing the plan and any open questions the user should review.

6. **Report:** Return the card link, a 2–4 line summary of the plan, and the top open decisions the user should weigh in on.
