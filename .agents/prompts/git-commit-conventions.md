---
description: Convenções de commit Git para este repositório (uso manual ou com @ no chat)
---

Use este texto quando pedir ajuda para **mensagens de commit**, **dividir commits** ou **revisar** mensagens geradas pela IA.

## Regras obrigatórias

1. **Assunto (primeira linha):** formato **`tipo: mensagem`** (ex.: `feat: add establishment registration API client`, `chore: add register establishment query key`).
2. **Sem escopo entre parênteses** por defeito (não usar `feat(register): …` salvo acordo explícito do time neste repo).
3. **Nunca** acrescentar trailers `Co-authored-by: Cursor`, `cursoragent@cursor.com` ou similares de ferramenta.
4. Tipos comuns: `feat`, `fix`, `test`, `chore`, `docs`, `refactor` — alinhados ao `git log` existente.

## Nota (Cursor / agente)

Se um commit criado a partir do agente vier com `Co-authored-by: Cursor` no objeto Git, isso **não** cumpre a regra 3. Corrige no teu terminal (fora do fluxo automático, se preciso):

```bash
git commit --amend
```

Apaga as linhas `Co-authored-by: ...`, guarda e fecha o editor. Em alternativa, desativa nos **Settings** do Cursor a opção que acrescenta co-autor em commits feitos pelo agente (nome varia com a versão; procura por "co-author" ou "git" nas definições).

## Opcional

- **Corpo:** parágrafos curtos após linha em branco, se o commit precisar de contexto.
- **Granularidade:** preferir **um commit por ficheiro** (ou por mudança mínima coerente) com mensagem específica em vez de um único commit vago.

## Exemplo bom

```text
feat: add establishment registration API client
```

## Exemplo a evitar

```text
feat(register): add POST client

Co-authored-by: Cursor <cursoragent@cursor.com>
```
