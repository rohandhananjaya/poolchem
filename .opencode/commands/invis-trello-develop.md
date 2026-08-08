---
description: Fetches a Trello card, moves it from To Do to Doing, then implements it per the card's implementation plan.
agent: build
---

Implement a Trello card end-to-end.

Card URL: $ARGUMENTS

## Step 1 — Resolve the card ID

Trello MCP tools need the 24-char card ID, not the short link (`/c/<shortLink>`). Resolve it:

1. `trello_list_boards` to find the board (match by name if ambiguous).
2. `trello_trello_get_board_cards` on the candidate board(s).
3. Find the card whose `url` ends with the short link from the given URL. If not found, `trello_trello_search` by keywords from the card name.

## Step 2 — Move card To Do → Doing

1. `trello_get_lists` on the board to get the `Doing` list ID.
2. `trello_move_card` with `idList` = the `Doing` list. Report the old → new list.
3. Optional but useful: `trello_trello_add_comment` noting implementation started.

## Step 3 — Read the implementation plan

The plan lives in the card description AND in card comments (comments often hold the detailed plan — check `trello_trello_get_card_actions` with `filter: "all"`). Also check checklists and attachments (`trello_get_card` with `includeDetails: true`, `trello_trello_get_card_checklists`).

The plan is authoritative for scope: files to create, APIs, tests, wiring, doc sync. Note any "Out of scope" section — do NOT implement later cards.

## Step 4 — Implement

Follow the plan exactly:
- Load the relevant repo skill first (`solid-principles`, `testing-patterns`, `prisma-db`, `chemistry-engine`, `auth-tenancy`, `ui-design` depending on the change).
- Read the referenced files the plan names.
- Implement per the plan's Implementation/Wiring/Deliverable sections.
- Write tests per `testing-patterns`.
- Do any doc-sync the plan calls for (e.g. updating `src/**/CLAUDE.md`).
- Run `npm test`, lint, and typecheck before finishing.

## Step 5 — Close out

- Summarize: files created/modified, tests added, verification results.
- Do NOT move the card to Done unless the user asks — implementation started is "Doing".
