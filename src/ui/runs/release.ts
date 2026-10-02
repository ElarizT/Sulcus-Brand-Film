import { rng } from "../../engine/math";
import { T } from "../../film/timeline";
import { openAiAgents, rowKey, type Agent, type RunScript } from "../model";

// release-review: the run with many agents. OpenAI Agents SDK, agents used as
// tools, so the Agent Tree has real branches (each agent span's parent is the
// agent that called it). It has been running for four minutes when the film
// arrives; in the shot one branch completes, one branch's tool call fails, a
// new agent starts, and a merge waits for approval — which, as in the SDK,
// pauses the run.

export const RELEASE_EXEC = "exec_b81d55e0";
const LIMIT = 250000;

const RM: Agent = { id: "agent_release_manager", name: "Release Manager", span: "span_rm01" };
const CW: Agent = { id: "agent_changelog", name: "Changelog Writer", span: "span_cw02", parent: RM.span };
const QA: Agent = { id: "agent_qa_lead", name: "QA Lead", span: "span_qa03", parent: RM.span };
const TR: Agent = { id: "agent_test_runner", name: "Test Runner", span: "span_tr04", parent: QA.span };
const FT: Agent = { id: "agent_flake_triage", name: "Flake Triage", span: "span_ft05", parent: QA.span };
const SR: Agent = { id: "agent_security", name: "Security Reviewer", span: "span_sr06", parent: RM.span };
const DU: Agent = { id: "agent_docs", name: "Docs Updater", span: "span_du07", parent: RM.span };

export const RELEASE_ROWS = {
  manager: rowKey(RELEASE_EXEC, RM.id),
  changelog: rowKey(RELEASE_EXEC, CW.id),
  qa: rowKey(RELEASE_EXEC, QA.id),
  tests: rowKey(RELEASE_EXEC, TR.id),
  flakes: rowKey(RELEASE_EXEC, FT.id),
  security: rowKey(RELEASE_EXEC, SR.id),
  docs: rowKey(RELEASE_EXEC, DU.id),
};
export const RELEASE_APPROVAL = "apr_e04b19a7";
const MERGE_CALL = "call_Mr9pQ2xa";

const START = T.many - 260; // four minutes twenty before the shot
const PAUSE = T.manyApproval; // the merge waits for approval

const build = (): RunScript => {
  const oa = openAiAgents({
    execution_id: RELEASE_EXEC,
    run_id: "oa_run_51c0aa",
    trace_id: "trace_e2f7c09b1d46",
    framework: "openai_agents",
  });
  const R = rng(5150);
  let n = 0;
  const id = () => `call_${(++n).toString(36).padStart(4, "0")}`;

  // A working agent: model calls, each followed by one to three tool calls.
  const work = (a: Agent, from: number, to: number, tools: string[], pace = 1) => {
    let t = from;
    while (t < to) {
      const llm = (1.8 + R() * 4) * pace;
      if (t + llm > to) break;
      oa.llm(t, t + llm, a, id(), Math.round(700 + R() * 900), LIMIT);
      t += llm + 0.4;
      const k = 1 + Math.floor(R() * 2.4);
      for (let i = 0; i < k && t < to; i++) {
        const d = (0.3 + R() * 3.2) * pace;
        if (t + d > to) break;
        oa.tool(t, t + d, a, tools[Math.floor(R() * tools.length)], id());
        t += d + 0.3 + R() * 1.5;
      }
      t += R() * 4 * pace;
    }
  };

  oa.status(START - 1.2, "queued");
  oa.status(START - 0.6, "starting");
  oa.status(START - 0.1, "running");
  oa.execution(START - 0.05, "execution.started");

  oa.agentStarted(START, RM);
  work(RM, START + 0.3, START + 9, ["list_pull_requests", "read_file"]);
  oa.agentStarted(START + 9.5, CW);
  work(CW, START + 10, T.manyDone - 1.2, ["list_commits", "read_file", "write_file"], 1.6);
  oa.agentStarted(START + 14, QA);
  work(QA, START + 14.5, PAUSE - 0.6, ["read_file", "list_pull_requests"], 2.2);
  work(RM, START + 30, PAUSE - 0.4, ["read_file", "list_pull_requests"], 2.6);
  oa.agentStarted(START + 52, TR);
  work(TR, START + 52.5, PAUSE - 0.3, ["run_tests", "read_file"], 1.2);
  oa.agentStarted(START + 96, SR);
  work(SR, START + 96.5, PAUSE - 2.5, ["scan_dependencies", "read_file"], 1.4);
  oa.agentStarted(START + 168, FT);
  work(FT, START + 168.5, T.manyFail - 3.4, ["fetch_ci_logs", "search_issues"], 1.3);

  // In the shot.
  oa.agentEnded(T.manyDone, CW);
  oa.tool(T.manyFail - 0.9, T.manyFail, FT, "fetch_ci_logs", id(), false);
  oa.agentStarted(T.manyStart, DU);
  oa.tool(T.manyStart + 0.35, T.manyStart + 1.05, DU, "read_file", id());
  oa.llm(T.manyStart + 1.15, PAUSE - 0.2, DU, id(), 1180, LIMIT);

  // The Security Reviewer wants to merge. The SDK interrupts; the run waits.
  const ask = { agent_id: SR.id, agent_name: SR.name, tool_name: "merge_pull_request", tool_call_id: MERGE_CALL };
  oa.llm(PAUSE - 2.2, PAUSE - 0.5, SR, id(), 1460, LIMIT);
  oa.execution(PAUSE - 0.4, "tool.execution_requested", { ...ask, span_id: "span_mg11", parent_span_id: SR.span, request_source: "model" });
  oa.execution(PAUSE, "tool_approval_requested", { ...ask, parent_span_id: SR.span });
  oa.execution(PAUSE + 0.03, "execution.paused", { pending_approval_count: 1, duration_ms: 264950.41 });
  oa.status(PAUSE + 0.1, "waiting_for_approval");

  return {
    id: "b81d55e0-9e2c-4a6b-b7d3-1f0c84a92e51",
    name: "v2.14 release review",
    workload: {
      type: "git",
      framework: "openai-agents",
      project: "release-review",
      repository: "https://github.com/acme-labs/release-review.git",
      entrypoint: "main.py",
    },
    limits: { max_total_tokens: LIMIT },
    start: START - 0.1,
    events: oa.out,
    approvals: [{ id: RELEASE_APPROVAL, tool_call_id: MERGE_CALL, tool_name: "merge_pull_request", at: PAUSE }],
    statuses: [
      [START - 2, "queued"],
      [START - 0.6, "starting"],
      [START - 0.1, "running"],
      [PAUSE + 0.1, "waiting_for_approval"],
    ],
  };
};

export const RELEASE = build();
export const RELEASE_PAUSE = PAUSE;
