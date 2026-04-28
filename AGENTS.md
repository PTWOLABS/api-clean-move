## Pull Request Description Rules

When generating a PR description:

- Always base the description on the current branch changes.
- Use `main` as the default base branch unless the repository default branch is different.
- Inspect commits and diffs before writing.
- Never invent test results.
- If tests were not run in the current session, mark them as "Not run".
- Prefer concise Markdown.
- Use the repository PR template when available.
- Mention architectural changes, breaking changes, migrations, new endpoints, and deleted legacy flows.
