// Labor Game work log: categorized lines, dedup merging, filter window support.
// Shared panel: the same entries render in EVERY .js-log container on the
// page (Work + Home today). To put the Work Log on a new tab, just add
// <div class="js-log"></div> there - no JS changes needed.
function allLogEls() {
  const els = [...document.querySelectorAll(".js-log")];
  if (els.length) return els;
  // Fallback for stripped copies predating the class.
  return typeof logEl !== "undefined" && logEl ? [logEl] : [];
}
function log(msg, category = "system") {
  // Work Log filters: "start" (action begin text) and "stop"/"full"
  // (action stop and fullLog/completion text) each have their own Filters
  // checkbox; "upgrade" (buyLog) and "unlock" announcements too.
  // Anything else is a system message (saves, resets, warnings) that always shows.
  // "full" is an action completing because it ran out (gains full or next
  // cycle unaffordable) - it shares the Stop toggle but renders orange, so
  // completions stand out from plain start/stop lines.
  if (category === "start" && state.options.logActionBegin === false) return;
  if ((category === "stop" || category === "full") && state.options.logActionStop === false) return;
  if (category === "upgrade" && state.options.logUpgrades === false) return;
  if (category === "unlock" && state.options.logUnlocks === false) return;
  if (category === "improvement" && state.options.logImprovements === false) return;
  // Back-to-back repeats merge: "You feel rested.", "You feel rested."
  // shows once as "You feel rested. (x2)" - in every visible copy.
  {
    const els = allLogEls();
    const primary = els[0];
    if (msg === lastLogMsg && primary && primary.firstChild) {
      lastLogCount++;
      for (const el of els) if (el.firstChild) el.firstChild.textContent = msg + " (x" + lastLogCount + ")";
      return;
    }
  }
  lastLogMsg = msg;
  lastLogCount = 1;
  // Category marker: lets the Filters window hide/show lines already in
  // the log, retroactively. System and milestone lines stay unmarked by
  // filters (always shown) - milestones get their own class for color.
  const cls = category === "start" ? "logStart"
    : category === "stop" ? "logStop"
    : category === "full" ? "logFull"
    : category === "upgrade" ? "logUpgrade"
    : category === "unlock" ? "logUnlock"
    : category === "milestone" ? "logMilestone"
    : category === "improvement" ? "logImprovement" : "";
  for (const el of allLogEls()) {
    const line = document.createElement("div");
    line.textContent = msg;
    if (cls) line.className = cls;
    el.prepend(line);
  }
  trimLog();
}

function getLogLimit() {
  if (typeof normalizeLogLimit === "function") return normalizeLogLimit(state && state.options && state.options.logLimit);
  const n = Math.floor(Number(state && state.options && state.options.logLimit));
  if (!Number.isFinite(n)) return 200;
  return Math.min(1000, Math.max(20, n));
}

// Drop oldest entries (at the bottom) once we're over the limit - every copy.
function trimLog() {
  const limit = getLogLimit();
  for (const el of allLogEls()) while (el.children.length > limit) el.lastChild.remove();
}

let lastLogMsg = null;
let lastLogCount = 0;

function clearLog() {
  for (const el of allLogEls()) el.innerHTML = "";
  lastLogMsg = null;
  lastLogCount = 0;
}

// Work Log Filters window: each checkbox hides/shows one category of log
// entries - including lines already showing (retroactive), in every visible
// copy. System messages (saves, resets, warnings) always show.
function applyLogFilters() {
  for (const el of allLogEls()) for (const line of el.children) {
    const c = line.classList;
    line.hidden = (c.contains("logStart") && state.options.logActionBegin === false)
      || ((c.contains("logStop") || c.contains("logFull")) && state.options.logActionStop === false)
      || (c.contains("logUpgrade") && state.options.logUpgrades === false)
      || (c.contains("logUnlock") && state.options.logUnlocks === false)
      || (c.contains("logImprovement") && state.options.logImprovements === false);
  }
}

// Log text can be a single string or an array of variants - one is
// picked at random each time. Used by startLog/stopLog/fullLog.
function pickLog(value, fallback) {
  if (Array.isArray(value)) {
    const options = value.filter(v => typeof v === "string" && v);
    if (!options.length) return fallback;
    return options[Math.floor(Math.random() * options.length)];
  }
  if (typeof value === "string" && value) return value;
  return fallback;
}

