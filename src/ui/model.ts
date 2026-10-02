// Runs as data. A run is a list of runtime events on the film's clock, in the
// shapes Sulcus's adapters emit them (see ElarizT/Sulcus sulcus/integrations),
// plus the run record and approval records the Cloud API serves. The UI state
// at any film time is just "everything up to now", fed to the app's own
// rendering code (sulcusApp.js).

export type Meta = Record<string, string | number | boolean>;

export type Ev = {
  t: number;
  type: string;
  source: string;
  level?: "INFO" | "WARNING" | "ERROR";
  message?: string;
  meta?: Meta;
};

export type Envelope = {
  sequence: number;
  run_id: string;
  event: {
    timestamp: string;
    level: string;
    source: string;
    event_type: string;
    message: string;
    metadata: Meta;
  };
};

export type Workload = {
  type: "git" | "local" | "example" | "cloud";
  framework: string;
  project: string;
  repository?: string;
  entrypoint?: string;
};

export type ApprovalScript = {
  id: string;
  tool_call_id: string;
  tool_name: string;
  at: number; // requested
  decidedAt?: number;
  decision?: "approved" | "denied";
};

export type RunScript = {
  id: string;
  name: string;
  workload: Workload;
  limits: { max_total_tokens?: number };
  start: number;
  events: Ev[];
  approvals: ApprovalScript[];
  // [film time, status, error] in order.
  statuses: [number, string, string?][];
};

// Film time 0 is 09:40:00 on the day the film is set; the app formats times
// in UTC (see sulcusApp.js), so these read as 09:40 local in the picture.
export const EPOCH = Date.UTC(2026, 9, 2, 9, 40, 0);
export const wall = (t: number) => EPOCH + Math.round(t * 1000);
export const iso = (t: number) => new Date(wall(t)).toISOString();

// The OpenAI Agents adapter's message convention.
const defaultMessage = (type: string) => type.replace(/[._]/g, " ");

type Compiled = { script: RunScript; envelopes: (Envelope & { t: number })[] };
const compiled = new WeakMap<RunScript, Compiled>();

const compile = (script: RunScript): Compiled => {
  let c = compiled.get(script);
  if (c) return c;
  const sorted = [...script.events].sort((a, b) => a.t - b.t);
  c = {
    script,
    envelopes: sorted.map((e, i) => ({
      t: e.t,
      sequence: i + 1,
      run_id: script.id,
      event: {
        timestamp: iso(e.t),
        level: e.level ?? "INFO",
        source: e.source,
        event_type: e.type,
        message: e.message ?? defaultMessage(e.type),
        metadata: e.meta ?? {},
      },
    })),
  };
  compiled.set(script, c);
  return c;
};

export type RunRecord = {
  id: string;
  name: string;
  agent_id: string;
  status: string;
  error: string | null;
  workload: Workload;
  limits: { max_total_tokens?: number };
  token_usage: { total_tokens: number } | null;
  created_at: string;
  started_at: string;
  finished_at: string | null;
};

export type ApprovalRecord = {
  id: string;
  tool_call_id: string;
  tool_name: string;
  status: "pending" | "approved" | "denied";
  actionable: boolean;
  created_at: string;
};

export const APPROVAL_FETCH = 0.15;

export const statusAt = (script: RunScript, t: number) => {
  let s: [number, string, string?] = script.statuses[0];
  for (const entry of script.statuses) if (entry[0] <= t) s = entry;
  return s;
};

export const runAt = (script: RunScript, t: number) => {
  const { envelopes } = compile(script);
  const events = envelopes.filter((e) => e.t <= t);
  const [since, status, error] = statusAt(script, t);
  let tokens: number | null = null;
  for (const e of events)
    if (e.event.event_type === "runtime.tokens.used") tokens = Number(e.event.metadata.run_total_tokens);
  const terminal = status === "completed" || status === "failed" || status === "stopped";
  const run: RunRecord = {
    id: script.id,
    name: script.name,
    agent_id: script.workload.project,
    status,
    error: error ?? null,
    workload: script.workload,
    limits: script.limits,
    token_usage: tokens == null ? null : { total_tokens: tokens },
    created_at: iso(script.start - 0.4),
    started_at: iso(script.start),
    finished_at: terminal ? iso(since) : null,
  };
  // The app learns of an approval from the approvals API, which it refreshes
  // 150 ms after an approval event (app.js scheduleApprovalRefresh).
  const approvals: ApprovalRecord[] = script.approvals
    .filter((a) => a.at + APPROVAL_FETCH <= t)
    .map((a) => {
      const decided = a.decidedAt != null && a.decidedAt <= t;
      return {
        id: a.id,
        tool_call_id: a.tool_call_id,
        tool_name: a.tool_name,
        status: decided ? (a.decision ?? "approved") : "pending",
        actionable: !decided,
        created_at: iso(a.at),
      };
    });
  return { run, events: events.map(({ t: _t, ...e }) => e), approvals };
};

// The sequence number an event will have in the run's stream.
export const sequenceOf = (script: RunScript, pred: (e: Envelope) => boolean) =>
  compile(script).envelopes.find(pred)?.sequence ?? -1;

// The key app.js gives an agent's row (agentNodes(): scope:kind:identity).
export const rowKey = (executionId: string, agentId: string) =>
  `${executionId}:agent:${agentId}`;

// ── OpenAI Agents SDK event builders ─────────────────────────────────────
// Field names and order follow sulcus/integrations/openai_agents.

export type Agent = { id: string; name: string; span: string; parent?: string };

export const openAiAgents = (base: Meta) => {
  const SRC = "OpenAIAgentsAdapter";
  const ids = (a: Agent) => ({ agent_id: a.id, agent_name: a.name });
  const out: Ev[] = [];
  let total = 0;
  const api = {
    out,
    get total() {
      return total;
    },
    execution(t: number, type: string, meta: Meta = {}, level: Ev["level"] = "INFO") {
      out.push({ t, type, source: SRC, level, meta: { ...base, ...meta } });
    },
    agentStarted(t: number, a: Agent) {
      out.push({
        t,
        type: "agent.started",
        source: SRC,
        meta: { ...base, ...ids(a), span_id: a.span, ...(a.parent ? { parent_span_id: a.parent } : {}) },
      });
    },
    agentEnded(t: number, a: Agent, ok = true, extra: Meta = {}) {
      out.push({
        t,
        type: ok ? "agent.completed" : "agent.failed",
        source: SRC,
        level: ok ? "INFO" : "ERROR",
        meta: { ...base, ...ids(a), span_id: a.span, ...(a.parent ? { parent_span_id: a.parent } : {}), ...extra },
      });
    },
    handoff(t: number, from: Agent, to: Agent) {
      out.push({
        t,
        type: "handoff.completed",
        source: SRC,
        meta: { ...base, from_agent: from.name, to_agent: to.name },
      });
    },
    // A model call and the usage it records. `tokens` is what it adds to the
    // run total; `limit` is the run's token limit, if any.
    llm(t0: number, t1: number, a: Agent, callId: string, tokens: number, limit?: number) {
      const span = `span_${callId.slice(-6)}`;
      const meta = { ...base, ...ids(a), model: "gpt-5", model_call_id: callId, span_id: span, parent_span_id: a.span };
      out.push({ t: t0, type: "llm.requested", source: SRC, meta });
      total += tokens;
      out.push({ t: t1, type: "llm.completed", source: SRC, meta: { ...meta, total_tokens: tokens } });
      out.push({
        t: t1 + 0.01,
        type: "runtime.tokens.used",
        source: "TokenBudget",
        message: `${tokens.toLocaleString("en-US")} tokens used`,
        meta: {
          ...base,
          model_call_id: callId,
          model: "gpt-5",
          total_tokens: tokens,
          run_total_tokens: total,
          ...(limit ? { max_total_tokens: limit } : {}),
        },
      });
      return total;
    },
    tool(t0: number, t1: number, a: Agent, name: string, callId: string, ok = true) {
      const span = `span_${callId.slice(-6)}`;
      const meta = { ...base, ...ids(a), tool_name: name, tool_call_id: callId, span_id: span, parent_span_id: a.span };
      out.push({ t: t0 - 0.06, type: "tool.execution_requested", source: SRC, meta: { ...meta, request_source: "model" } });
      out.push({ t: t0, type: "tool.execution_started", source: SRC, meta });
      out.push({
        t: t1,
        type: ok ? "tool.execution_completed" : "tool.execution_failed",
        source: SRC,
        level: ok ? "INFO" : "ERROR",
        meta: {
          ...meta,
          duration_ms: Math.round((t1 - t0) * 1000 * 1000 + 517) / 1000,
          outcome_source: "sdk_span",
          success: ok,
          ...(ok ? {} : { error_type: "ToolExecutionError" }),
        },
      });
    },
    status(t: number, status: string, error?: string) {
      out.push({
        t,
        type: "cloud.run.status_changed",
        source: "CloudControlPlane",
        message: `Run ${status.replace(/_/g, " ")}`,
        meta: { status, ...(error ? { error } : {}) },
      });
    },
  };
  return api;
};
