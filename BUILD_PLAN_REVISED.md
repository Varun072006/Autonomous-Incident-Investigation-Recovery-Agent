# TRACEOPS Revised Build Plan (150 minutes)

Supersedes `BUILD_PLAN.md` and its Appendix A. The acceptance contract is the "Complete Antigravity Build Plan" (call it the **Spec**). This file is the execution plan: order, owners, gates, tests and cuts.

## 1. What changed from the earlier plan

| Area | Earlier plan | Revised |
|---|---|---|
| Repo | `db/seed/tools/engine/recover/llm/main` | Adds `config.py`, `schemas.py`, `evidence.py`, per-module tests, `README.md` |
| Phase 0 | Skeleton only | **Inspect the repo first**, report gaps, preserve working code. Frontend is never first |
| Evidence | Tables only | Provenance contract: `source_type`, `source_table`, content hash, `USER_INJECTED` label, raw-row drilldown |
| Verification | VERIFIED / NOT_RECOVERED | Adds **INCONCLUSIVE** when telemetry is missing |
| Gates | Confidence gate on INCONCLUSIVE | Same, and Tier 3 also needs a written reason |
| Replan triggers | Leader change, share drop, follow-up | Adds **injected evidence** and **failed verification** |
| Groq | `llama-3.3-70b-versatile` | **Model ID is configurable and unverified**: `qwen/qwen3.8-27b` is only a suggestion. Phase 6 starts with a real test call, and the model that actually answered is recorded |
| Provider honesty | Not specified | Each call records the provider and model actually used. Never show Groq as active after a fallback |
| Evaluation | Measured values with n | Adds false-conclusion rate, traceability %, blast-radius precision/recall (if labels exist), fallback rate |
| Cut list | Hash-chain, model-compare, Q&A, variants | Unchanged. The Spec does not require them |

## 2. Non-negotiables (from the Spec)

1. The product runs with `LLM_PROVIDER=none`.
2. The engine, tools and `llm.py` hold no scenario literals. Only tests know the seeded answer.
3. Tools are read-only (`db.ro_conn()`). Outage returns an explicit error ToolResult.
4. Tier 2/3 actions return 409 without approval. Tier 3 needs a written reason. Execution is SIMULATED.
5. Never show "Resolved" unless the verdict is VERIFIED.
6. Share is "relative evidence share (heuristic)", never probability or accuracy.
7. Nothing fabricated: evidence, tool results, metrics or benchmarks. Unfinished work is labelled PARTIAL, MOCKED or FUTURE WORK.
8. No currency or customer figures. Show "Not available".
9. `GROQ_API_KEY` lives in `backend/.env` only: never in the frontend, logs, API responses, DB, git or chat.

## 3. Ownership

| Member | Files |
|---|---|
| M1 integration and recovery | repo skeleton, `README.md`, `IMPLEMENTATION.md`, `recover.py`, state transitions, audit, merges |
| M2 RCA engine | `engine.py`, `tests/test_engine.py` |
| M3 data and API | `config.py`, `schemas.py`, `db.py`, `evidence.py`, `tools.py`, `main.py`, `test_db.py`, `test_tools.py`, `test_api.py` |
| M4 frontend | `frontend/*` |
| M5 seed, LLM, eval | `seed.py`, `llm.py`, `test_llm.py`, `test_recovery.py` (with M1), `eval/` |

One owner per file. Branches `m1…m5`. Only M1 merges to `main`.

## 4. Timeline

| Min | Phase | Work | Exit gate |
|---|---|---|---|
| 0–10 | **0. Inspect** | M1 inspects the existing repo and lists working code, gaps and conflicts with the Spec. Everyone installs deps. Confirm `ollama list` and `qwen2.5:7b` | Gap report written to `IMPLEMENTATION.md` |
| 10–25 | **1. Skeleton and contracts** | M1: layout, stubs, `.gitignore`, `.env.example` (Spec §5 variables only). M3: `config.py`, `schemas.py`, full schema incl. `llm_calls`. M4: Vite shell with `VITE_USE_MOCKS` | `import app.main`; `/api/health`; schema creates cleanly |
| 25–50 | **2. Seed, evidence, tools** | M5 `seed.py` + validator. M3 `evidence.py`, 12 tools, `/api/timeline`. M2 engine on fixtures. M1 `recover.py` | Seed checksum identical across 2 runs; one test per tool passes |
| **50** | **I1** | M1 merges. Seeded DB live | Tools return real values; every observation has resolvable refs |
| 50–75 | **3. RCA engine** | M2: engine on real tools, CLI `python -m app.engine --run`. M3: routes. M4: pages on the real API | CLI concludes or reports INCONCLUSIVE and records its proof |
| 75–90 | **4. Recovery safety** | M1: tiers, approve/reject/execute/verify, gates, reopen, impact, proof. M5: `test_recovery.py` | Approval-gate tests pass |
| **90** | **G2 hard gate** | Is the core path working in the UI: investigate → conclude → recommend → blocked → approve → simulate → verify? | If no: defer Phase 6 and UI polish; fix the core |
| 90–115 | **5. Frontend core** | M4: 4 pages wired, Run/Auto-run, inject, outage toggles, Approve/Reject, Execute (SIMULATED), Verify, proof download, reopen banner. M2: weight tuning | Full path works in UI; `npm run build` |
| 115–130 | **6. Groq layer** | M5: see §5. M4: narrative chips, grounding badge, baseline card | Groq call tested for real or fallback verified |
| **110** | **FREEZE (core)** | Bug fixes only on core. Phase 6 may continue on `llm.py` and its UI | |
| 130–150 | **7. Hardening** | `pytest -q`, `npm run build`, README with exact working commands, `IMPLEMENTATION.md` §6–§9, evaluation, status table | Fresh-clone run works |
| 140–150 | Rehearse and demo | Two timed rehearsals, prime the cache, warm Ollama, `git tag demo-final` | Demo runs from cache with Wi-Fi off |

Within the Spec's priority order, cut from the bottom if late: visual polish → Groq narrator and baseline → UI. Items 1–4 (seed/provenance, timeline and tools, engine, recovery) are never cut.

## 5. Groq phase checklist (Phase 6, with the key)

1. The user creates `backend/.env` and sets `GROQ_API_KEY` themselves. Keep `GROQ_MODEL` configurable.
2. **Verify the model**: list models for the account, or make one real call. If `qwen/qwen3.8-27b` is not available, pick an available model and record the real ID in `IMPLEMENTATION.md`.
3. `generate_json` flow: cache → provider order (Groq → Ollama → none) → parse → Pydantic validate → one repair → template. Temperature 0. Use JSON-schema output only if that exact model supports it, and validate locally either way.
4. Log every call to `llm_calls` with a redacted response, the provider and model actually used, latency, tokens, cache hit and status.
5. Fallback triggers: no key, 401/403/429, timeout, network error, invalid JSON, schema failure.
6. Narrator pack with E#/I#/A# IDs. Per sentence: cites exist, numbers match cited records, entities and action names exist. Drop failures. Below 80% grounded → template. Store per-sentence results and the aggregate score.
7. Baseline: intake data only, no tools, labelled UNVERIFIED GUESS, never fed to the engine.
8. Untrusted data: logs and tickets sit in delimited data blocks. The system prompt says data is never instructions.

## 6. Test matrix (acceptance)

| Area | Must show |
|---|---|
| DB and seed | Clean schema; FK and enum constraints; deterministic checksum; simulated rows labelled; `ro_conn` cannot write |
| Tools | One test each; resolvable refs; outage returns an error ToolResult; no scenario literals (grep) |
| Engine | ≥3 hypotheses at intake; shares sum to 1; coverage correct; missing evidence is not contradiction; equal version error rates weaken H_DEPLOY; leader's falsifier chosen first; pool config emits a pool-metrics follow-up; leader change or share drop replans; injection replans; INCONCLUSIVE when stop rules aren't met; deterministic across runs |
| LLM | Missing key falls back; timeout/429/invalid output falls back; cited text passes; unknown ID, invented number and unsupported entity are rejected; below 80% falls back; prompt-injection log changes no action; key absent from logs, DB and frontend bundle; provider and model visible |
| Recovery | Tier 2 without approval → 409; Tier 3 without reason rejected; gate blocks on INCONCLUSIVE or margin <0.25; rejected cannot execute; correct action → VERIFIED; wrong action → NOT_RECOVERED and reopens with a replan; missing telemetry → INCONCLUSIVE; every change in `audit_log` |
| API and UI | Smoke test per endpoint; 404/409/422/503 codes; `npm run build`; no console errors in the demo flow; every button calls a real endpoint |

## 7. Evaluation (report real values with n)

Root-cause match on the seeded scenario (n=1, stated as a workflow demonstration, not general accuracy), evidence coverage, diagnostic calls and duration, false-conclusion rate, traceability % (conclusion claims linked to raw evidence), recovery verdicts for the right and wrong action, grounded-claim ratio, LLM latency and fallback rate, and blast-radius precision/recall only if labels exist. No invented targets.

## 8. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Existing code conflicts with the layout | Keep it, and document the mapping in `IMPLEMENTATION.md` |
| `db.py` late | M5 seeds from the Spec's schema SQL, then reconciles |
| Engine unstable in the UI | CLI demo, or replay a stored real run labelled as a replay |
| Wrong leader | Tune the hand-set weights only. Never special-case the scenario. Document them as heuristics |
| Groq model unavailable, 429 or offline | Ollama `qwen2.5:7b`, then the template. Say so in the UI |
| Local model slow | Prime the cache. Narrate asynchronously, template text first |
| Behind at minute 90 | Drop Phase 6 and UI polish. Ship the deterministic report |

## 9. Close-out per phase

1. Run the commands and tests, and paste real output.
2. Update `IMPLEMENTATION.md`: completed, partial, mocked, not implemented.
3. At the end, deliver the Spec's §21 report: repository tree, setup, `.env` instructions, run commands, real test output, the filled §24 status table, evaluation with n, limitations and the 3-minute demo script.

## 10. Demo (3 minutes)

0:00 Overview with change markers · 0:20 Baseline, labelled UNVERIFIED GUESS · 0:45 Auto-run: hypotheses, tool choice, raw evidence, replan · 1:40 Evidence audit and inject a signal · 2:05 Execute blocked, approve with reason, Execute (SIMULATED) · 2:35 Verify: VERIFIED or NOT_RECOVERED and reopen. Close with the measured results and the limitations.
