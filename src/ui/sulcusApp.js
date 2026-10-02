// The Sulcus Cloud web app's own rendering code, running inside the film.
//
// Source: ElarizT/Sulcus, sulcus/cloud/static/app.js at 48b8c46 (main,
// 2026-10-02). The functions below are that file's markup builders and the
// derivations they depend on (agent tree, timeline markers, metrics, approval
// panel, event list, runs and projects pages), copied as they are so that the
// film draws the product's real Run Detail, not an imitation of it.
//
// What had to change to run a live app as a pure function of film time is
// marked `film:` and is limited to:
//   - `state` is passed in instead of being a module global, and `Date.now()`
//     is `state.now`, so every frame is deterministic;
//   - functions that wrote to the DOM (innerHTML, createElement, CSSOM
//     geometry) return the same markup as a string instead;
//   - one-shot CSS entrance animations (`is-new`, `is-entering`) become a
//     progress the film drives frame by frame (`data-fade`, `data-enter`);
//   - dates are formatted in en-US / UTC so a render does not depend on the
//     machine it runs on.
// Event handling, network and auth code is not included.

/* eslint-disable */

const TERMINAL = new Set(["completed", "failed", "stopped"]);
const FILTERS = ["All", "Agents", "LLM", "Tools", "Policies", "Errors", "System"];

// film: the app's module-level `state`, swapped in per render.
let state = null;
// film: fixed locale and zone (app.js uses the browser's). en-GB is a 24-hour
// clock, which fits the event list's time column.
const LOCALE = "en-GB";
const ZONE = "UTC";

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function statusBadge(status) {
  const label = status === "waiting_for_approval" ? "approval required" : status;
  return "<span class=\"status-badge status-" + escapeHtml(status) + "\">" + escapeHtml(label) + "</span>";
}
function shortId(value) { return value ? value.slice(0, 8) : "—"; }
function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: ZONE,
  }).format(new Date(value));
}
function formatRelative(value) {
  if (!value) return "Never";
  const seconds = (new Date(value).getTime() - state.now) / 1000;
  const absolute = Math.abs(seconds);
  if (absolute < 60) return "Just now";
  const units = [
    ["year", 31536000], ["month", 2592000], ["day", 86400],
    ["hour", 3600], ["minute", 60],
  ];
  const selected = units.find(function(item) { return absolute >= item[1]; });
  const amount = Math.round(seconds / selected[1]);
  return new Intl.RelativeTimeFormat(LOCALE, {numeric: "auto"}).format(amount, selected[0]);
}

function formatTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: ZONE,
  }).format(new Date(value));
}
function durationMs(start, finish) {
  if (!start) return null;
  return Math.max(0, new Date(finish || state.now).getTime() - new Date(start).getTime());
}
function formatDuration(milliseconds) {
  if (milliseconds == null || !Number.isFinite(milliseconds)) return "—";
  if (milliseconds < 1000) return Math.round(milliseconds) + " ms";
  const seconds = milliseconds / 1000;
  if (seconds < 60) return seconds.toFixed(seconds < 10 ? 1 : 0) + " s";
  return Math.floor(seconds / 60) + "m " + Math.floor(seconds % 60) + "s";
}
function emptyState(title, detail, actionLabel) {
  return "<div class=\"empty-state\"><span class=\"empty-icon\" aria-hidden=\"true\">↳</span>" +
    "<div><strong>" + escapeHtml(title) + "</strong>" +
    (detail ? "<p class=\"page-description\">" + escapeHtml(detail) + "</p>" : "") + "</div>" +
    (actionLabel ? "<button class=\"button button-primary\" id=\"empty-action\" type=\"button\">" +
      escapeHtml(actionLabel) + "</button>" : "") + "</div>";
}

// film: renderRuns() returns its page markup.
function renderRuns() {
  let content = "";
  if (!state.runs.length) {
    content = state.projects.length
      ? emptyState("No runs yet", "Run a project to start supervising its execution.", "Create first run")
      : emptyState("Create your first project", "Connect an agent application and start supervising its executions.", "Create project");
  } else {
    const rows = state.runs.map(function(run) {
      const workload = run.workload || {};
      const framework = workload.framework || "Sulcus native";
      const failure = run.status === "failed" ? (run.error || "Execution failed") : "";
      return "<tr data-run-id=\"" + escapeHtml(run.id) + "\" tabindex=\"0\">" +
        "<td><span class=\"run-name\">" + escapeHtml(run.name || run.agent_id) + "</span>" +
        "<span class=\"secondary\">" + escapeHtml(shortId(run.id)) + "</span></td>" +
        "<td>" + statusBadge(run.status) +
        (failure ? "<span class=\"secondary\">" + escapeHtml(failure) + "</span>" : "") + "</td>" +
        "<td><span class=\"run-name\">" + escapeHtml(workload.project || run.agent_id) + "</span>" +
        "<span class=\"secondary\">" + escapeHtml(workload.type || "example") + "</span></td>" +
        "<td>" + escapeHtml(framework) + "</td>" +
        "<td>" + escapeHtml(formatDate(run.started_at || run.created_at)) + "</td>" +
        "<td class=\"mono\">" + escapeHtml(formatDuration(durationMs(run.started_at, run.finished_at))) + "</td></tr>";
    }).join("");
    content = "<div class=\"panel\"><div class=\"panel-header\"><h2>Recent runs</h2>" +
      "<span class=\"panel-count\">" + state.runs.length + " total</span></div>" +
      "<div class=\"table-wrap\"><table class=\"runs-table\">" +
      "<colgroup><col style=\"width:24%\"><col style=\"width:16%\"><col style=\"width:20%\">" +
      "<col style=\"width:15%\"><col style=\"width:16%\"><col style=\"width:9%\"></colgroup>" +
      "<thead><tr><th>Run</th><th>Status</th><th>Agent / project</th><th>Framework</th>" +
      "<th>Started</th><th>Duration</th></tr></thead><tbody>" + rows + "</tbody></table></div></div>";
  }
  return "<div class=\"page-header\"><div><div class=\"eyebrow\">Execution</div>" +
    "<h1>Runs</h1><p class=\"page-description\">Observe and control every agent execution from one place.</p>" +
    "</div></div>" + content;
}

function frameworkLabel(value) {
  return ({"openai-agents": "OpenAI Agents SDK", langgraph: "LangGraph", crewai: "CrewAI"})[value] || value || "—";
}
function repositoryLabel(value) {
  return String(value || "—").replace(/^https:\/\//, "").replace(/\.git$/, "");
}

// film: renderProjects() returns its page markup.
function renderProjects() {
  let content;
  if (!state.projects.length) {
    content = emptyState("Create your first project", "Connect an agent application and start supervising its executions.", "Create project");
  } else {
    content = "<div class=\"panel project-list\">" + state.projects.map(function(project) {
      const latest = project.latest_run;
      return "<article class=\"project-row\" data-project-id=\"" + escapeHtml(project.id) + "\" tabindex=\"0\">" +
        "<div class=\"project-main\"><strong>" + escapeHtml(project.name) + "</strong>" +
        "<span class=\"framework-label\">" + escapeHtml(frameworkLabel(project.framework)) + "</span>" +
        "<span class=\"project-repository\">" + escapeHtml(repositoryLabel(project.repository_url)) + "</span></div>" +
        "<div class=\"project-stat\"><span>Last run</span><strong>" +
        (latest ? statusBadge(latest.status) + " <span class=\"relative-time\">" + escapeHtml(formatRelative(latest.started_at || latest.created_at)) + "</span>" : "Never") +
        "</strong></div><div class=\"project-stat\"><span>Runs</span><strong>" +
        escapeHtml(project.run_count) + "</strong></div><span class=\"row-arrow\" aria-hidden=\"true\">›</span></article>";
    }).join("") + "</div>";
  }
  return "<div class=\"page-header\"><div><div class=\"eyebrow\">Workspace</div>" +
    "<h1>Projects</h1><p class=\"page-description\">Your agent applications and their execution configuration.</p>" +
    "</div></div>" + content;
}

// film: the "Controls" section of renderNewRun()'s form, with the token limit
// filled in (the rest of that form is not shown in the film).
function newRunControlsHtml(tokenLimit) {
  return "<div id=\"run-controls\"><fieldset class=\"form-section\"><legend>Controls</legend><div class=\"form-grid\">" +
    "<div class=\"field full\"><label for=\"token-limit\">Token limit <span class=\"optional\">Optional</span></label>" +
    "<input class=\"input mono\" id=\"token-limit\" type=\"number\" min=\"1\" max=\"1000000000\" step=\"1\" placeholder=\"10000\" value=\"" + escapeHtml(tokenLimit) + "\">" +
    "<p class=\"field-hint\">Maximum number of tokens this run may consume.</p></div></div></fieldset></div>";
}

// Presentation only: runtime event IDs and enforcement remain unchanged.
function knownNumber(value) {
  if (value == null || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
function humanizeName(value) {
  const text = String(value || "").replace(/[_-]+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "Unnamed step";
}
const EVENT_LABELS = {
  "runtime.tokens.used": "AI usage recorded",
  "runtime.tokens.budget_warning": "Approaching AI usage limit",
  "runtime.tokens.limit_exceeded": "AI usage limit exceeded",
  "cloud.run.duration_limit_exceeded": "Run time limit exceeded",
  "cloud.workload.preparation_failed": "Project preparation failed",
  "cloud.workload.instrumentation_failed": "Framework setup failed",
  "tool_approval_requested": "Approval required",
  "tool_approval_granted": "Approval granted",
  "tool_approval_denied": "Approval denied",
  "llm.budget_exceeded": "AI usage limit exceeded",
  "tool.execution_interrupted": "Tool execution paused",
  "llm.tool_call_requested": "Tool requested",
};
const CONDITIONS = {
  tokens: {label: "AI usage limit exceeded", explanation: "The workflow reached its AI usage limit.", intervention: "Sulcus detected the policy violation and stopped the run."},
  timeout: {label: "Run time limit exceeded", explanation: "The workflow exceeded its allowed execution time.", intervention: "Sulcus stopped the run at the time limit."},
  tool: {label: "Tool access denied", explanation: "A requested tool was denied by the run's policy."},
  approval: {label: "Approval denied", explanation: "A requested action was denied during approval."},
  resources: {label: "Resource limit exceeded", explanation: "The workflow exceeded an allowed resource limit."},
  preparation: {label: "Project preparation failed", explanation: "The repository or its dependencies could not be prepared."},
  framework: {label: "Framework setup failed", explanation: "The agent framework could not be prepared for execution."},
  agent: {label: "Agent execution failed", explanation: "An agent or workflow step failed during execution."},
  provider_limit: {label: "Provider usage limit reached", explanation: "The agent's AI provider reported that its usage limit was reached. Sulcus observed this failure; it did not cause or stop the run."},
  unknown: {label: "The run failed unexpectedly", explanation: "View technical details for more information."},
};
function conditionFor(event) {
  const type = event.event_type || "", meta = event.metadata || {};
  // A named policy exception is evidence of propagation; generic errors are not.
  if (type === "runtime.tokens.limit_exceeded" || meta.error_type === "TokenBudgetExceededError" ||
      /TokenBudgetExceededError|^Token budget exceeded$/i.test(event.message || "")) return "tokens";
  // A provider quota is not a Sulcus policy decision; report it as observed.
  if (meta.error_type === "UsageLimitExceeded") return "provider_limit";
  if (type === "cloud.run.duration_limit_exceeded" || /(?:^|\.)execution\.(?:timed_out|timeout)$/.test(type)) return "timeout";
  if (type === "tool_call_denied" || /(?:^|\.)tool\.(?:denied|permission_denied)$/.test(type)) return "tool";
  if (type === "tool_approval_denied" || /(?:^|\.)(?:approval_denied|approval\.denied)$/.test(type)) return "approval";
  if (type === "tool_call_resource_denied" || /(?:^|\.)(?:resource_limit_exceeded|resources\.limit_exceeded)$/.test(type)) return "resources";
  if (type === "cloud.workload.preparation_failed") return "preparation";
  if (type === "cloud.workload.instrumentation_failed") return "framework";
  if (/(?:^|\.)(?:agent|node|task|execution|run)\.failed$/.test(type) || type === "cloud.workload.agent_failed") return "agent";
  return null;
}
function isIssue(event) {
  const condition = conditionFor(event);
  return event.level === "ERROR" || /failed|\.denied$|approval_denied/.test(event.event_type) ||
    (condition && condition !== "unknown");
}
function issuesForRun() {
  const groups = new Map();
  state.events.forEach(function(item, index) {
    const event = item.event, meta = event.metadata || {};
    if (!isIssue(event)) return;
    const condition = conditionFor(event) || "unknown";
    // One terminal token policy violation per run; other errors require an explicit
    // root/exception identity to merge. Identical text alone never merges failures.
    const key = condition === "tokens" ? "policy:tokens" :
      meta.root_cause_id || meta.exception_id ? "exception:" + (meta.root_cause_id || meta.exception_id) : "event:" + index;
    let issue = groups.get(key);
    if (!issue) {
      issue = {key: key, condition: condition, event: event, sequence: item.sequence, events: []};
      groups.set(key, issue);
    }
    issue.events.push(item);
    if (event.event_type === "runtime.tokens.limit_exceeded") {
      issue.event = event; issue.sequence = item.sequence;
    }
  });
  const run = state.run || {};
  const tokenFailure = run.token_budget_state === "EXCEEDED" ||
    (knownNumber(run.limits && run.limits.max_total_tokens) > 0 &&
      knownNumber(run.token_usage && run.token_usage.total_tokens) > Number(run.limits.max_total_tokens)) ||
    /TokenBudgetExceededError|^Token budget exceeded$/i.test(run.error || "");
  if (tokenFailure && !groups.has("policy:tokens")) groups.set("policy:tokens", {
    key: "policy:tokens", condition: "tokens", event: {metadata: {}, message: run.error}, events: [],
  });
  if (run.status === "failed" && !groups.size) groups.set("run:failure", {
    key: "run:failure", condition: run.error === "Run exceeded its maximum duration" ? "timeout" : "unknown",
    event: {metadata: {}, message: run.error}, events: [],
  });
  return Array.from(groups.values());
}
function operationIdFor(event) {
  const meta = event.metadata || {}, type = event.event_type || "";
  const graph = type.startsWith("langgraph.");
  if (/(?:^|\.)tool[._]/.test(type)) return meta.tool_call_id || meta.call_id || (graph ? meta.run_id : meta.span_id);
  if (/(?:^|\.)llm\./.test(type)) return meta.model_call_id || meta.call_id || (graph ? meta.run_id : meta.model_span_id || meta.span_id);
  if (/(?:^|\.)agent\./.test(type)) return meta.agent_id || meta.span_id || meta.agent_name || meta.agent_role || event.source;
  if (type.includes("langgraph.node")) return meta.run_id || meta.langgraph_node || meta.node;
  if (type.includes("langgraph.chain")) return meta.run_id;
  if (/(?:^|\.)task\./.test(type)) return meta.task_id || meta.task_name;
  return null;
}
function metricsForRun() {
  let tools = 0, llm = 0, errors = 0;
  let tokenTotal = knownNumber(state.run.token_usage && state.run.token_usage.total_tokens);
  let tokenLimit = knownNumber(state.run.limits && state.run.limits.max_total_tokens);
  const counted = new Set();
  const canonicalScopes = new Set(state.events.filter(function(item) {
    return /(?:^|\.)(?:tool|llm)\.(?:execution_)?(?:completed|finished)$/.test(item.event.event_type);
  }).map(function(item) { const event = item.event, meta = event.metadata || {}; return (event.event_type.includes("tool") ? "tool" : "llm") + ":" + (meta.execution_id || event.source); }));
  state.events.forEach(function(item) {
    const event = item.event, type = event.event_type.toLowerCase(), meta = event.metadata || {};
    if (/(?:^|\.)(?:tool\.(?:execution_|execution_observed_|observed_)?|llm\.(?:observed_|stream_)?)(?:completed|finished)$/.test(type)) {
      const kind = type.includes("tool") ? "tool" : "llm";
      if (/observed_|stream_/.test(type) && canonicalScopes.has(kind + ":" + (meta.execution_id || event.source))) return;
      const id = operationIdFor(event);
      const key = String(meta.execution_id || meta.graph_id || event.source || "") + ":" + kind + ":" + (id || "event:" + item.sequence);
      if (!counted.has(key)) { counted.add(key); if (kind === "tool") tools++; else llm++; }
    }
    if (type.startsWith("runtime.tokens.")) {
      const total = knownNumber(meta.run_total_tokens == null ? meta.consumed_total_tokens : meta.run_total_tokens);
      if (total != null) tokenTotal = tokenTotal == null ? total : Math.max(tokenTotal, total);
      if (tokenLimit == null) tokenLimit = knownNumber(meta.max_total_tokens);
    }
    if (event.level === "ERROR" || type.includes("failed")) errors++;
  });
  const issues = issuesForRun();
  const exceeded = issues.some(function(issue) { return issue.condition === "tokens"; });
  const hasLimit = tokenLimit != null && tokenLimit > 0;
  const exhausted = hasLimit && tokenTotal === tokenLimit;
  const warning = hasLimit && tokenTotal != null && tokenTotal >= tokenLimit * 0.8 && tokenTotal < tokenLimit;
  return {
    tokenNote: exceeded ? "Limit exceeded" : exhausted ? "Budget exhausted" : warning ? Math.floor(tokenTotal * 100 / tokenLimit) + "%" : "",
    tokenViolation: exceeded, tokenTotal: tokenTotal, tokenLimit: hasLimit ? tokenLimit : null,
    warning: warning, issues: issues.length, rawErrors: errors, tools: tools, llm: llm, errors: exceeded ? Math.max(1, errors) : errors,
    tokens: tokenTotal != null ? tokenTotal.toLocaleString(LOCALE) + (hasLimit ? " / " + tokenLimit.toLocaleString(LOCALE) : "") : "—",
    duration: formatDuration(durationMs(state.run.started_at, state.run.finished_at)),
  };
}
// Token usage and the run's token limit, as shown in an expanded agent row.
function usageHtml(metrics, scope) {
  const total = metrics.tokenTotal, limit = metrics.tokenLimit;
  const percent = total != null && limit != null ? Math.floor(total * 100 / limit) : null;
  let note = "Usage not reported";
  if (total != null) note = total.toLocaleString(LOCALE) + " used" + (limit == null ? "" : " · " + (metrics.tokenViolation ?
    (total > limit ? "Limit exceeded by " + (total - limit).toLocaleString(LOCALE) : "Next AI call blocked by limit") :
    metrics.warning ? "Approaching limit" : total === limit ? "Limit reached" : (limit - total).toLocaleString(LOCALE) + " remaining"));
  return '<div class="cr-control usage-metric ' + (metrics.tokenViolation ? 'exceeded' : metrics.warning ? 'warning' : '') + '">' +
    '<span class="cr-k">Token limit</span><span class="cr-v">' + (limit == null ? '<span class="cr-unset">not set</span>' : escapeHtml(limit.toLocaleString(LOCALE))) + '</span>' +
    '<span class="cr-bar">' + (percent == null ? '' : '<progress class="usage-track" aria-label="AI token usage" max="100" value="' + Math.min(100, percent) +
      '" aria-valuetext="' + escapeHtml(metrics.tokens + ' tokens, ' + percent + '% of limit') + '"></progress>') + '</span>' +
    '<span class="cr-note">' + (percent == null ? '' : '<span class="usage-percent">' + percent + '%</span> ') + escapeHtml(note) +
    (scope ? ' <span class="cr-scope">' + escapeHtml(scope) + '</span>' : '') + '</span></div>';
}
function runSummaryHtml(metrics) {
  const issues = issuesForRun();
  const root = issues.find(function(issue) { return issue.condition === "tokens"; }) ||
    issues.find(function(issue) { return issue.condition === "provider_limit"; }) || issues[0];
  const failed = state.run.status === "failed" || metrics.tokenViolation;
  let heading, explanation, intervention = "", kind = "neutral";
  if (failed) {
    const condition = root ? root.condition : "unknown", info = CONDITIONS[condition];
    heading = condition === "unknown" ? info.label + "." : (info.intervention ? "Run stopped — " : "Run failed — ") + info.label;
    explanation = info.explanation; intervention = info.intervention || ""; kind = "failure";
    if (condition === "provider_limit" && root.event.metadata && root.event.metadata.framework) {
      const name = String(root.event.metadata.framework);
      heading = "Run failed — " + name.charAt(0).toUpperCase() + name.slice(1) + " usage limit reached";
    }
    if (condition === "tokens" && metrics.tokenTotal != null && metrics.tokenLimit != null) {
      explanation = metrics.tokenTotal > metrics.tokenLimit ? "The workflow used " + metrics.tokenTotal.toLocaleString(LOCALE) + " of the allowed " + metrics.tokenLimit.toLocaleString(LOCALE) + " tokens." :
        "The next AI call could not fit within the allowed " + metrics.tokenLimit.toLocaleString(LOCALE) + " tokens.";
    }
  } else if (state.run.status === "completed") {
    heading = "Run completed successfully."; kind = "success";
    explanation = metrics.tokenTotal == null ? "AI usage was not reported." : metrics.tokenLimit == null ? metrics.tokenTotal.toLocaleString(LOCALE) + " AI tokens used." :
      metrics.tokenTotal.toLocaleString(LOCALE) + " of " + metrics.tokenLimit.toLocaleString(LOCALE) + " AI tokens used.";
  } else if (state.run.status === "waiting_for_approval") {
    heading = "Approval required"; explanation = "The workflow is waiting for an action to be approved.";
  } else if (state.run.status === "stopped") {
    heading = "Run stopped."; explanation = "Execution has ended before completion.";
  } else {
    heading = "Run in progress"; explanation = "Activity updates live as the workflow executes.";
  }
  const detail = failed || issues.length ? '<details id="run-diagnostics"><summary id="outcome-details">Technical details' + (metrics.rawErrors ? ' · ' + metrics.rawErrors + ' raw error events' : '') +
    '</summary><pre class="diagnostic">' + escapeHtml(JSON.stringify({error: state.run.error, issues: issues.map(function(issue) {
      return {condition: issue.condition, event_type: issue.event.event_type, metadata: safeMetadata(issue.event.metadata || {}), related_events: issue.events.length};
    })}, null, 2)) + '</pre></details>' : '';
  return '<section class="run-summary ' + kind + '" aria-label="Run outcome"' + filmEnter("summary") + '><div><h2>' + escapeHtml(heading) + '</h2><p>' + escapeHtml(explanation) +
    (intervention ? ' ' + escapeHtml(intervention) : '') + '</p>' + detail + '</div>' +
    (metrics.tokenViolation && metrics.tokenTotal > metrics.tokenLimit && metrics.tokenLimit != null ? '<span class="summary-context mono">' + (metrics.tokenTotal - metrics.tokenLimit).toLocaleString(LOCALE) + ' tokens over limit</span>' : '') + '</section>';
}
// Run Detail is one control-room surface: header, agent tree, status, timeline
// and live events. It presents RuntimeEvents and the approval API only.
const TIME_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800, 86400];
function pad2(value) { return String(value).padStart(2, "0"); }
function clockLabel(milliseconds, precise) {
  const ms = Math.max(0, Math.floor(milliseconds || 0)), total = Math.floor(ms / 1000), hours = Math.floor(total / 3600);
  const text = (hours || precise ? pad2(hours) + ":" : "") + pad2(Math.floor(total % 3600 / 60)) + ":" + pad2(total % 60);
  return precise ? text + "." + String(ms % 1000).padStart(3, "0") : text;
}
function actionName(toolName) {
  // Only the normalized tool name is shown; Sulcus does not collect tool arguments.
  const name = String(toolName || "").replace(/^[a-z0-9_-]+\./i, "");
  return name ? humanizeName(name) : "Tool call";
}
function runClock() {
  const run = state.run, live = !TERMINAL.has(run.status);
  let first = null, last = null;
  state.events.forEach(function(item) {
    const time = Date.parse(item.event.timestamp);
    if (!Number.isFinite(time)) return;
    if (first == null || time < first) first = time;
    if (last == null || time > last) last = time;
  });
  const start = Date.parse(run.started_at || "") || first || Date.parse(run.created_at || "") || state.now;
  const end = live ? state.now : Date.parse(run.finished_at || "") || last || start;
  return {start: start, end: Math.max(start, end), live: live};
}
function timeScale(clock) {
  const elapsed = clock.end - clock.start;
  // Live runs leave headroom for the advancing cursor; ended runs fit their final time.
  const target = clock.live ? Math.max(elapsed * 1.25, 60000) : Math.max(elapsed, 1000) * 1.05;
  const step = (TIME_STEPS.find(function(seconds) { return target / (seconds * 1000) <= 6; }) || 86400) * 1000;
  return {start: clock.start, span: clock.live ? Math.ceil(target / step) * step : target, step: step};
}
function position(scale, time) {
  return Math.max(0, Math.min(100, (time - scale.start) * 100 / scale.span));
}
function pendingApprovals() {
  if (!state.run || TERMINAL.has(state.run.status)) return [];
  return state.approvals.filter(function(item) { return item.actionable && item.status === "pending"; });
}
function controlRows() {
  const nodes = agentNodes(), byKey = new Map(nodes.map(function(node) { return [node.key, node]; }));
  function owner(node) {
    const seen = new Set();
    while (node && node.kind === "tool" && !seen.has(node.key)) { seen.add(node.key); node = byKey.get(node.parentKey); }
    return node && node.kind !== "tool" ? node : null;
  }
  const agents = nodes.filter(function(node) { return node.kind !== "tool"; });
  if (agents.length < 2) {
    // One session or workflow is one row; no hierarchy is invented for it.
    const node = agents[0], workload = state.run.workload || {};
    const named = node && !/^(?:Agent|Workflow step)$/.test(node.name);
    return [{key: node ? node.key : "run", name: named ? node.name : workload.framework || state.run.name || state.run.agent_id,
      node: node || null, depth: 0, guides: [], last: true, hasChildren: false, items: state.events.slice()}];
  }
  const rows = new Map(agents.map(function(node) {
    const parent = owner(byKey.get(node.parentKey));
    return [node.key, {key: node.key, name: node.name, node: node, parentKey: parent && parent.key !== node.key ? parent.key : null, items: []}];
  }));
  const assigned = new Set();
  nodes.forEach(function(node) {
    const target = owner(node);
    if (target) node.items.forEach(function(item) { rows.get(target.key).items.push(item); assigned.add(item.sequence); });
  });
  const all = Array.from(rows.values()), roots = all.filter(function(row) { return !row.parentKey; });
  // Run-level events belong to a single root; with several roots they stay in the event stream.
  if (roots.length === 1) state.events.forEach(function(item) { if (!assigned.has(item.sequence)) roots[0].items.push(item); });
  const ordered = [], visited = new Set();
  function visit(row, depth, guides, last) {
    if (visited.has(row.key)) return;
    visited.add(row.key);
    const children = all.filter(function(child) { return child.parentKey === row.key && !visited.has(child.key); });
    row.depth = depth; row.guides = guides; row.last = last; row.hasChildren = children.length > 0;
    row.items.sort(function(a, b) { return a.sequence - b.sequence; });
    ordered.push(row);
    children.forEach(function(child, index) { visit(child, depth + 1, depth ? guides.concat(!last) : [], index === children.length - 1); });
  }
  roots.forEach(function(row, index) { visit(row, 0, [], index === roots.length - 1); });
  all.forEach(function(row) { visit(row, 0, [], true); });
  return ordered;
}
// A small shape vocabulary: model ◇, tool ■, approval ○, lifecycle |, error ✕.
function rowMarkers(row, approvalsByCall, representatives, modelEvents) {
  const markers = [], byKey = new Map();
  function add(key, marker) {
    if (!byKey.has(key)) { byKey.set(key, marker); markers.push(marker); }
    return byKey.get(key);
  }
  row.items.forEach(function(item) {
    const event = item.event, type = event.event_type || "", meta = event.metadata || {};
    const time = Date.parse(event.timestamp), call = meta.tool_call_id || meta.request_id;
    if (!Number.isFinite(time)) return;
    const base = {sequence: item.sequence, time: time, tone: ""};
    if (/approval_requested|approval_required|approval\.required/.test(type)) {
      const marker = add("approval:" + (call || item.sequence), Object.assign(base, {kind: "approval", name: actionName(meta.tool_name)}));
      if (call && approvalsByCall.has(String(call))) marker.approval = approvalsByCall.get(String(call));
    } else if (/approval_denied|approval\.denied|^tool_call_denied$|(?:^|\.)tool\.(?:denied|permission_denied)$/.test(type)) {
      add("approval:" + (call || item.sequence), Object.assign(base, {kind: "approval", name: actionName(meta.tool_name)})).tone = "denied";
    } else if (/approval_granted|approval\.granted/.test(type)) {
      const marker = call && byKey.get("approval:" + call);
      if (marker && !marker.tone) marker.tone = "approved";
    } else if (/(?:^|\.)tool[._]/.test(type) && !/^llm\.|observed_|group_/.test(type)) {
      const id = call || operationIdFor(event);
      if (!id && !/started|requested|failed/.test(type)) return;
      const marker = add("tool:" + (id || item.sequence), Object.assign(base, {kind: "tool", name: actionName(meta.tool_name)}));
      if (meta.tool_name) marker.name = actionName(meta.tool_name);
      if (/failed$/.test(type)) marker.tone = "failed";
    } else if (/(?:^|\.)llm\./.test(type) && /started|requested|completed|finished/.test(type) && !/observed_|stream_|tool_call/.test(type)) {
      add("model:" + (operationIdFor(event) || item.sequence), Object.assign(base, {kind: "model", name: "model.response"}));
    } else if (type === "runtime.tokens.used" && !modelEvents) {
      // Runtimes without model events report each model response as token usage.
      add("model:" + item.sequence, Object.assign(base, {kind: "model", name: "model.response"}));
    } else if (representatives.has(item.sequence)) {
      add("error:" + item.sequence, Object.assign(base, {kind: "error", tone: "failed", name: CONDITIONS[conditionFor(event) || "unknown"].label}));
    } else if (/(?:^|\.)(?:execution|agent|node|task)\.(?:started|completed|finished|cancelled)$/.test(type)) {
      add("tick:" + item.sequence, Object.assign(base, {kind: "tick", name: type}));
    }
  });
  return markers;
}
function toolChips(markers) {
  const tools = new Map();
  markers.forEach(function(marker) {
    if (marker.kind !== "tool" && marker.kind !== "approval") return;
    const entry = tools.get(marker.name) || {calls: 0, failed: 0, denied: 0, pending: false};
    if (marker.kind === "tool") { entry.calls++; if (marker.tone === "failed") entry.failed++; }
    if (marker.tone === "denied") entry.denied++;
    if (marker.tone === "pending") entry.pending = true;
    tools.set(marker.name, entry);
  });
  if (!tools.size) return '<span class="cr-unset">no tool calls observed</span>';
  return Array.from(tools.entries()).map(function(entry) {
    const name = entry[0], info = entry[1];
    const parts = [info.calls + (info.calls === 1 ? " call" : " calls")];
    if (info.pending) parts.push("approval");
    if (info.denied) parts.push(info.denied + " denied");
    else if (info.failed) parts.push(info.failed + " failed");
    return '<span class="cr-chip' + (info.pending ? ' is-pending' : info.denied || info.failed ? ' is-failed' : '') + '">' +
      escapeHtml(name) + ' <span>· ' + escapeHtml(parts.join(" · ")) + '</span></span>';
  }).join("");
}
function rowStatus(row, waiting) {
  if (waiting) return "waiting";
  // A local session's own row follows the session, which Cloud derives from turn
  // boundaries: a declined tool or failed turn stays on its markers, not the row.
  const local = (state.run.workload || {}).type === "local" && !row.depth;
  if (local) return ({waiting_for_approval: "waiting", completed: "done"})[state.run.status] || state.run.status;
  if (!row.node) return ({waiting_for_approval: "running", completed: "done"})[state.run.status] || state.run.status;
  return ({completed: "done", waiting: "running"})[row.node.state] || row.node.state;
}
function rowHtml(entry, scale, clock, focusRowKey, rowsCount, metrics) {
  const row = entry.row, markers = entry.markers, status = entry.status, key = row.key;
  const expanded = state.expandedRow === key, active = status === "running" || status === "waiting";
  const times = row.items.map(function(item) { return Date.parse(item.event.timestamp); }).filter(Number.isFinite);
  const first = times.length ? Math.min.apply(null, times) : null, last = times.length ? Math.max.apply(null, times) : null;
  const lineEnd = clock.live && active ? clock.end : last;
  let guides = row.guides.map(function(on, level) { return on ? '<i class="g-v" data-level="' + level + '"></i>' : ''; }).join("");
  if (row.depth) guides += '<i class="g-elbow' + (row.last ? '' : ' g-through') + '" data-level="' + (row.depth - 1) + '"></i>';
  if (row.hasChildren) guides += '<i class="g-down" data-level="' + row.depth + '"></i>';
  // Sparse labels: the focused approval on a waiting row, otherwise the latest activity.
  const waitingLabel = markers.find(function(marker) { return marker.tone === "pending" && marker.approval && marker.approval.id === state.approvalFocus; });
  const latest = waitingLabel || markers.reduce(function(best, marker) { return marker.kind !== "tick" && (!best || marker.time >= best.time) ? marker : best; }, null);
  const counts = {tool: 0, model: 0, approval: 0, error: 0};
  const marks = markers.map(function(marker) {
    if (counts[marker.kind] != null) counts[marker.kind]++;
    const left = position(scale, marker.time), pending = marker === waitingLabel;
    // film: `is-new` (a 0.5 s fade-in on first render) is driven by the
    // marker's age instead of by which markers a browser has already shown.
    const age = state.now - marker.time, fresh = age < 500;
    const label = marker !== latest ? "" : pending ? marker.name + " · waiting" : marker.name;
    return '<span class="mk mk-' + marker.kind + (marker.tone ? ' is-' + marker.tone : '') + (fresh ? ' is-new' : '') + '" data-left="' + left.toFixed(3) + '"' +
      (fresh ? ' data-fade="' + (Math.max(0, age) / 500).toFixed(3) + '"' : '') + ' data-mk="' + escapeHtml(row.key + ":" + marker.kind + ":" + marker.sequence) + '" title="' +
      escapeHtml(marker.name + " · " + clockLabel(marker.time - scale.start)) + '"></span>' +
      (label ? '<span class="mk-label' + (pending ? ' is-pending' : '') + (left > 55 ? ' is-left' : '') + '" data-left="' + left.toFixed(3) + '"' +
        (fresh ? ' data-fade="' + (Math.max(0, age) / 500).toFixed(3) + '"' : '') + '>' + escapeHtml(label) + '</span>' : '');
  }).join("");
  const summary = row.name + ": " + counts.tool + " tool calls, " + counts.model + " model responses, " + counts.approval + " approvals, " + counts.error + " issues";
  const line = first == null ? '' : '<span class="cr-line" data-left="' + position(scale, first).toFixed(3) + '" data-width="' +
    Math.max(0, position(scale, lineEnd) - position(scale, first)).toFixed(3) + '"></span>';
  const statusLabel = {waiting: "waiting", done: "done", failed: "failed", stopped: "stopped", running: "running", idle: "idle"}[status] || String(status).replaceAll("_", " ");
  let html = '<div class="cr-row state-' + escapeHtml(status) + (key === focusRowKey ? ' is-focus' : '') + (expanded ? ' is-expanded' : '') + '" data-depth="' + Math.min(row.depth, 8) + '" data-row="' + escapeHtml(key) + '">' +
    '<div class="cr-tree">' + guides + '<button type="button" class="cr-agent" id="row-' + escapeHtml(key) + '" aria-expanded="' + expanded +
    '" aria-controls="expand-' + escapeHtml(key) + '"><span class="cr-node" aria-hidden="true"></span><span class="cr-name">' + escapeHtml(row.name) + '</span></button></div>' +
    '<div class="cr-status"><span class="cr-state">' + escapeHtml(statusLabel) + '</span></div>' +
    '<div class="cr-timeline"><div class="cr-track" role="img" aria-label="' + escapeHtml(summary) + '">' + line + marks + '</div></div></div>';
  if (expanded) {
    const tools = markers.filter(function(marker) { return marker.kind === "tool"; }).length;
    const models = markers.filter(function(marker) { return marker.kind === "model"; }).length;
    html += '<div class="cr-expand' + (filmEnterProgress("expand") < 1 ? ' is-entering' : '') + '" id="expand-' + escapeHtml(key) + '" data-depth="' + Math.min(row.depth, 8) + '"' + filmEnter("expand") + '>' +
      usageHtml(metrics, rowsCount > 1 ? "run-wide" : "") +
      '<div class="cr-control"><span class="cr-k">Runtime</span><span class="cr-v">' + (first == null ? '—' : escapeHtml(clockLabel(lineEnd - first))) + '</span>' +
      '<span class="cr-bar"></span><span class="cr-note">' + (first == null ? 'no activity yet' : active ? 'elapsed' : 'active time') +
      ' · ' + tools + (tools === 1 ? ' tool call' : ' tool calls') + ' · ' + models + (models === 1 ? ' model response' : ' model responses') + '</span></div>' +
      '<div class="cr-control"><span class="cr-k">Tools</span><span class="cr-v">observed</span><div class="cr-chips">' + toolChips(markers) + '</div></div></div>';
  }
  return html;
}
function eventDetail(event) {
  const meta = event.metadata || {};
  if (meta.tool_name) return actionName(meta.tool_name);
  if (event.event_type === "cloud.run.status_changed") return String(meta.status || "").replaceAll("_", " ");
  if (knownNumber(meta.total_tokens) != null) return "tokens=" + knownNumber(meta.total_tokens).toLocaleString(LOCALE);
  if (knownNumber(meta.run_total_tokens) != null) return "run total=" + knownNumber(meta.run_total_tokens).toLocaleString(LOCALE);
  return "";
}
function liveEventsHtml(rowNames, clock) {
  const recent = state.events.slice(-6);
  return '<section class="cr-events" aria-label="Live events"><h2>Live events</h2>' + (recent.length ? '<ol>' + recent.map(function(item, index) {
    const event = item.event, time = Date.parse(event.timestamp);
    return '<li class="age-' + (recent.length - 1 - index) + '"><time datetime="' + escapeHtml(event.timestamp) + '">' +
      escapeHtml(Number.isFinite(time) ? clockLabel(time - clock.start, true) : "—") + '</time><span class="ev-agent">' +
      escapeHtml(rowNames.get(item.sequence) || "run") + '</span><span class="ev-type' + (isIssue(event) ? ' issue-text' : '') + '">' + escapeHtml(event.event_type) +
      '</span><span class="ev-detail">' + escapeHtml(eventDetail(event)) + '</span></li>';
  }).join("") + '</ol>' : '<p class="cr-empty">' + (clock.live ? 'Waiting for runtime events…' : 'No runtime events reported.') + '</p>') + '</section>';
}
function approvalPanelHtml(approval, pending, rowName) {
  const index = pending.indexOf(approval), busy = Boolean(state.deciding), runtime = (state.run.workload || {}).framework;
  return '<section class="cr-approval' + (filmEnterProgress("panel") < 1 ? ' is-entering' : '') + '" id="approval-panel" role="dialog" aria-modal="false" aria-labelledby="approval-title"' + (busy ? ' aria-busy="true"' : '') + filmEnter("panel") + '>' +
    '<header><h2 id="approval-title"><span class="cr-dot" aria-hidden="true"></span>Approval required</h2>' +
    (runtime ? '<span class="cr-meta">Runtime · ' + escapeHtml(runtime) + '</span>' : '') + '</header>' +
    '<dl><div><dt>Agent</dt><dd class="mono">' + escapeHtml(rowName) + '</dd></div><div><dt>Action</dt><dd>' + escapeHtml(actionName(approval.tool_name)) +
    '</dd></div><div><dt>Waiting</dt><dd class="cr-waiting mono" id="approval-waiting">' + escapeHtml(clockLabel(state.now - Date.parse(approval.created_at))) + '</dd></div></dl>' +
    '<footer><div class="cr-queue"><button type="button" class="cr-quiet" id="approval-hide">Hide</button>' +
    (pending.length > 1 ? '<button type="button" class="cr-quiet" id="approval-prev" aria-label="Previous approval"' + (index === 0 ? ' disabled' : '') + '>‹</button>' +
      '<span>' + (index + 1) + ' of ' + pending.length + '</span><button type="button" class="cr-quiet" id="approval-next" aria-label="Next approval"' +
      (index === pending.length - 1 ? ' disabled' : '') + '>›</button>' : '') + '</div>' +
    '<button type="button" class="cr-btn" id="approval-deny"' + (busy ? ' disabled' : '') + '>Deny</button>' +
    '<button type="button" class="cr-btn cr-btn-primary' + (state.fx.approveHover ? ' film-hover' : '') + '" id="approval-approve"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Submitting…' : 'Approve') + '</button></footer></section>';
}
// film: renderRunDetail() returns the page markup, the breadcrumb and the
// header actions instead of writing them into the document.
function renderRunDetail() {
  if (!state.run) return null;
  const metrics = metricsForRun(), workload = state.run.workload || {}, status = state.run.status;
  const active = !TERMINAL.has(status);
  const breadcrumb = ["Sulcus", "Runs", shortId(state.run.id)];
  const actions = active ? [{label: workload.type === "local" ? "End observation" : "Stop run", className: "button-danger"}] : [];

  const rows = controlRows(), clock = runClock(), scale = state.fx.scale ? state.fx.scale(timeScale(clock), clock) : timeScale(clock);
  const pending = pendingApprovals(), pendingIds = new Set(pending.map(function(item) { return item.id; }));
  // film: a newly arrived approval re-opens the panel (app.js tracks which
  // approvals it has seen); the film states it as `approvalHidden` directly.
  const focus = pending.find(function(item) { return item.id === state.approvalFocus; }) || pending[0] || null;
  state.approvalFocus = focus ? focus.id : null;
  const approvalsByCall = new Map(state.approvals.map(function(item) { return [String(item.tool_call_id), item]; }));
  const representatives = new Set(issuesForRun().map(function(issue) { return issue.sequence; }));
  const modelEvents = state.events.some(function(item) { return /(?:^|\.)llm\./.test(item.event.event_type); });
  const rowNames = new Map(), approvalRows = new Map();
  const entries = rows.map(function(row) {
    const markers = rowMarkers(row, approvalsByCall, representatives, modelEvents);
    row.items.forEach(function(item) { rowNames.set(item.sequence, row.name); });
    markers.forEach(function(marker) {
      if (!marker.approval) return;
      marker.tone = pendingIds.has(marker.approval.id) ? "pending" : marker.approval.status === "denied" ? "denied" :
        marker.approval.status === "approved" ? "approved" : marker.tone;
      approvalRows.set(marker.approval.id, row);
    });
    return {row: row, markers: markers};
  });
  // Every pending approval keeps a marker, even before its request event has arrived.
  pending.forEach(function(item) {
    if (approvalRows.has(item.id)) return;
    approvalRows.set(item.id, rows[0]);
    entries[0].markers.push({sequence: "approval-" + item.id, time: Date.parse(item.created_at), tone: "pending", kind: "approval", name: actionName(item.tool_name), approval: item});
  });
  const waitingRows = new Set(pending.map(function(item) { return approvalRows.get(item.id).key; }));
  entries.forEach(function(entry) { entry.status = rowStatus(entry.row, waitingRows.has(entry.row.key)); });
  const showPanel = Boolean(focus) && !state.approvalHidden, focusRowKey = focus ? approvalRows.get(focus.id).key : null;

  const shown = metrics.tokenViolation && status === "completed" ? "failed" : status;
  const liveLabel = {queued: "Queued", starting: "Starting", running: "Live", idle: "Live", waiting_for_approval: "Live", completed: "Completed", failed: "Failed", stopped: "Stopped"}[shown] || shown;
  const ticks = [];
  for (let offset = scale.step; offset < scale.span - scale.step * 0.2 && ticks.length < 8; offset += scale.step) ticks.push(offset);
  const cursorLeft = position(scale, clock.end).toFixed(3), elapsed = clockLabel(clock.end - clock.start);
  const tokenClass = metrics.tokenViolation ? " is-failed" : metrics.warning ? " is-warning" : "";

  const html = '<section class="cr' + (showPanel || state.fx.focusOut > 0 ? ' is-focused' : '') + '" aria-label="Run control room">' +
    '<header class="cr-head"><div class="cr-ident"><div class="cr-idline"><span class="cr-brand"><img src="' + state.fx.favicon + '" alt="" width="14" height="14">Sulcus</span>' +
    '<span class="cr-path">runs <span aria-hidden="true">/</span> <button type="button" id="copy-run-id" class="cr-runid" title="' + escapeHtml(state.run.id) +
    '" aria-label="Copy run ID ' + escapeHtml(state.run.id) + '">' + escapeHtml(shortId(state.run.id)) + '</button></span>' +
    '<span class="cr-live is-' + escapeHtml(shown) + '"><span class="cr-dot" aria-hidden="true"></span>' + escapeHtml(liveLabel) + '</span>' +
    (pending.length && !showPanel ? '<button type="button" class="cr-pending" id="approval-show">' + pending.length + (pending.length === 1 ? ' approval' : ' approvals') + ' pending</button>' : '') +
    '</div><p class="cr-subtitle"><span title="' + escapeHtml(state.run.name) + '">' + escapeHtml(state.run.name || state.run.agent_id) + '</span><span>' +
    escapeHtml(workload.framework || "Sulcus native") + '</span><span>' + escapeHtml(workload.project || state.run.agent_id) + '</span><span>' +
    escapeHtml(formatDate(state.run.started_at || state.run.created_at)) + '</span></p></div>' +
    '<dl class="cr-stats"><div><dt>Agents</dt><dd>' + rows.length + '</dd></div><div><dt>Tokens</dt><dd class="cr-tokens' + tokenClass + '">' +
    escapeHtml(metrics.tokenTotal == null ? "—" : metrics.tokenTotal.toLocaleString(LOCALE)) +
    (metrics.tokenLimit == null ? '' : '<small> / ' + escapeHtml(metrics.tokenLimit.toLocaleString(LOCALE)) + '</small>') + '</dd></div>' +
    '<div><dt>Runtime</dt><dd id="runtime-duration">' + escapeHtml(elapsed) + '</dd></div></dl></header>' +
    (active && !metrics.tokenViolation ? '' : runSummaryHtml(metrics)) +
    '<div class="cr-stage"><div class="cr-scroll"><div class="cr-grid">' +
    '<div class="cr-cols"><span>Agent tree</span><span>Status</span><div class="cr-axis"><span class="cr-axis-title">Timeline</span>' +
    ticks.map(function(offset) { return '<span class="cr-tick" data-left="' + position(scale, scale.start + offset).toFixed(3) + '">' + escapeHtml(clockLabel(offset)) + '</span>'; }).join("") +
    '<span class="cr-now' + (clock.live ? '' : ' is-final') + '" id="cr-now" data-left="' + cursorLeft + '" title="' + (clock.live ? 'Elapsed' : 'Run ended') + '">' +
    (clock.live ? '' : 'ended ') + escapeHtml(elapsed) + '</span></div></div>' +
    '<div class="cr-rows"><div class="cr-gridlines" aria-hidden="true">' +
    ticks.map(function(offset) { return '<span data-left="' + position(scale, scale.start + offset).toFixed(3) + '"></span>'; }).join("") +
    '<i class="cr-cursor' + (clock.live ? '' : ' is-final') + '" id="cr-cursor" data-left="' + cursorLeft + '"></i></div>' +
    entries.map(function(entry) { return rowHtml(entry, scale, clock, showPanel ? focusRowKey : null, rows.length, metrics); }).join("") +
    '</div></div></div>' + (showPanel ? approvalPanelHtml(focus, pending, approvalRows.get(focus.id).name) : '') + '</div>' +
    liveEventsHtml(rowNames, clock) + '</section>' +
    '<details class="cr-log" id="event-log"' + (state.logOpen ? ' open' : '') + '><summary id="event-log-toggle">Event log <span class="panel-count">' +
    state.events.length + ' events</span></summary><div class="cr-log-body"><div id="tabs" class="tabs-bar">' + renderTabs() + '</div><div id="activity-content">' +
    (state.logOpen ? renderActivity() : '') + '</div></div></details>';
  return {html: html, breadcrumb: breadcrumb, actions: actions, entries: entries, metrics: metrics, clock: clock, scale: scale, pending: pending, showPanel: showPanel};
}

function categoryFor(event) {
  const type = event.event_type.toLowerCase();
  const source = event.source.toLowerCase();
  if (event.level === "ERROR" || type.includes("failed") || type.includes("error")) return "Errors";
  if (type.includes("policy") || type.includes("approval") || type.includes("permission")) return "Policies";
  if (type.startsWith("runtime.tokens")) return "LLM";
  if (type.includes("tool")) return "Tools";
  if (type.includes("llm") || type.includes("model")) return "LLM";
  if (type.includes("agent") || type.includes("process") || type.includes("handoff") ||
      type.includes("crew") || type.includes("task") || type.includes("node")) return "Agents";
  if (source.includes("docker") || source.includes("cloud") || type.startsWith("cloud.")) return "System";
  return "System";
}
function stepForEvent(event, nodes) {
  const meta = event.metadata || {};
  return (nodes || agentNodes()).find(function(node) {
    return operationIdFor(event) && node.runtimeId === String(operationIdFor(event)) && node.scope === String(meta.execution_id || meta.graph_id || "");
  });
}
function presentEvent(event, nodes) {
  const type = event.event_type, meta = event.metadata || {}, step = stepForEvent(event, nodes);
  const condition = conditionFor(event);
  let label = EVENT_LABELS[type] || null, context = "";
  if (condition && isIssue(event)) label = CONDITIONS[condition].label;
  if (!label && /(?:^|\.)llm\.(?:started|requested|completed|finished|failed)$/.test(type)) {
    label = /started$|requested$/.test(type) ? "AI call started" : /failed$/.test(type) ? "AI call failed" : "AI response completed";
    const total = knownNumber(meta.total_tokens);
    context = total == null ? (meta.model || "") : total.toLocaleString(LOCALE) + " tokens";
  } else if (!label && step && /started|completed|finished|failed/.test(type)) {
    label = humanizeName(step.name) + (/started$/.test(type) ? " started" : /failed$/.test(type) ? " failed" : " completed");
    context = step.kind === "tool" ? (/failed$/.test(type) ? "Failed" : /started$/.test(type) ? "Tool" : "Completed") : "";
  } else if (!label && /tool.*(?:started|requested|completed|finished|failed)$/.test(type)) {
    label = meta.tool_name ? humanizeName(meta.tool_name) : /started$/.test(type) ? "Tool started" : /failed$/.test(type) ? "Tool failed" : "Tool completed";
  } else if (!label && /approval_required|approval\.required|approval_requested/.test(type)) label = "Approval required";
  else if (!label && /interrupted$/.test(type)) label = "Execution paused";
  else if (!label && /approval_granted|approval\.granted$/.test(type)) label = "Approval granted";
  else if (!label && /handoff/.test(type)) label = "Agent handoff";
  if (type === "cloud.run.status_changed") {
    label = {completed: "Run completed", failed: "Run stopped", stopped: "Run stopped", waiting_for_approval: "Approval required"}[meta.status] || null;
  }
  if (type === "llm.tool_call_requested") context = humanizeName(meta.tool_name || "Tool");
  if (condition === "tokens" || type === "runtime.tokens.budget_warning") {
    const total = knownNumber(meta.run_total_tokens == null ? meta.consumed_total_tokens : meta.run_total_tokens), limit = knownNumber(meta.max_total_tokens);
    context = total != null && limit != null ? total.toLocaleString(LOCALE) + " / " + limit.toLocaleString(LOCALE) : "";
  }
  return {label: label || "Unexpected failure", context: context};
}
function activityEvents() {
  const issues = issuesForRun(), nodes = agentNodes();
  const representatives = new Set(issues.map(function(issue) { return issue.sequence; }));
  return state.events.filter(function(item) {
    const event = item.event, type = event.event_type;
    if (isIssue(event)) return representatives.has(item.sequence);
    if (type === "cloud.run.status_changed") return Boolean(presentEvent(event, nodes).label !== "Unexpected failure");
    if (type === "runtime.tokens.used") return false; // Usage is already attached to AI responses and the overview.
    if (type === "runtime.tokens.budget_warning") return true;
    if (/\.chain\./.test(type)) return false;
    if (type.includes("observed_")) return false;
    return Boolean(EVENT_LABELS[type]) || (/(?:^|\.)(?:agent|node|task|tool|llm)\./.test(type) && /started|requested|completed|finished|failed|interrupted/.test(type)) || /approval|interrupted|handoff/.test(type);
  });
}
function availableTabs() {
  return [{id: "activity", label: "Activity", count: activityEvents().length}, {id: "technical", label: "Technical", count: state.events.length}];
}
// film: renderTabs(), renderActivity(), renderTimeline() and renderEventList()
// built DOM nodes; these build the same elements as markup.
function renderTabs() {
  return availableTabs().map(function(spec) {
    return '<button id="view-' + spec.id + '" type="button" class="tab' + (state.tab === spec.id ? ' active' : '') + '" aria-pressed="' + String(state.tab === spec.id) + '">' +
      escapeHtml(spec.label) + '<span class="tab-count">' + spec.count + '</span></button>';
  }).join("");
}
function renderActivity() {
  return renderTimeline();
}
function renderTimeline() {
  const items = state.tab === "technical" ? state.events : activityEvents();
  let filters = '<div class="filter-bar">';
  FILTERS.forEach(function(name) {
    const count = items.filter(function(item) { return categoryFor(item.event) === name; }).length;
    if (name !== "All" && !count && state.filter !== name) return;
    const label = state.tab === "technical" ? name : {LLM: "AI", Errors: "Issues", Agents: "Workflow", System: "Run"}[name] || name;
    filters += '<button id="filter-' + name + '" type="button" class="filter-chip' + (state.filter === name ? ' active' : '') + '" aria-pressed="' + String(state.filter === name) + '">' +
      escapeHtml(label + (state.tab === "technical" && name !== "All" ? " " + count : "")) + '</button>';
  });
  filters += '</div>';
  return filters + renderEventList(items.filter(function(item) { return state.filter === "All" || categoryFor(item.event) === state.filter; }));
}
function renderEventList(items) {
  const technical = state.tab === "technical", nodes = agentNodes();
  if (!items.length) {
    return '<div class="event-list" tabindex="0">' + emptyState("No events in this view", "Activity appears as the workflow executes.") + '</div>';
  }
  return '<div class="event-list" tabindex="0" aria-label="' + (technical ? "Technical event stream" : "Workflow activity") + '">' + items.map(function(item) {
    const event = item.event, presentation = presentEvent(event, nodes);
    const metadata = safeMetadata(event.metadata || {});
    const open = state.expanded.has(item.sequence);
    return '<article class="event-row ' + (technical ? "technical-row" : "activity-row") + '" data-sequence="' + item.sequence + '">' +
      '<time class="event-time" datetime="' + escapeHtml(event.timestamp) + '">' + escapeHtml(formatTime(event.timestamp)) + '</time>' +
      (technical ? '<span class="event-source" title="' + escapeHtml(event.source) + '">' + escapeHtml(event.source) + '</span><span class="event-type" title="' + escapeHtml(event.event_type) + '">' + escapeHtml(event.event_type) + '</span>' : '') +
      '<span class="event-summary ' + (isIssue(event) ? 'issue-text' : '') + '">' + escapeHtml(technical ? event.message : presentation.label) + (technical ? '<small class="technical-level">' + escapeHtml(event.level) + '</small>' : '') + '</span>' +
      (technical ? '' : '<span class="event-context">' + escapeHtml(presentation.context) + '</span>') +
      '<button id="event-' + item.sequence + '" class="event-expand" type="button" aria-label="Details for ' + escapeHtml(technical ? event.event_type : presentation.label) + '" aria-expanded="' + String(open) + '" aria-controls="metadata-' + item.sequence + '">' + (open ? "−" : "+") + '</button>' +
      '<pre id="metadata-' + item.sequence + '" class="event-detail"' + (open ? '' : ' hidden') + '>' +
      escapeHtml(JSON.stringify({source: event.source, event_type: event.event_type, level: event.level, message: event.message, metadata: metadata}, null, 2)) + '</pre></article>';
  }).join("") + '</div>';
}
function safeMetadata(value, key) {
  if (key && typeof value === "number" && /^(?:(?:run_)?(?:input|output|total)|max_total|remaining|consumed_total|overage|requested_output)_tokens$|^input_tokens_required$/i.test(key)) return value;
  if (key && /(prompt|input|output|response|content|message)/i.test(key)) return "[hidden by default]";
  if (Array.isArray(value)) return value.map(function(item) { return safeMetadata(item); });
  if (value && typeof value === "object") {
    const result = {};
    Object.keys(value).forEach(function(child) { result[child] = safeMetadata(value[child], child); });
    return result;
  }
  return value;
}

// Runner diagnostics (stderr_summary and stdout_summary) remain in Technical metadata.
function agentNodes() {
  const nodes = new Map(), aliases = new Map(), parents = new Map(), unowned = [];
  state.events.forEach(function(item) {
    const event = item.event, type = event.event_type.toLowerCase(), meta = event.metadata || {};
    const scope = String(meta.execution_id || meta.graph_id || "");
    const runtimeId = operationIdFor(event);
    const alias = runtimeId ? scope + ":" + runtimeId : null;
    const parentId = type.startsWith("langgraph.") ? meta.parent_run_id : meta.parent_span_id;
    if (parentId && alias) parents.set(alias, scope + ":" + parentId);
    if (meta.span_id && parentId) parents.set(scope + ":" + meta.span_id, scope + ":" + parentId);
    let kind = null, identity = null, name = null;
    if (/(?:^|\.)tool\./.test(type) || /^tool_(?:call_denied|call_resource_denied|approval_requested|approval_granted|approval_denied)$/.test(type)) {
      kind = "tool"; identity = runtimeId || meta.tool_name; name = meta.tool_name;
    } else if (/(?:^|\.)agent\./.test(type)) {
      kind = "agent"; identity = runtimeId || meta.agent_id || meta.agent_name || event.source; name = meta.agent_name || meta.agent_role || meta.agent || "Agent";
    } else if (type.includes("langgraph.node")) {
      kind = "node"; identity = runtimeId || meta.langgraph_node || meta.node; name = meta.langgraph_node || meta.node;
    } else if (/(?:^|\.)task\./.test(type)) {
      kind = "task"; identity = runtimeId || meta.task_id || meta.task_name; name = meta.task_name || meta.task_id;
    }
    let node = alias && aliases.has(alias) ? nodes.get(aliases.get(alias)) : null;
    if (!node && kind && identity) {
      const key = scope + ":" + kind + ":" + identity;
      node = nodes.get(key) || {
        key: key, id: String(meta.agent_id || identity), runtimeId: String(runtimeId || identity),
        name: String(name || (kind === "tool" ? "Tool" : "Workflow step")), kind: kind, scope: scope,
        parent: meta.parent_agent_id || meta.parent_agent || null,
        parentRuntime: parentId ? scope + ":" + parentId : null,
        state: "running", start: null, finish: null, condition: null, items: [],
      };
      if (alias) aliases.set(alias, key);
      if (meta.span_id) aliases.set(scope + ":" + meta.span_id, key);
      nodes.set(key, node);
    }
    if (!node) {
      unowned.push({item: item, scope: scope, parent: parentId ? scope + ":" + parentId : null, agent: meta.agent_id || meta.agent_name || meta.agent_role});
      return;
    }
    node.items.push(item);
    if (name) node.name = String(name);
    if (meta.parent_agent_id || meta.parent_agent) node.parent = meta.parent_agent_id || meta.parent_agent;
    if (!node.parent && kind === "tool") node.parent = meta.agent_id || meta.agent_name || meta.agent_role || null;
    if (/started|requested/.test(type)) { if (!node.start) node.start = event.timestamp; node.state = "running"; }
    if (/approval_requested|approval_required/.test(type)) node.state = "waiting";
    if (/completed|finished/.test(type)) { node.state = "completed"; node.finish = event.timestamp; }
    if (isIssue(event)) { node.state = "failed"; node.finish = event.timestamp; node.condition = conditionFor(event); }
    const explicitDuration = knownNumber(meta.duration_ms);
    if (explicitDuration != null) node.duration = explicitDuration;
  });
  const values = Array.from(nodes.values());
  // Follow explicit runtime parent edges, including hidden framework chains.
  function ancestor(parent) {
    const seen = new Set();
    while (parent && !seen.has(parent)) {
      seen.add(parent);
      if (aliases.has(parent)) return aliases.get(parent);
      parent = parents.get(parent);
    }
    return null;
  }
  values.forEach(function(node) {
    node.parentKey = ancestor(node.parentRuntime);
    if (!node.parentKey && node.parent) {
      // Tool calls carry their agent's id too, so a named parent is only ever a step.
      const candidates = values.filter(function(parent) { return parent.key !== node.key && parent.kind !== "tool" && parent.scope === node.scope && (parent.id === String(node.parent) || parent.name === String(node.parent)); });
      if (candidates.length === 1) node.parentKey = candidates[0].key;
    }
  });
  // Events that are not steps themselves (model calls, token usage) belong to their
  // emitted parent or agent; anything else stays unattributed.
  unowned.forEach(function(entry) {
    let key = entry.parent && ancestor(entry.parent);
    if (!key && entry.agent) {
      const candidates = values.filter(function(node) { return node.kind !== "tool" && node.scope === entry.scope && (node.id === String(entry.agent) || node.name === String(entry.agent)); });
      if (candidates.length === 1) key = candidates[0].key;
    }
    if (key) nodes.get(key).items.push(entry.item);
  });
  // Child call failures identify the failed step through their emitted parent.
  state.events.forEach(function(item) {
    const event = item.event, meta = event.metadata || {};
    const parentId = event.event_type.startsWith("langgraph.") ? meta.parent_run_id : meta.parent_span_id || meta.agent_id;
    if (!isIssue(event) || !parentId) return;
    const parentKey = ancestor(String(meta.execution_id || meta.graph_id || "") + ":" + parentId);
    const parent = nodes.get(parentKey);
    if (parent && parent.state === "running") { parent.state = "failed"; parent.finish = event.timestamp; parent.condition = conditionFor(event); }
  });
  values.forEach(function(node) {
    if (node.state === "running" && state.run && TERMINAL.has(state.run.status)) {
      node.state = "stopped"; node.finish = state.run.finished_at || (state.events.length ? state.events[state.events.length - 1].event.timestamp : null);
    }
  });
  return values;
}

// film: entrance progress for the one-shot `is-entering` animations, which
// the film drives itself (state.fx.enter[name] is 0 → 1).
function filmEnterProgress(name) {
  const value = state.fx && state.fx.enter ? state.fx.enter[name] : undefined;
  return value == null ? 1 : value;
}
function filmEnter(name) {
  const k = filmEnterProgress(name);
  return k < 1 ? ' data-enter="' + k.toFixed(3) + '"' : '';
}

// film: the dashboard.html shell around a page, with the active navigation
// item, breadcrumb and header actions that app.js sets for that page.
function shellHtml(nav, breadcrumb, actions, page, account) {
  const navItem = function(name, href, icon, label) {
    return '<a class="nav-item' + (nav === name ? ' active' : '') + '" href="' + href + '" data-nav="' + name + '">' +
      '<span class="nav-icon" aria-hidden="true">' + icon + '</span>\n          ' + label + '\n        </a>';
  };
  const crumbs = breadcrumb.map(function(part, index) {
    const text = escapeHtml(part);
    return index === breadcrumb.length - 1 ? "<strong>" + text + "</strong>" : text;
  }).join(" <span aria-hidden=\"true\">/</span> ");
  const buttons = actions.map(function(item) {
    return '<button class="button ' + (item.className || '') + '" type="button"' + (item.disabled ? ' disabled' : '') + '>' + escapeHtml(item.label) + '</button>';
  }).join("");
  return '<div class="app-shell">' +
    '<aside class="sidebar" aria-label="Primary navigation">' +
      '<a class="brand" href="#/runs" aria-label="Sulcus Cloud home"><img class="brand-mark" src="' + state.fx.favicon + '" alt="" width="28" height="28">' +
      '<span class="brand-word">SULCUS</span><span class="cloud-label">Cloud</span></a>' +
      '<button class="button button-primary sidebar-new" id="sidebar-new-run" type="button"><span aria-hidden="true">＋</span> New run</button>' +
      '<nav class="nav-list">' +
        navItem("runs", "#/runs", "↳", "Runs") +
        navItem("agents", "#/agents", "◇", "Agents") +
        '<span class="nav-label">Workspace</span>' +
        navItem("projects", "#/projects", "⌘", "Projects") +
        '<span class="nav-item disabled" aria-disabled="true"><span class="nav-icon" aria-hidden="true">⌁</span>\n          Policies <span class="soon">Later</span>\n        </span>' +
        '<span class="nav-item disabled" aria-disabled="true"><span class="nav-icon" aria-hidden="true">⌑</span>\n          Secrets <span class="soon">Later</span>\n        </span>' +
      '</nav>' +
      '<div class="account-control"><strong id="account-name">' + escapeHtml(account.name) + '</strong><span id="account-email">' + escapeHtml(account.email) + '</span>' +
        '<button class="auth-link" id="account-signout" type="button">Sign out</button></div>' +
      '<div class="sidebar-footer"><span class="environment-dot" aria-hidden="true"></span><span>Cloud</span><span class="version">v1</span></div>' +
    '</aside>' +
    '<main class="workspace"><header class="topbar"><div id="breadcrumb" class="breadcrumb" aria-label="Breadcrumb">' + crumbs + '</div>' +
      '<div id="page-actions" class="page-actions">' + buttons + '</div></header>' +
      '<section id="app" class="page">' + page + '</section></main>' +
    '</div>';
}

// film: the toast showToast() appends to #toast-region.
function toastHtml(message, isError) {
  return '<div id="toast-region" class="toast-region" aria-live="assertive"><div class="toast' + (isError ? ' error' : '') + '">' + escapeHtml(message) + '</div></div>';
}

// film: entry points. Each takes a state object shaped like app.js's.
export function runDetail(s) { state = s; return renderRunDetail(); }
export function runsPage(s) { state = s; return renderRuns(); }
export function projectsPage(s) { state = s; return renderProjects(); }
export function shell(s, nav, breadcrumb, actions, page, account) { state = s; return shellHtml(nav, breadcrumb, actions, page, account); }
export function toast(message, isError) { return toastHtml(message, isError); }
export function newRunControls(tokenLimit) { return newRunControlsHtml(tokenLimit); }
export function rowsFor(s) { state = s; return controlRows(); }
// film: the time scale app.js would choose for this state (for smoothing its
// changes between frames).
export function runScale(s) { state = s; return timeScale(runClock()); }
export { actionName, clockLabel, formatDuration, shortId };
