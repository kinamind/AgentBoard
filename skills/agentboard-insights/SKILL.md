---
name: agentboard-insights
description: Decision support for an AgentBoard OPC (one-person company) console. Pull the company context (goals, tasks, departments, sessions, pending decisions), analyse it with NLP thinking frameworks (Well-Formed Outcome, Meta Model, Logical Levels, Chunking, TOTE, Perceptual Positions, Disney strategy) and post structured analyses back for the founder. Use for scheduled / automated reviews (e.g. TRAE automation), "is our work aligned with the goal", "review this goal/task", "decision brief", "company review", 复盘 / 目标对齐 / 决策简报 / 任务分析.
---

# AgentBoard - Insights (decision support)

Goal: go beyond "is the process alive" to "is the work worth doing and aligned with the
overall goal". The server stores the data; **you (an external agent) do the thinking** and
post results back. The analyzer mode is a setting (`external` by default).

> NLP here is **Neuro-Linguistic Programming** used as structured-thinking checklists.
> It is heuristic, not established science. Every finding must cite evidence ids from the
> context; never invent facts; always set `"disclaimer":"heuristic"`.

## Setup

```bash
export AGENTBOARD_URL=https://agentboard.frosty-poetry-59f5.workers.dev
export AGENTBOARD_KEY=dev-local-key
```

CLI: `agentboard` or `PYTHONPATH=<repo>/agent/src python -m agentboard.cli`.

## Loop (context -> analyse -> post)

1. **Check the mode**: `GET /api/v1/settings` -> `analyzer.mode`. If it is `manual`, stop and say so.
2. **Pull context**
   ```bash
   agentboard insights context --scope company            > context.json
   agentboard insights context --scope department --id engineering > context.json
   agentboard insights context --scope goal --id <goal_id> > context.json
   ```
   The pack contains: `goals`, `tasks` (with `depends_on`, `ready`), `departments`, `agents`,
   `sessions` (recent 60), `pending_decisions`, `signals`, `recent_analyses`, and the
   `frameworks` (each with its prompt).
3. **Pick work from `signals`** (cheap, deterministic):
   - `goals_without_tasks` -> chunking down + well-formed outcome on those goals
   - `orphan_tasks` (no goal) -> chunking up + logical levels
   - `sessions_without_task` / `unassigned_sessions` -> alignment gaps
   - `stale_sessions` / `failed_sessions` -> TOTE (converging, looping, drifting?)
   - `pending_decisions` -> perceptual positions decision brief
   Skip targets already analysed recently (`recent_analyses`) unless their data changed.
4. **Analyse** with the framework's `prompt` from the pack (do not paraphrase the schema). Build a
   ready-to-use prompt with `python scripts/pack.py context.json --framework meta_model --target-type goal --target-id g_x`.
5. **Post** one analysis per (framework, target):
   ```bash
   agentboard insights post --framework meta_model --target-type goal --target-id g_x \
       --analyzer external:trae --file result.json
   ```

## Result schema (strict)

```json
{
  "verdict": "ok | needs_work | misaligned",
  "findings": [{"item": "evidence", "ok": false, "note": "no success measure", "quote": "improve the product"}],
  "questions": ["Which metric, what value, by when?"],
  "recommendation": "Define a measurable result, then split into 3 tasks.",
  "confidence": 0.7,
  "evidence": [{"type": "goal", "id": "g_x"}, {"type": "session", "id": "s_y"}],
  "disclaimer": "heuristic"
}
```

Frameworks: `well_formed_outcome`, `meta_model`, `logical_levels`, `chunking`, `tote`,
`perceptual_positions`, `disney_strategy`. Valid `target_type`: goal, task, session, company, department.

## Quality bar

- Quote the offending wording; ask precise questions (who, how many, by when, measured how).
- Prefer 3-6 high-value findings over exhaustive lists. Say "ok" when it is ok.
- Recommend concrete next actions (create task X for department Y), but **do not create or
  cancel anything yourself** - the founder accepts or dismisses analyses in the console.
- Never expose the API key in output.

## Scheduled automation (TRAE)

Recommended cadence: **company review once a day**, **stuck/failed check once an hour**.
Create two TRAE automations that run this skill:

| Automation | Schedule | Prompt |
|---|---|---|
| Daily company review | every day 09:00 | "Use the agentboard-insights skill. Pull the company context, run goal review (well_formed_outcome, meta_model) on goals without recent analyses, logical_levels + chunking for the whole company, and a perceptual_positions brief for each pending decision. Post results." |
| Hourly health check | every hour | "Use the agentboard-monitor triage, and for each stuck or failed session run a `tote` analysis via agentboard-insights and post it. If nothing is wrong, post nothing." |

Environment for the automation: `AGENTBOARD_URL`, `AGENTBOARD_KEY` (the demo default is fine),
and either the installed `agentboard` CLI or the repo on `PYTHONPATH`. Also report the
automation run itself with the agentboard-report skill (department `strategy`).

## HTTP fallback

```bash
curl -s "$AGENTBOARD_URL/api/v1/insights/context?scope=company" -H "Authorization: Bearer $AGENTBOARD_KEY" -A agentboard-client/0.1
curl -s -X POST "$AGENTBOARD_URL/api/v1/analyses" -H "Authorization: Bearer $AGENTBOARD_KEY" \
  -H 'Content-Type: application/json' -A agentboard-client/0.1 \
  -d '{"framework":"meta_model","target_type":"goal","target_id":"g_x","analyzer":"external:trae","result":{...}}'
```
