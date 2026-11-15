// Labor Game work log: categorized lines, dedup merging, filter window support.
// Shared panel: the same entries render in EVERY .js-log container on the
// page (Work + Home + World + Inventory) - to put the Work Log on a new
// tab, just add <div class="js-log"></div> there - no JS changes needed.
function allLogEls() {
  const els = [...document.querySelectorAll(".js-log")];
  if (els.length) return els;
  // Fallback for stripped copies predating the class.
  return typeof logEl !== "undefined" && logEl ? [logEl] : [];
}
function log(msg, category = "system", mergeKey) {
  // Work Log filters: "start" (action begin text) and "stop"/"full"
  // (action stop and fullLog/completion text) each have their own Filters
  // checkbox; "upgrade" (buyLog), "unlock" and "skillup" announcements too.
  // Anything else is a system message (saves, resets, warnings) that always shows.
  // "full" is an action completing because it ran out (gains full or next
  // cycle unaffordable) - it shares the Stop toggle but renders orange, so
  // completions stand out from plain start/stop lines.
  // mergeKey (optional): consecutive lines with the same key update ONE line
  // in place instead of stacking - repeat upgrade buys refresh their (n/cap)
  // count. Any other log call (key missing or different) breaks the chain.
  if (category === "start" && state.options.logActionBegin === false) return;
  if ((category === "stop" || category === "full") && state.options.logActionStop === false) return;
  if (category === "upgrade" && state.options.logUpgrades === false) return;
  if (category === "unlock" && state.options.logUnlocks === false) return;
  if (category === "skillup" && state.options.logSkillUps === false) return;
  if (category === "improvement" && state.options.logImprovements === false) return;
  if (category === "gather" && state.options.logGathering === false) return;
  if (category === "sell" && state.options.logSelling === false) return;
  if (category === "consume" && state.options.logConsuming === false) return;
  // Back-to-back repeats merge: "You feel rested.", "You feel rested."
  // shows once as "You feel rested. (x2)" - in every visible copy.
  {
    const els = allLogEls();
    const primary = els[0];
    if (msg === lastLogMsg && primary && primary.firstChild) {
      lastLogCount++;
      for (const el of els) if (el.firstChild) el.firstChild.textContent = msg + " (x" + lastLogCount + ")";
      lastLogMergeKey = mergeKey;
      return;
    }
    // Same-key follow-up: rewrite the latest line (e.g. the new count),
    // so buying the same upgrade 4 times leaves one "(4/4)." line.
    if (mergeKey !== undefined && mergeKey !== null && mergeKey === lastLogMergeKey && primary && primary.firstChild) {
      for (const el of els) if (el.firstChild) el.firstChild.textContent = msg;
      lastLogMsg = msg;
      lastLogCount = 1;
      return;
    }
  }
  lastLogMsg = msg;
  lastLogCount = 1;
  lastLogMergeKey = mergeKey;
  // Category marker: lets the Filters window hide/show lines already in
  // the log, retroactively. System and special-message lines stay unmarked
  // by filters (always shown) - special messages get their own class color.
  const cls = category === "start" ? "logStart"
    : category === "stop" ? "logStop"
    : category === "full" ? "logFull"
    : category === "upgrade" ? "logUpgrade"
    : category === "unlock" ? "logUnlock"
    : category === "skillup" ? "logSkillup"
    : category === "specialMessage" ? "logSpecialMessage"
    : category === "gather" ? "logGather"
    : category === "sell" ? "logSell"
    : category === "consume" ? "logConsume"
    : category === "improvement" ? "logImprovement" : "";
 for (const el of allLogEls()) {
   const line = document.createElement("div");
   line.textContent = msg;
   if (cls) line.className = cls;
   el.prepend(line);
 }
 trimLog();
}

// Rich log line: same filters, dedup merging, and categories as log(),
// but the line is DOM - fill(line) appends children (text + colored
// spans). plain is the dedup/merge key and the fallback text (rebuilt
// with fill on merged repeats, so colors survive "(x2)" merges too).
// Lets consume lines paint "+1 Stamina" in the Vital's own color, which
// a plain textContent line could never do.
function logRich(plain, category = "system", fill, mergeKey) {
  if (category === "start" && state.options.logActionBegin === false) return;
  if ((category === "stop" || category === "full") && state.options.logActionStop === false) return;
  if (category === "upgrade" && state.options.logUpgrades === false) return;
  if (category === "unlock" && state.options.logUnlocks === false) return;
  if (category === "skillup" && state.options.logSkillUps === false) return;
  if (category === "improvement" && state.options.logImprovements === false) return;
  if (category === "gather" && state.options.logGathering === false) return;
  if (category === "sell" && state.options.logSelling === false) return;
  if (category === "consume" && state.options.logConsuming === false) return;
  {
    const els = allLogEls();
    const primary = els[0];
    if (plain === lastLogMsg && primary && primary.firstChild) {
      lastLogCount++;
      for (const el of els) {
        if (!el.firstChild) continue;
        el.firstChild.innerHTML = "";
        if (typeof fill === "function") fill(el.firstChild);
        else el.firstChild.textContent = plain;
        el.firstChild.appendChild(document.createTextNode(" (x" + lastLogCount + ")"));
      }
      lastLogMergeKey = mergeKey;
      return;
    }
    if (mergeKey !== undefined && mergeKey !== null && mergeKey === lastLogMergeKey && primary && primary.firstChild) {
      for (const el of els) {
        if (!el.firstChild) continue;
        el.firstChild.innerHTML = "";
        if (typeof fill === "function") fill(el.firstChild);
        else el.firstChild.textContent = plain;
      }
      lastLogMsg = plain;
      lastLogCount = 1;
      return;
    }
  }
  lastLogMsg = plain;
  lastLogCount = 1;
  lastLogMergeKey = mergeKey;
  const cls = category === "start" ? "logStart"
    : category === "stop" ? "logStop"
    : category === "full" ? "logFull"
    : category === "upgrade" ? "logUpgrade"
    : category === "unlock" ? "logUnlock"
    : category === "skillup" ? "logSkillup"
    : category === "specialMessage" ? "logSpecialMessage"
    : category === "gather" ? "logGather"
    : category === "sell" ? "logSell"
    : category === "consume" ? "logConsume"
    : category === "improvement" ? "logImprovement" : "";
  for (const el of allLogEls()) {
    const line = document.createElement("div");
    if (typeof fill === "function") fill(line);
    else line.textContent = plain;
    if (cls) line.className = cls;
    el.prepend(line);
  }
  trimLog();
}

// Gathering merged into the action's startLog: when a gather action (e.g.
// Forage) starts, its startLog line becomes the host - each completed
// cycle's loot appends as "• +N Item" bullets under the start text, so a
// stretch reads as one entry:
//
//   You start gathering some things off the ground...
//   • +2 Apples
//   • +1 Greenleaf
//
// Same-item finds accumulate (+1 Apple, +1 Apple -> +2 Apples); different
// items join as new bullets. Any new start (re-run, another action) arms
// a fresh host; empty cycles add nothing. Item names keep their rarity
// colors (same as the Inventory grid); the line itself is uncolored. The
// "Gathering results" filter hides just the bullets (the start text
// stays, governed by its own filter).
let gatherHost = null; // { aid, items: [{ id, n }], lines: [el...] }
function renderGatherBullets(line, action, items) {
  const old = line.querySelector(":scope > .gather-bullets");
  if (old) old.remove();
  if (!items.length) return;
  const wrap = document.createElement("div");
  wrap.className = "gather-bullets";
  wrap.hidden = state.options.logGathering === false;
  for (const e of items) {
    const def = (typeof getItem === "function") ? getItem(e.id) : null;
    const row = document.createElement("div");
    row.className = "gather-bullet";
    row.appendChild(document.createTextNode("• "));
    const name = document.createElement("span");
    name.textContent = "+" + formatNum(e.n) + " " + (def ? displayName(def, e.n) : e.id);
    if (def && typeof itemRarityClass === "function") name.classList.add(itemRarityClass(def));
    row.appendChild(name);
    wrap.appendChild(row);
  }
  line.appendChild(wrap);
}
// Arm the host after a gather action's startLog lands (the newest line in
// every log copy). Non-gather starts disarm.
function gatherStart(action) {
  gatherHost = null;
  if (!action || action.gather !== true) return;
  const els = allLogEls();
  if (!els.length || !els[0].firstChild) return;
  gatherHost = { aid: action.id, items: [], lines: els.map(el => el.firstChild) };
}
function logGather(loot, action) {
  if (state.options.logGathering === false) return;
  const found = (Array.isArray(loot) ? loot : []).filter(e => e && e.n > 0);
  if (!found.length) return;
  const aid = action ? action.id : "";
  const alive = gatherHost && gatherHost.aid === aid && gatherHost.lines.length &&
    gatherHost.lines.every(el => el && el.isConnected);
  if (!alive) {
    // Host trimmed or cleared mid-run (rare): fall back to a standalone
    // line so finds are never silently dropped.
    gatherHost = null;
    const items = found.map(e => ({ id: e.id, n: e.n }));
    for (const el of allLogEls()) {
      const line = document.createElement("div");
      line.className = "logGather logStart";
      line.appendChild(document.createTextNode("Gathered (" + (action ? action.name : "foraging") + "): "));
      renderGatherBullets(line, action, items);
      // renderGatherBullets appends the wrap after the header text.
      el.prepend(line);
    }
    trimLog();
    gatherHost = { aid, items, lines: allLogEls().map(el => el.firstChild).filter(Boolean) };
    return;
  }
  for (const e of found) {
    const prev = gatherHost.items.find(x => x.id === e.id);
    if (prev) prev.n += e.n;
    else gatherHost.items.push({ id: e.id, n: e.n });
  }
  for (const line of gatherHost.lines) renderGatherBullets(line, action, gatherHost.items);
}

function getLogLimit() {
  if (typeof normalizeLogLimit === "function") return normalizeLogLimit(state && state.options && state.options.logLimit);
  const n = Math.floor(Number(state && state.options && state.options.logLimit));
  if (!Number.isFinite(n)) return 200;
  return Math.min(1000, Math.max(10, n));
}

// Drop oldest entries (at the bottom) once we're over the limit - every copy.
function trimLog() {
  const limit = getLogLimit();
  for (const el of allLogEls()) while (el.children.length > limit) el.lastChild.remove();
}

let lastLogMsg = null;
let lastLogCount = 0;
let lastLogMergeKey = null;

// Fresh-game intro line (boot + hard reset): a special message so it renders
// in the one-time yellow style like blanket/pillow/pockets messages.
const INTRO_LOG_TEXT = "You're a homeless villager living in a small town. Perhaps if you help some folk, they'll lend you some coin?";
function logIntro() {
  log(INTRO_LOG_TEXT, "specialMessage");
}

function clearLog() {
  for (const el of allLogEls()) el.innerHTML = "";
  lastLogMsg = null;
  lastLogCount = 0;
  lastLogMergeKey = null;
  gatherHost = null;
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
      || (c.contains("logSkillup") && state.options.logSkillUps === false)
      || (c.contains("logImprovement") && state.options.logImprovements === false)
      || (c.contains("logGather") && state.options.logGathering === false)
      || (c.contains("logSell") && state.options.logSelling === false)
      || (c.contains("logConsume") && state.options.logConsuming === false);
    // StartLog-hosted gather bullets hide with the Gathering filter while
    // the start text itself stays (governed by its own filter).
    for (const b of line.querySelectorAll(".gather-bullets")) b.hidden = state.options.logGathering === false;
  }
}

// Log text can be a single string or an array of variants - one is
// picked at random each time. Used by startLog/stopLog/fullLog/stopFullLog
// (via pickActionLog, which adds the conditionalLogs pool).
function pickLog(value, fallback) {
  if (Array.isArray(value)) {
    const options = value.filter(v => typeof v === "string" && v);
    if (!options.length) return fallback;
    return options[Math.floor(Math.random() * options.length)];
  }
  if (typeof value === "string" && value) return value;
  return fallback;
}

// Conditional action logs: extra start/stop/full/stopFull variants that
// join the random pick only while their requires hold (validated by
// cleanConditionalLogs in core.js). Lets log lines react to progress - a
// special start line once a skill hits Level 2, a different full line
// after buying an upgrade. With no requires the text always joins the
// pool (useful as extra weight); an empty pool returns null so callers
// fall back to their default text exactly like pickLog.
function logRequiresMet(req) {
  if (!req) return true;
  for (const [id, n] of Object.entries(req.skills ?? {})) {
    if (typeof skillLevel !== "function") return false;
    if (skillLevel(id) < n) return false;
  }
  for (const [id, n] of Object.entries(req.upgrades ?? {})) if ((state.upgrades[id] ?? 0) < n) return false;
  for (const [id, n] of Object.entries(req.resources ?? {})) if ((state.amounts[id] ?? 0) < n) return false;
  for (const [id, n] of Object.entries(req.actions ?? {})) if ((state.stats.actions[id] ?? 0) < n) return false;
  for (const [id, n] of Object.entries(req.furniture ?? {})) if ((state.furniture[id] ?? 0) < n) return false;
  for (const id of req.homes ?? []) if (!state.homes[id]) return false;
  return true;
}

function pickActionLog(action, baseField, condKey) {
  if (!action) return null;
  const pool = [];
  const push = (v) => {
    if (typeof v === "string") { if (v) pool.push(v); }
    else if (Array.isArray(v)) for (const e of v) if (typeof e === "string" && e) pool.push(e);
  };
  push(action[baseField]);
  for (const e of action.conditionalLogs ?? []) {
    if (!e || typeof e !== "object") continue;
    if (logRequiresMet(e.requires)) push(e[condKey]);
  }
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
