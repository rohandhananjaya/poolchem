---
description: Fetches a Jira issue or board by key (KAN-123 or KAN) and implements the feature described in it. Uses Atlassian tools to read the issue description/summary, then builds it in the codebase.
---

Given Jira key "$ARGUMENTS":

1. **Fetch the issue(s):**
   - If `$1` matches the pattern `XXX-N` (e.g., `KAN-123`), use `atlassian_getJiraIssue` with issue key `$1` to get the summary, description, and acceptance criteria.
   - If `$1` is a bare project key (e.g., `KAN`), search with `atlassian_searchJiraIssuesUsingJql` for `project = $1 AND status != Done ORDER BY priority DESC` to find the top-priority unstarted issue, then fetch its details.

2. **Transition to InProgress:** Use `atlassian_transitionJiraIssue` to move the issue to "In Progress" (or equivalent active status). If the transition fails, log the issue key and continue.

3. **Analyze:** Read the issue description, acceptance criteria, and any linked Confluence pages. Understand the feature requirements.

4. **Implement:** Write the feature end-to-end:
   - Follow the project's architecture (Next.js App Router, Supabase auth, Prisma 7, multi-tenant).
   - Load skills: `solid-principles`, `auth-tenancy`, `prisma-db`, `ui-design` as relevant.
   - Respect the codebase conventions in AGENTS.md and CLAUDE.md.
   - Keep code uncommented, minimal, and idiomatic to the repo.

5. **Verify:** Run `npm run lint` and `npm test` — fix any failures. If tests don't exist for the new feature, add them following the `testing-patterns` skill.

6. **Transition to Done:** Use `atlassian_transitionJiraIssue` to move the issue to "Done" (or equivalent completed status). If the transition fails, log the issue key and continue.

7. **Report:** Summarise what was built, which files were changed, and any decisions or trade-offs made.
