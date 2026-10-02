import { rng } from "../../engine/math";
import { CONNECT_ORDER, connectAt, ECOSYSTEMS, T } from "../../film/timeline";
import { iso, runAt, type Ev, type Meta, type RunScript } from "../model";
import type { ListRun, Project } from "../pages";
import { RELEASE } from "./release";
import { RESEARCH } from "./research";

// The rest of the workspace: its projects, the runs list the seven systems
// land in, and short runs from four other frameworks, each in the event
// shapes that framework's Sulcus integration emits.

const REPO = (name: string) => `https://github.com/acme-labs/${name}.git`;

// ── Projects (62.5 s) ────────────────────────────────────────────────────

export const projectsAt = (t: number): Project[] => {
  const research = runAt(RESEARCH, t).run;
  const release = runAt(RELEASE, t).run;
  return [
    { id: "prj_release", name: "release-review", framework: "openai-agents", repository_url: REPO("release-review"), run_count: 112, latest_run: { status: release.status, started_at: release.started_at } },
    { id: "prj_research", name: "research-agent", framework: "openai-agents", repository_url: REPO("research-agent"), run_count: 48, latest_run: { status: research.status, started_at: research.started_at } },
    { id: "prj_support", name: "support-triage", framework: "crewai", repository_url: REPO("support-triage"), run_count: 76, latest_run: { status: "running", started_at: iso(t - 131) } },
    { id: "prj_docs", name: "docs-qa", framework: "langgraph", repository_url: REPO("docs-qa"), run_count: 231, latest_run: { status: "completed", started_at: iso(t - 1094) } },
    { id: "prj_pipeline", name: "data-pipeline-agent", framework: "langgraph", repository_url: REPO("data-pipeline-agent"), run_count: 19, latest_run: { status: "completed", started_at: iso(t - 4310) } },
  ];
};

// ── Runs list (integrations) ─────────────────────────────────────────────

type Landing = { sys: number; name: string; project: string; type: string; status: string };

// What each system's run looks like in Sulcus Cloud's runs table. Claude
// Code and Codex are local sessions, as the Sulcus CLI reports them.
const LANDINGS: Record<number, Landing> = {
  0: { sys: 0, name: "Docs QA nightly", project: "docs-qa", type: "git", status: "running" },
  1: { sys: 1, name: "claude-code local session", project: "Local sessions", type: "local", status: "running" },
  2: { sys: 2, name: "IT helpdesk agent", project: "it-helpdesk", type: "cloud", status: "running" },
  3: { sys: 3, name: "Daily research brief", project: "research-agent", type: "git", status: "running" },
  4: { sys: 4, name: "codex local session", project: "Local sessions", type: "local", status: "running" },
  5: { sys: 5, name: "Support triage", project: "support-triage", type: "git", status: "running" },
  6: { sys: 6, name: "Billing assistant", project: "billing-assistant", type: "git", status: "waiting_for_approval" },
};

// When system `sys`'s stream reaches the window: its run appears.
export const STREAM_TRAVEL = 0.6;
export const landsAt = (sys: number) => connectAt(CONNECT_ORDER.indexOf(sys as never)) + STREAM_TRAVEL;
export const landingRunId = (sys: number) => `run_${ECOSYSTEMS[sys].framework.replace(/-/g, "")}_${sys}`;

export const runsAt = (t: number): ListRun[] => {
  const research = runAt(RESEARCH, t).run;
  const release = runAt(RELEASE, t).run;
  const landed = [...CONNECT_ORDER]
    .filter((sys) => t >= landsAt(sys))
    .reverse()
    .map((sys) => {
      const l = LANDINGS[sys];
      return {
        id: landingRunId(sys),
        name: l.name,
        status: l.status,
        workload: { framework: ECOSYSTEMS[sys].framework, project: l.project, type: l.type },
        started_at: iso(landsAt(sys) - 3 - sys * 7),
        finished_at: null,
      } as ListRun;
    });
  const history: ListRun[] = [
    { id: release.id, name: release.name, status: release.status, workload: release.workload, started_at: release.started_at, finished_at: release.finished_at },
    { id: research.id, name: research.name, status: research.status, error: research.error, workload: research.workload, started_at: research.started_at, finished_at: research.finished_at },
    { id: "run_docs_prev", name: "Docs QA nightly", status: "completed", workload: { framework: "langgraph", project: "docs-qa", type: "git" }, started_at: iso(t - 1094), finished_at: iso(t - 1094 + 312) },
  ];
  return [...landed, ...history];
};

// ── Runs from four other frameworks, for the fly-through ─────────────────

const series = (seed: number, from: number, to: number, step: [number, number]) => {
  const R = rng(seed);
  const out: number[] = [];
  for (let t = from; t < to; t += step[0] + R() * step[1]) out.push(t);
  return out;
};

// Claude Code, observed through the Sulcus CLI's hooks.
const claudeCode = (): RunScript => {
  const base: Meta = { execution_id: "cc_9f31a7", session_id: "cc_9f31a7", framework: "claude-code" };
  const SRC = "ClaudeCodeLocalAdapter";
  const ev: Ev[] = [{ t: T.integrate - 250, type: "agent.started", source: SRC, meta: base }];
  const tools = ["claude.read", "claude.grep", "claude.edit", "claude.bash", "claude.read", "claude.edit"];
  let turn = 0;
  series(31, T.integrate - 248, T.onePlace, [4, 9]).forEach((t, i) => {
    if (i % 7 === 0) ev.push({ t, type: "execution.started", source: SRC, meta: { ...base, turn_id: `turn_${++turn}` } });
    const id = `toolu_${(i + 101).toString(36)}`;
    const meta = { ...base, tool_name: tools[i % tools.length], tool_call_id: id, item_id: id, turn_id: `turn_${turn}` };
    ev.push({ t: t + 0.2, type: "tool.execution_started", source: SRC, meta: { ...meta, status: "inProgress" } });
    ev.push({ t: t + 1.1, type: "tool.execution_completed", source: SRC, meta: { ...meta, status: "completed", success: true, duration_ms: 900 } });
  });
  return {
    id: "c1a0de77-0b41-4a55-8c3e-91d2f6a0b7c2",
    name: "claude-code local session",
    workload: { type: "local", framework: "claude-code", project: "Local sessions" },
    limits: {},
    start: T.integrate - 250.2,
    events: ev,
    approvals: [],
    statuses: [[0, "running"]],
  };
};

// Codex, observed through the Sulcus CLI.
const codex = (): RunScript => {
  const base: Meta = { execution_id: "cx_51e0b2", session_id: "cx_51e0b2", framework: "codex" };
  const SRC = "CodexLocalAdapter";
  const ev: Ev[] = [{ t: T.integrate - 180, type: "agent.started", source: SRC, meta: base }];
  const tools = ["codex.command", "codex.command", "codex.file_change", "codex.command"];
  series(47, T.integrate - 178, T.onePlace, [3, 8]).forEach((t, i) => {
    const id = `item_${(i + 77).toString(36)}`;
    const meta = { ...base, tool_name: tools[i % tools.length], tool_call_id: id, item_id: id };
    ev.push({ t, type: "tool.execution_started", source: SRC, meta });
    ev.push({ t: t + 1.6, type: i === 9 ? "tool.execution_failed" : "tool.execution_completed", source: SRC, level: i === 9 ? "ERROR" : "INFO", meta: { ...meta, success: i !== 9 } });
  });
  return {
    id: "c0de42b8-77e1-4c90-b1a3-0e6f5d29c814",
    name: "codex local session",
    workload: { type: "local", framework: "codex", project: "Local sessions" },
    limits: {},
    start: T.integrate - 180.2,
    events: ev,
    approvals: [],
    statuses: [[0, "running"]],
  };
};

// LangGraph: nodes and a subgraph, related by parent_run_id.
const langGraph = (): RunScript => {
  const graph = "lg_graph_3d70";
  const SRC = "LangGraphAdapter";
  const base: Meta = { execution_id: "lg_exec_3d70", graph_id: graph, framework: "langgraph" };
  const ev: Ev[] = [{ t: T.integrate - 120, type: "langgraph.run.started", source: SRC, meta: base }];
  const node = (t: number, name: string, run: string, parent?: string) =>
    ev.push({ t, type: "langgraph.node.started", source: SRC, meta: { ...base, langgraph_node: name, run_id: run, ...(parent ? { parent_run_id: parent } : {}) } });
  node(T.integrate - 119, "supervisor", "n_sup");
  node(T.integrate - 110, "retrieve", "n_ret", "n_sup");
  node(T.integrate - 96, "grade_documents", "n_grade", "n_sup");
  node(T.integrate - 70, "generate", "n_gen", "n_sup");
  node(T.integrate - 64, "check_citations", "n_cite", "n_gen");
  const R = rng(91);
  const runs: [string, number, string[]][] = [
    ["n_sup", -118, []],
    ["n_ret", -109, ["vector_search", "fetch_page"]],
    ["n_grade", -95, []],
    ["n_gen", -69, ["fetch_page"]],
    ["n_cite", -63, ["lookup_source"]],
  ];
  let k = 0;
  for (const [run, from, tools] of runs)
    for (let t = T.integrate + from; t < T.onePlace; t += 5 + R() * 9) {
      const call = `lg_${++k}`;
      ev.push({ t, type: "langgraph.llm.started", source: SRC, meta: { ...base, run_id: call, parent_run_id: run, model_call_id: call, model: "gpt-5" } });
      ev.push({ t: t + 2, type: "langgraph.llm.completed", source: SRC, meta: { ...base, run_id: call, parent_run_id: run, model_call_id: call, total_tokens: 900 } });
      if (tools.length) {
        const tool = `lgt_${k}`;
        ev.push({ t: t + 2.4, type: "langgraph.tool.started", source: SRC, meta: { ...base, run_id: tool, parent_run_id: run, tool_name: tools[k % tools.length] } });
        ev.push({ t: t + 3.1, type: "langgraph.tool.completed", source: SRC, meta: { ...base, run_id: tool, parent_run_id: run } });
      }
    }
  return {
    id: "d0c5a1e2-6b3f-4e8a-9c71-2a40e5b9f3d6",
    name: "Docs QA nightly",
    workload: { type: "git", framework: "langgraph", project: "docs-qa", repository: REPO("docs-qa") },
    limits: { max_total_tokens: 120000 },
    start: T.integrate - 120.2,
    events: ev,
    approvals: [],
    statuses: [[0, "running"]],
  };
};

// CrewAI: a crew of agents by role, with their tasks.
const crewAi = (): RunScript => {
  const SRC = "CrewAIAdapter";
  const base: Meta = { execution_id: "crew_8a2c", crew_id: "crew_8a2c", framework: "crewai" };
  const ev: Ev[] = [{ t: T.integrate - 140, type: "crew.started", source: SRC, meta: base }];
  const roles: [string, string, string[], number][] = [
    ["Support Analyst", "Classify ticket", ["search_tickets", "read_kb_article"], -139],
    ["Escalation Specialist", "Draft escalation", ["lookup_customer", "search_tickets"], -96],
    ["Quality Reviewer", "Review reply", ["read_kb_article"], -40],
  ];
  const R = rng(13);
  let k = 0;
  for (const [role, task, tools, from] of roles) {
    ev.push({ t: T.integrate + from, type: "task.started", source: SRC, meta: { ...base, task_name: task, task_id: `task_${role.length}` } });
    ev.push({ t: T.integrate + from + 0.2, type: "agent.started", source: SRC, meta: { ...base, agent_role: role } });
    for (let t = T.integrate + from + 1; t < T.onePlace; t += 6 + R() * 10) {
      const call = `cr_${++k}`;
      ev.push({ t, type: "llm.requested", source: SRC, meta: { ...base, agent_name: role, model_call_id: call, model: "gpt-5" } });
      ev.push({ t: t + 2.5, type: "llm.completed", source: SRC, meta: { ...base, agent_name: role, model_call_id: call } });
      ev.push({ t: t + 3, type: "tool.execution_started", source: SRC, meta: { ...base, agent_name: role, tool_name: tools[k % tools.length] } });
      ev.push({ t: t + 3.8, type: "tool.execution_completed", source: SRC, meta: { ...base, agent_name: role, tool_name: tools[k % tools.length], success: true } });
    }
  }
  return {
    id: "5a7e2c91-d4b0-4f36-8e15-c93a07b6d2f8",
    name: "Support triage",
    workload: { type: "git", framework: "crewai", project: "support-triage", repository: REPO("support-triage") },
    limits: { max_total_tokens: 80000 },
    start: T.integrate - 140.2,
    events: ev,
    approvals: [],
    statuses: [[0, "running"]],
  };
};

// The fly-through, in order: four frameworks, one Run Detail.
export const CARDS: RunScript[] = [claudeCode(), langGraph(), crewAi(), codex()];
