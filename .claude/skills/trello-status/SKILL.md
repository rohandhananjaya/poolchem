---
name: trello-status
description: Fetch a Trello card when mentioned in chat, move it between To Do / Doing / Done lists, and create a feature git branch when development starts. Triggers on a Trello card name/URL/ID mention, or a request to change a card's status.
---

# Trello card lookup + status change

Handles three intents:
1. **Mention** — user references a Trello card by name, URL, or ID → fetch and summarize it.
2. **Status change** — user asks to move a card to **To Do**, **Doing**, or **Done**.
3. **Start development** — card moves into **Doing** → also cut a feature git branch.

## Tools

- `mcp__trello__trello_search` — find a card by name/keyword (no ID known yet).
- `mcp__trello__get_card` — full card detail once you have a 24-char hex `cardId`.
- `mcp__trello__list_boards` — find the board if not already known.
- `mcp__trello__get_lists` — list IDs for a board's columns (To Do/Doing/Done).
- `mcp__trello__move_card` — change list membership only (position optional).
- `mcp__trello__update_card` — same effect via `idList`, plus can touch name/desc/due in one call.

`apiKey`/`token` params exist on every call but are auto-injected by the Claude.app Trello connector — pass empty strings, don't ask user for credentials.

## Flow

**Resolve the card:**
- Already have a Trello card URL/ID in the message → extract the 24-char hex ID directly, skip search.
- Only a name/keyword → `trello_search` with `modelTypes: ["cards"]`. If multiple hits, disambiguate with user before acting.

**Mention only** (no status change requested): `get_card` with `includeDetails: true`, summarize name/desc/due/members. Stop there.

**Status change requested:**
1. Get the card's board ID (`get_card` returns it, or `includeDetails: true`).
2. `get_lists` on that board — match list names case-insensitively against "To Do", "Doing", "Done". Note: board list names vary — some boards use "In Progress" instead of "Doing", "Backlog"/"To-Do" instead of "To Do". Match the closest existing list; if none plausible, show the user the actual list names and ask.
3. `move_card` (or `update_card` with `idList`) using the resolved `idList`.
4. Confirm to user: card name → new list.
5. Target list resolved to **Doing** → also run the branch step below.

## Branch step (entering Doing = start of development)

Only fires the first time a card enters Doing, not on every re-mention. Steps:

1. `git status` first — uncommitted changes on the current branch must not get carried into or blocked by a checkout. Stash (`git stash -u`) or ask the user if anything unexpected is present.
2. Build branch name: `feature/<card-id-short>-<slug>` — slug = card name lowercased, non-alphanumerics → `-`, trimmed to ~40 chars. Short card ID = last 6-8 chars of the Trello `cardId` (uniqueness, not the full 24-char hex). Example: card "Add payout CSV export" → `feature/a1b2c3d4-add-payout-csv-export`.
3. Base branch = current branch (this repo's base is `development`, see repo git status) unless user says otherwise — confirm which if ambiguous.
4. `git checkout -b <branch-name> <base-branch>` — creates and switches. Report the branch name and base to the user.
5. Don't push the branch — local creation only, unless the user explicitly asks to push.

## Gotchas

- `cardId`/`boardId`/`idList` are strict 24-char lowercase hex — a Trello short URL (`trello.com/c/AbC123ef`) is NOT that ID; that's an 8-char shortlink, won't pass the tool's pattern validation. Resolve it via `trello_search` on the card name instead of trying to feed the shortlink in as `cardId`.
- Don't re-fetch `get_lists` every time in one session — cache board→list-ID mapping for the rest of the conversation once resolved.
- A board can have multiple lists with similar names (e.g. two "Done" columns per sprint) — if ambiguous, ask rather than guessing.
