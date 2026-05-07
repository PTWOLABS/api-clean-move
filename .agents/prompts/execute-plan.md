---
description: Generate an execution prompt for a writing-plans implementation plan
---

Generate a complete, ready-to-send prompt for executing an implementation plan
created by the `writing-plans` skill.

LANGUAGE RULES (MANDATORY):

- The entire response MUST be in Brazilian Portuguese (pt-BR).
- Use correct grammar and proper accentuation.
- Do NOT mix languages.
- Do NOT use English except for code, commands, file names, branch names,
  commit messages, or skill names.

INPUT HANDLING:

- If the user provides a plan file path, use that path.
- If the user does not provide a plan file path, ask for the plan path before
  generating the execution prompt.
- Do not execute the plan. Your job is to generate the prompt that another agent
  should receive to execute the plan.

THE GENERATED PROMPT MUST INSTRUCT THE EXECUTOR TO:

- Use the `subagent-driven-development` skill to execute the plan task by task.
- Use the `requesting-code-review` skill as the code quality gate after each
  task.
- Read the plan once, extract all tasks with their full text, and keep a
  checklist updated.
- Never ask implementation or review subagents to read the plan directly.
  The executor must paste the complete task text into each subagent prompt.
- Execute only one implementation task at a time, in order.
- Never dispatch multiple implementer subagents in parallel.
- Check the current branch and `git status --short --branch` before starting.
- Stop and report before starting if there are unrelated dirty changes that
  could be mixed with the implementation.

PER-TASK EXECUTION RULES:

For every task, the generated prompt must instruct the executor to:

1. Record the task base commit before changing files:

   ```bash
   BASE_SHA=$(git rev-parse HEAD)
   ```

2. Dispatch an implementer subagent with:
   - the full task text;
   - relevant architectural context;
   - explicit instruction to follow TDD when the plan requires it;
   - explicit instruction to implement only the current task;
   - explicit instruction to run the task-specific checks;
   - explicit instruction to self-review;
   - explicit instruction to report what was implemented in enough detail for
     review;
   - explicit instruction to report which tests were added or changed, what each
     relevant test covers, and why that coverage matters;
   - explicit instruction to NOT commit.

3. Run spec compliance review after implementation.

4. Fix and re-review until spec compliance is approved.

5. Only after spec compliance passes, run code quality review using the
   `requesting-code-review/code-reviewer.md` template.

6. Fix Critical and Important issues before proceeding.

7. Re-review after fixes until the quality gate is approved.

8. Run all task-specific validation requested by the plan, including focused
   tests, lint, typecheck, or build commands when relevant.

9. After the task-specific validation passes, run:

   ```bash
   npm run check:all
   ```

10. If `npm run check:all` fails:
    - do not commit;
    - do not automatically fix unrelated failures;
    - report the failing command/output summary;
    - identify whether the failure appears related to the current task or a
      broader regression;
    - wait for the user's decision before proceeding.

11. If `npm run check:all` modifies files, include those modifications in the
    pre-commit summary and make clear that they came from the validation command.

IMPLEMENTATION AND TEST COVERAGE REPORTING:

The generated prompt must require the executor to produce a task report that is
detailed enough for human review, without becoming a full implementation diary.
For each task, the executor must explain:

- what was implemented, grouped by domain/application/infra/http/test layer when
  applicable;
- why the implementation was needed for the plan goal;
- which user-visible behavior, domain rule, integration path, or regression risk
  was addressed;
- which tests were added or changed;
- what each relevant test covers;
- why each relevant test exists, especially for edge cases, error paths,
  authorization, persistence, validation, and regressions;
- which planned requirements are not directly covered by tests, if any, and why;
- any coverage limitation or remaining risk.

The executor must not invent coverage data. If no coverage report was generated,
it must describe behavioral coverage from the tests that actually ran, not claim
line, branch, or percentage coverage.

HUMAN CHECKPOINT BEFORE EACH COMMIT:

The generated prompt must require the executor to stop before every task commit.
At the checkpoint, the executor must present:

- task name and status;
- detailed implementation summary;
- files changed;
- concise diff summary;
- tests/checks executed and real results;
- test coverage summary with motivation for the relevant tests;
- `npm run check:all` result;
- spec review result;
- quality review result;
- unresolved concerns, if any;
- suggested commit message.

The executor must wait for explicit user approval before committing.

SUPPORTED USER RESPONSES AT CHECKPOINT:

The generated prompt must define these commands:

- `aprovar`: create the suggested commit and continue to the next task.
- `aprovar com mensagem: <mensagem>`: commit with the provided message and
  continue to the next task.
- `corrigir: <instrução>`: apply the requested correction, rerun the relevant
  checks/reviews, and stop again before committing.
- `parar`: do not commit and do not continue.

AFTER USER APPROVAL:

The generated prompt must instruct the executor to:

1. Commit only the approved task changes.
2. Record:

   ```bash
   HEAD_SHA=$(git rev-parse HEAD)
   ```

3. Update the checklist with the commit SHA and validation results.
4. Continue automatically to the next task.

FINAL VERIFICATION:

After all plan tasks are completed, the generated prompt must instruct the
executor to:

- run the final verification task from the plan, if one exists;
- run final code review for the complete implementation range;
- provide a final summary of what was delivered and the test coverage added
  across the whole plan;
- stop before any final commit if final verification produced new changes;
- never invent test results.

OUTPUT FORMAT:

Return only the generated execution prompt in a Markdown code block.
Do not include explanations before or after the code block.
