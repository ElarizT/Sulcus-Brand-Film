import { T } from "../../film/timeline";
import { openAiAgents, rowKey, type Agent, type RunScript } from "../model";

// research-agent: the run the film follows. Its first agent is the first
// light of the film (it wakes at 1.25 s); the camera finds it again in the
// frozen tangle and follows it into Sulcus.
//
// OpenAI Agents SDK, three agents: a Coordinator that hands work to a
// Researcher and a Verifier. Over the film it is watched, one call is
// inspected, the Verifier's execute_command waits for approval and is
// approved, and the run reaches its 60,000-token limit: the next AI call
// will not fit, and Sulcus stops the run.

export const RESEARCH_EXEC = "exec_7f3a2c1e";
const LIMIT = 60000;

export const COORDINATOR: Agent = { id: "agent_coordinator", name: "Coordinator", span: "span_c01a" };
export const RESEARCHER: Agent = { id: "agent_researcher", name: "Researcher", span: "span_r22b", parent: "span_c01a" };
export const VERIFIER: Agent = { id: "agent_verifier", name: "Verifier", span: "span_v35c", parent: "span_c01a" };

export const RESEARCH_ROWS = {
  coordinator: rowKey(RESEARCH_EXEC, COORDINATOR.id),
  researcher: rowKey(RESEARCH_EXEC, RESEARCHER.id),
  verifier: rowKey(RESEARCH_EXEC, VERIFIER.id),
};

// The search_web call the camera inspects, and the call that waits.
export const INSPECTED_CALL = "call_Q8xY2kT1";
export const APPROVAL_CALL = "call_Vx41mEc9";
export const APPROVAL_ID = "apr_3c9e71d0";

const build = (): RunScript => {
  const oa = openAiAgents({
    execution_id: RESEARCH_EXEC,
    run_id: "oa_run_9d41e7",
    trace_id: "trace_5b0e2d91c4a8",
    framework: "openai_agents",
  });
  const C = COORDINATOR;
  const R = RESEARCHER;
  const V = VERIFIER;
  let n = 0;
  const call = (p: string) => `call_${p}${(++n).toString(36).padStart(3, "0")}`;

  oa.status(0.6, "queued");
  oa.status(0.9, "starting");
  oa.status(1.2, "running");
  oa.execution(1.22, "execution.started");

  // Every model call and tool call, by agent, on the film's clock.
  oa.agentStarted(T.agentStart, C);
  oa.llm(1.3, 2.3, C, call("c"), 1840, LIMIT);
  oa.tool(T.toolCall, 2.9, C, "read_file", call("c"));
  oa.llm(3.1, 5.2, C, call("c"), 2210, LIMIT);
  oa.tool(T.fileWrite, 5.95, C, "write_file", call("c"));
  oa.handoff(6.3, C, R);
  oa.agentStarted(6.6, R);
  oa.llm(7.0, 9.2, R, call("r"), 3420, LIMIT);
  oa.llm(9.0, 10.3, C, call("c"), 1320, LIMIT);
  oa.tool(9.8, 11.6, R, "search_web", call("r"));
  oa.tool(10.9, 11.2, C, "read_file", call("c"));
  oa.handoff(11.7, C, V);
  oa.agentStarted(12.0, V);
  oa.tool(12.3, 13.9, R, "search_web", call("r"));
  oa.llm(12.5, 14.4, V, call("v"), 2260, LIMIT);
  oa.tool(14.6, 15.0, R, "read_file", call("r"));
  oa.tool(15.5, 15.9, V, "read_file", call("v"));
  oa.llm(16.0, 18.1, R, call("r"), 4180, LIMIT);
  oa.llm(17.0, 18.8, V, call("v"), 1980, LIMIT);
  oa.llm(17.2, 18.0, C, call("c"), 980, LIMIT);
  oa.tool(19.0, 20.4, R, "search_web", call("r"));
  oa.tool(21.0, 21.4, V, "read_file", call("v"));
  oa.tool(22.8, 23.2, R, "read_file", call("r"));
  oa.llm(23.5, 25.1, V, call("v"), 2140, LIMIT);
  oa.llm(24.0, 26.2, R, call("r"), 4630, LIMIT);
  oa.tool(26.0, 26.4, V, "read_file", call("v"));
  oa.llm(26.6, 27.3, C, call("c"), 1150, LIMIT);
  oa.tool(27.9, 29.6, R, "search_web", call("r"));
  oa.llm(28.4, 30.1, V, call("v"), 2470, LIMIT);
  oa.tool(30.6, 31.0, R, "read_file", call("r"));
  oa.llm(31.2, 32.8, R, call("r"), 3960, LIMIT);
  oa.tool(32.0, 32.5, V, "read_file", call("v"));
  oa.tool(33.1, 34.94, R, "search_web", INSPECTED_CALL);
  oa.llm(33.6, 34.4, C, call("c"), 1060, LIMIT);
  oa.llm(36.0, 36.95, R, call("r"), 3310, LIMIT);
  oa.tool(37.1, 37.5, R, "read_file", call("r"));
  oa.llm(37.2, 39.3, V, call("v"), 2690, LIMIT);
  oa.tool(37.9, 38.3, R, "write_file", call("r"));
  oa.llm(38.6, 39.8, R, call("r"), 2040, LIMIT);

  // The Verifier asks to run a command. The SDK interrupts; the whole run
  // pauses until someone decides.
  const ask = {
    ...{ agent_id: V.id, agent_name: V.name, tool_name: "execute_command", tool_call_id: APPROVAL_CALL },
  };
  oa.execution(39.6, "tool.execution_requested", { ...ask, span_id: "span_e9c1", parent_span_id: V.span, request_source: "model" });
  oa.execution(T.approvalAsk, "tool_approval_requested", { ...ask, parent_span_id: V.span });
  oa.execution(T.approvalAsk + 0.03, "execution.paused", { pending_approval_count: 1, duration_ms: 38812.204 });
  oa.status(T.approvalAsk + 0.1, "waiting_for_approval");

  // Approved: it resumes at once.
  const done = T.approvalDone;
  oa.execution(done, "tool_approval_granted", { ...ask, parent_span_id: V.span });
  oa.status(done + 0.05, "running");
  oa.execution(done + 0.1, "execution.started");
  oa.tool(done + 0.2, done + 1.35, V, "execute_command", APPROVAL_CALL);
  oa.llm(45.0, 46.9, R, call("r"), 2380, LIMIT);
  oa.llm(45.7, 46.8, V, call("v"), 1290, LIMIT);
  oa.llm(46.1, 46.6, C, call("c"), 1110, LIMIT);
  oa.agentEnded(47.2, V);
  oa.tool(47.3, 48.2, R, "search_web", call("r"));
  // This call takes the run past 80 % of its limit.
  const total = oa.llm(48.4, T.limitWarn - 0.02, R, call("r"), 1820, LIMIT);
  oa.out.push({
    t: T.limitWarn,
    type: "runtime.tokens.budget_warning",
    source: "TokenBudget",
    level: "WARNING",
    message: `Token budget ${Math.floor((total * 100) / LIMIT)}% consumed`,
    meta: {
      execution_id: RESEARCH_EXEC,
      run_total_tokens: total,
      max_total_tokens: LIMIT,
      warning_percent: 80,
    },
  });

  // The Researcher's next call needs more than is left. Sulcus blocks it
  // before it is sent, and the run is stopped.
  const hit = T.limitHit;
  oa.out.push({
    t: hit,
    type: "runtime.tokens.limit_exceeded",
    source: "TokenBudget",
    level: "ERROR",
    message: "Token budget exceeded; LLM call blocked",
    meta: {
      execution_id: RESEARCH_EXEC,
      run_total_tokens: total,
      max_total_tokens: LIMIT,
      consumed_total_tokens: total,
      overage_tokens: 0,
      remaining_tokens: LIMIT - total,
      reason: "pre_call_block",
      blocked_operation: "LLM call",
      model_call_id: "call_r0x7",
      input_tokens_required: 13406,
      requested_output_tokens: 2048,
      model: "gpt-5",
    },
  });
  oa.agentEnded(hit + 0.04, R, false, { error_type: "TokenBudgetExceededError", duration_ms: 43441.08 });
  oa.agentEnded(hit + 0.05, C, false, { error_type: "TokenBudgetExceededError", duration_ms: 48801.62 });
  oa.execution(hit + 0.06, "execution.failed", { error_type: "TokenBudgetExceededError", duration_ms: 48842.9 }, "ERROR");
  oa.status(hit + 0.15, "failed", "Token budget exceeded");

  return {
    id: "7f3a2c1e-4b9d-4e57-9a10-58c2d1e6b0f4",
    name: "Daily research brief",
    workload: {
      type: "git",
      framework: "openai-agents",
      project: "research-agent",
      repository: "https://github.com/acme-labs/research-agent.git",
      entrypoint: "app.py",
    },
    limits: { max_total_tokens: LIMIT },
    start: T.agentStart - 0.05,
    events: oa.out,
    approvals: [
      {
        id: APPROVAL_ID,
        tool_call_id: APPROVAL_CALL,
        tool_name: "execute_command",
        at: T.approvalAsk,
        decidedAt: T.approvalDone,
        decision: "approved",
      },
    ],
    statuses: [
      [0, "queued"],
      [0.9, "starting"],
      [1.2, "running"],
      [T.approvalAsk + 0.1, "waiting_for_approval"],
      [T.approvalDone + 0.05, "running"],
      [T.limitHit + 0.15, "failed", "Token budget exceeded"],
    ],
  };
};

export const RESEARCH = build();
