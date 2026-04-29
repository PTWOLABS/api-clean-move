---
description: Generate a Pull Request description from the current branch
---

Generate a complete Pull Request description based on the current branch.

LANGUAGE RULES (MANDATORY):

- The entire response MUST be in Brazilian Portuguese (pt-BR)
- Use correct grammar and proper accentuation (acentuação correta)
- Do NOT mix languages
- Do NOT use English except for code, commands, or file names

You MUST inspect:

- git branch --show-current
- git status --short
- git log --oneline main..HEAD
- git diff --stat main...HEAD
- git diff --name-only main...HEAD
- git diff main...HEAD

If the default branch is not main, detect it with:
git symbolic-ref refs/remotes/origin/HEAD

Rules:

- Do not invent test results.
- If tests were not executed in this session, mark them as "Not run".
- Mention risky or architectural changes clearly.
- Keep the description in Markdown.
- Do not include huge code snippets.
- Focus on what changed, why it changed, and how it was validated.

Use this template:

## Resumo

<!-- Explicação curta do objetivo do PR -->

## O que foi alterado

-

## Detalhes técnicos

-

## Testes

- [ ] `npm run typecheck` — Não executado
- [ ] `npm run test` — Não executado
- [ ] `npm run test:e2e` — Não executado
- [ ] `npm run build` — Não executado

## Observações para revisão

-

## Checklist

- [ ] Código segue a arquitetura do projeto
- [ ] Não há alterações não relacionadas
- [ ] Testes foram adicionados/atualizados quando necessário
- [ ] Documentação foi atualizada (se necessário)
