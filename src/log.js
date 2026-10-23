// Labor Game work log: categorized lines, dedup merging, filter window support.
function log(msg, category = "system") {
  // Work Log filters: "action" (start/stop/finish), "upgrade" (buyLog),
  // and "unlock" announcements can each be hidden via the Filters window.
  // Anything else is a system message (saves, resets, warnings) that always shows.
  if (category === "action" && state.options.logActions === false) return;
  if (category === "upgrade" && state.options.logUpgrades === false) return;
  if (category === "unlock" && state.options.logUnlocks === false) return;
  if (category === "improvement" && state.options.logImprovements === false) return;
  // Back-to-back repeats merge: "You feel rested.", "You feel rested."
  // shows once as "You feel rested. (x2)".
  if (msg === lastLogMsg && logEl.firstChild) {
    lastLogCount++;
    logEl.firstChild.textContent = msg + " (x" + lastLogCount + ")";
    return;
  }
  lastLogMsg = msg;
  lastLogCount = 1;
  const line = document.createElement("div");
  line.textContent = msg;
  // Category marker: lets the Filters window hide/show lines already in
  // the log, retroactively. System lines stay unmarked (always shown).
  if (category === "action") line.className = "logAction";
  else if (category === "upgrade") line.className = "logUpgrade";
  else if (category === "unlock") line.className = "logUnlock";
  else if (category === "improvement") line.className = "logImprovement";
  logEl.prepend(line);
  while (logEl.children.length > 30) logEl.lastChild.remove();
}

let lastLogMsg = null;
let lastLogCount = 0;

function clearLog() {
  logEl.innerHTML = "";
  lastLogMsg = null;
  lastLogCount = 0;
}

// Work Log Filters window: each checkbox hides/shows one category of log
// entries - including lines already showing (retroactive). System messages
// (saves, resets, warnings) always show.
function applyLogFilters() {
  for (const line of logEl.children) {
    const c = line.classList;
    line.hidden = (c.contains("logAction") && state.options.logActions === false)
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

