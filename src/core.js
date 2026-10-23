// Labor Game core: DOM refs, lookups, formatters, costs, tags, unlocks, state factory.
/* ============================================================
   GAME ENGINE - you should not need to edit below this line.
   It reads RESOURCES, ACTIONS, and UPGRADES above, so new items just work.
   ============================================================ */

const currenciesCtn = document.getElementById("currenciesCtn");
const vitalsCtn = document.getElementById("vitalsCtn");
const actionsCtn = document.getElementById("actionsCtn");
const statusEl = document.getElementById("statusEl");
const resetBtn = document.getElementById("resetBtn");
const logEl = document.getElementById("logEl");
const clearLogBtn = document.getElementById("clearLogBtn");
const logFilterBtn = document.getElementById("logFilterBtn");
const logFilterModal = document.getElementById("logFilterModal");
const logFilterCloseBtn = document.getElementById("logFilterCloseBtn");
const logActionsChk = document.getElementById("logActionsChk");
const logUpgradesChk = document.getElementById("logUpgradesChk");
const logUnlocksChk = document.getElementById("logUnlocksChk");
const logImprovementsChk = document.getElementById("logImprovementsChk");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importInput = document.getElementById("importInput");
const exportClipBtn = document.getElementById("exportClipBtn");
const importClipBtn = document.getElementById("importClipBtn");
const clipBox = document.getElementById("clipBox");
const clipArea = document.getElementById("clipArea");
const clipLoadBtn = document.getElementById("clipLoadBtn");
let clipMode = null;
const tabWorkBtn = document.getElementById("tabWorkBtn");
const tabOptionsBtn = document.getElementById("tabOptionsBtn");
const tabWork = document.getElementById("tabWork");
const tabOptions = document.getElementById("tabOptions");
const showMaxedChk = document.getElementById("showMaxedChk");
const manualSaveBtn = document.getElementById("manualSaveBtn");
const manualLoadBtn = document.getElementById("manualLoadBtn");
// Live DOM refs per item, rebuilt by buildUI: render() reads these
// instead of querying the DOM every frame (keeps 50ms renders cheap
// with hundreds of items on screen).
const uiRefs = new Map();

function showTab(which) {
  tabWork.hidden = which !== "work";
  tabOptions.hidden = which !== "options";
  tabWorkBtn.classList.toggle("active", which === "work");
  tabOptionsBtn.classList.toggle("active", which === "options");
  tabWorkBtn.setAttribute("aria-selected", which === "work" ? "true" : "false");
  tabOptionsBtn.setAttribute("aria-selected", which === "options" ? "true" : "false");
}

const configWarnings = normalizeConfig();
let state = makeFreshState();
let lastTime = performance.now();

function makeFreshState() {
  const amounts = {};
  for (const r of RESOURCES) amounts[r.id] = r.start ?? 0;
  const upgrades = {};
  for (const u of UPGRADES) upgrades[u.id] = 0;
  return { amounts, upgrades, unlocked: {}, options: { showMaxedUpgrades: false, logActions: true, logUpgrades: true, logUnlocks: true, logImprovements: true }, stats: { actions: {} }, currentActionId: null, cycles: {} };
}

function getResource(id) {
  return RESOURCES.find(r => r.id === id);
}

function isCurrency(def) {
  // Currencies go in the left box with no bar (they may still have a
  // finite cap); everything else goes in the right box with a bar.
  // `kind` overrides the max-based default below.
  if (def.kind === "currency") return true;
  if (def.kind === "vital") return false;
  return def.max === Infinity;
}

function formatNum(n) {
  // Integers show with no decimals (1 -> "1"); fractional numbers show
  // at least one decimal, up to three, with float noise trimmed
  // (1.1 -> "1.1", 1.11 -> "1.11", 1.115 -> "1.115", 0.30000000000004 -> "0.3").
  if (n === Infinity) return "\u221E";
  if (n === -Infinity) return "-\u221E";
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}

function displayName(def, val) {
  // Plural follows the displayed value: "Coin" when it shows "1", else "Coins".
  // Resources without `plural` always show `name`.
  return formatNum(val) === "1" || !def.plural ? def.name : def.plural;
}

// Minute support for durations: 90 -> "1m 30s", 120 -> "2m".
// Below a minute, `sub` formats the seconds ("2s" in auto descriptions,
// "1.98s" on the live countdown). No hour support: no action lasts that long.
function formatDuration(totalSeconds, sub) {
  totalSeconds = Math.max(0, totalSeconds);
  const m = Math.floor(totalSeconds / 60);
  if (m <= 0) return sub(totalSeconds);
  const s = Math.floor(totalSeconds - m * 60 + 1e-9);
  return s > 0 ? m + "m " + s + "s" : m + "m";
}

function getAction(id) {
  return ACTIONS.find(a => a.id === id);
}

function getUpgrade(id) {
  return UPGRADES.find(u => u.id === id);
}

// Tooltip tags: any resource, action, or upgrade can carry `tags: [...]`
// (e.g. { tags: ["Work", "Charismatic"] }). Tags render as small chips
// directly below the tooltip header. Other code checks them with
// hasTag(item, "Work"), withTag(ACTIONS, "Work"), or itemsWithTag("Work")
// (which searches RESOURCES + ACTIONS + UPGRADES together).
function getTags(item) {
  return item && Array.isArray(item.tags) ? item.tags : [];
}

function hasTag(item, tag) {
  return getTags(item).includes(tag);
}

function withTag(list, tag) {
  return (list || []).filter(e => hasTag(e, tag));
}

function itemsWithTag(tag) {
  return [...withTag(RESOURCES, tag), ...withTag(ACTIONS, tag), ...withTag(UPGRADES, tag)];
}

// Tag chips for tooltips: null when the item has no tags, so builders
// just append the row when present, right below the header.
function buildTipTags(item) {
  const tags = getTags(item);
  if (!tags.length) return null;
  const row = document.createElement("div");
  row.className = "tip-tags";
  for (const t of tags) {
    const chip = document.createElement("span");
    chip.className = "tip-tag";
    chip.textContent = t;
    row.appendChild(chip);
  }
  return row;
}

// Sticky unlocks: hidden until the condition is first met, then visible
// forever (persisted in the save) with a one-time Work Log message.
// Same shape everywhere: { resource: "coin", amount: 5 }. Add `unlock`
// to any action or upgrade to gate it; groups with nothing visible
// collapse on their own. Set `unlockLog` to customize the message;
// it defaults to "Unlocked Action: <name>" / "Unlocked Upgrade: <name>".
function unlockMet(item, prefix) {
  if (!item.unlock) return true;
  const key = prefix + ":" + item.id;
  if (state.unlocked[key]) return true;
  if ((state.amounts[item.unlock.resource] ?? 0) >= item.unlock.amount) {
    state.unlocked[key] = true;
    log(item.unlockLog ?? ("Unlocked " + (prefix === "u" ? "Upgrade" : "Action") + ": " + item.name), "unlock");
    return true;
  }
  return false;
}

function hideEmptyGroups(ctn) {
  // Collapse sections whose every button is hidden (unlock/maxed-gated),
  // then headers whose every group is hidden.
  for (const g of ctn.querySelectorAll(".taskGroup")) {
    const btns = [...g.querySelectorAll("button")];
    g.hidden = btns.length > 0 && btns.every(b => b.hidden);
  }
  for (const h of ctn.querySelectorAll(".taskHeader")) {
    const gs = [...h.querySelectorAll(".taskGroup")];
    h.hidden = gs.length > 0 && gs.every(g => g.hidden);
  }
}

function getEffectiveMax(resourceId) {
  // Base max from RESOURCES plus every owned "max" upgrade effect.
  const def = getResource(resourceId);
  if (!def || def.max === undefined || def.max === Infinity) return Infinity;
  let max = def.max;
  for (const u of UPGRADES) {
    const owned = state.upgrades[u.id] ?? 0;
    if (!owned) continue;
    for (const e of u.effects || []) {
      if (e.type === "max" && e.resource === resourceId) max += e.amount * owned;
    }
  }
  return max;
}

function describeCost(cost) {
  const parts = [];
  for (const [id, n] of Object.entries(cost ?? {})) {
    const def = getResource(id);
    parts.push(formatNum(n) + " " + (def ? def.name : id));
  }
  return parts.join(", ");
}

function canAfford(costs) {
  for (const [id, n] of Object.entries(costs ?? {})) {
    if ((state.amounts[id] ?? 0) < n) return false;
  }
  return true;
}

// True when a cost can never be fully saved up for: it asks for more of
// some resource than the player's current max cap holds (e.g. 15 Coin
// when the cap is 10). Such buttons get a red "Name*" label (tooltips
// keep the plain name). Re-checked every frame: buying a max upgrade
// can lift the cap and clear the mark.
function costExceedsMax(costs) {
  for (const [id, n] of Object.entries(costs ?? {})) {
    if (n > getEffectiveMax(id)) return true;
  }
  return false;
}

function gainsAreFull(gains) {
  // True if every gain is already at max (e.g. Rest at full Stamina).
  // Capped currencies never count: producing past the cap just destroys
  // the excess, so the action keeps running instead of stopping.
  const keys = Object.keys(gains ?? {}).filter(id => {
    const def = getResource(id);
    return def && !isCurrency(def);
  });
  if (keys.length === 0) return false;
  return keys.every(id => {
    const max = getEffectiveMax(id);
    if (max === Infinity) return false;
    return (state.amounts[id] ?? 0) >= max;
  });
}

// Costs are paid once per action cycle, up front when the cycle starts.
function payCosts(costs) {
  for (const [id, n] of Object.entries(costs ?? {})) state.amounts[id] -= n;
}

// Improvement level from completions: every `every` runs is +1 level,
// capped at maxLevel. A pure function of the run count - no extra state,
// so level-ups can never be missed or double-fired.
function actionLevel(a) {
  const imp = a.improvements;
  if (!imp) return 0;
  return Math.min(imp.maxLevel, Math.floor((state.stats.actions[a.id] ?? 0) / imp.every));
}

// One cycle's payout: base gains plus the improvement bonus per level.
function effectiveGains(a) {
  const out = { ...(a.gains ?? {}) };
  const imp = a.improvements;
  if (imp && imp.bonus) {
    const lvl = actionLevel(a);
    if (lvl > 0) for (const [id, n] of Object.entries(imp.bonus)) out[id] = (out[id] ?? 0) + n * lvl;
  }
  return out;
}

// Bottom line of an improved action's tooltip: progress to the next level.
function improvementFooter(a) {
  const imp = a.improvements;
  if (actionLevel(a) >= imp.maxLevel) return "Max level";
  const pct = Math.floor(((state.stats.actions[a.id] ?? 0) % imp.every) / imp.every * 100);
  return pct + "% to next Improvement";
}

function normalizeConfig() {
  const warnings = [];
  const warn = (m) => warnings.push(m);
  // Purge unusable entries first (arrays are const, so edit in place):
  // a missing id would crash every engine loop, and duplicate ids would
  // share one DOM id. Later duplicates are removed, keeping the first.
  // Entries added later at runtime should call normalizeConfig() again
  // before buildUI().
  for (const [arr, kind] of [[RESOURCES, "resource"], [ACTIONS, "action"], [UPGRADES, "upgrade"]]) {
    const seen = new Set();
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (!e || typeof e.id !== "string" || !e.id) {
        warn("Removed " + kind + " with no id.");
        arr.splice(i, 1); i--; continue;
      }
      if (seen.has(e.id)) {
        warn("Duplicate " + kind + ' id "' + e.id + '" - removed the later entry.');
        arr.splice(i, 1); i--; continue;
      }
      seen.add(e.id);
    }
  }
  for (const r of RESOURCES) {
    if (typeof r.name !== "string" || !r.name) r.name = r.id;
    if (typeof r.start !== "number" || !Number.isFinite(r.start) || r.start < 0) {
      if (r.start !== undefined) warn('Resource "' + r.id + '": bad start, reset to 0.');
      r.start = 0;
    }
    if (r.max === undefined) r.max = Infinity;
    if (r.max !== Infinity && (!Number.isFinite(r.max) || r.max <= 0)) {
      warn('Resource "' + r.id + '": bad max, treated as uncapped.');
      r.max = Infinity;
    }
    if (r.kind !== undefined && r.kind !== "currency" && r.kind !== "vital") {
      warn('Resource "' + r.id + '": bad kind, ignored.');
      delete r.kind;
    }
    cleanTags(r, 'Resource "' + r.id + '"');
    cleanHeader(r, 'Resource "' + r.id + '"');
  }
  const cleanMap = (map, ownerLabel, kind) => {
    if (map === undefined) return {};
    if (!map || typeof map !== "object" || Array.isArray(map)) {
      warn(ownerLabel + ": bad " + kind + ", ignored.");
      return {};
    }
    const cleaned = {};
    for (const [k, v] of Object.entries(map)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
        warn(ownerLabel + ": bad " + kind + ' amount for "' + k + '", skipped.');
        continue;
      }
      if (v === 0) continue; // zero amounts are free: drop them so tips stay clean.
      if (!getResource(k)) warn(ownerLabel + ": " + kind + ' references unknown resource "' + k + '".');
      cleaned[k] = v;
    }
    return cleaned;
  };
  const cleanUnlock = (item, ownerLabel) => {
    if (item.unlock === undefined) return;
    const k = item.unlock;
    if (!k || typeof k !== "object" || typeof k.resource !== "string" || typeof k.amount !== "number" || !Number.isFinite(k.amount) || k.amount < 0) {
      warn(ownerLabel + ": bad unlock, always visible.");
      delete item.unlock;
      return;
    }
    if (!getResource(k.resource)) warn(ownerLabel + ': unlock watches unknown resource "' + k.resource + '".');
    item.unlock = { resource: k.resource, amount: k.amount };
  };
  function cleanHeader(item, ownerLabel) {
    if (item.header === undefined) return;
    if (typeof item.header !== "string" || !item.header) {
      warn(ownerLabel + ": bad header, ignored.");
      delete item.header;
    }
  };
  function cleanTags(item, ownerLabel) {
    if (item.tags === undefined) { item.tags = []; return; }
    if (!Array.isArray(item.tags)) {
      warn(ownerLabel + ": bad tags, ignored.");
      item.tags = [];
      return;
    }
    const kept = [];
    for (const t of item.tags) {
      if (typeof t !== "string" || !t.trim()) {
        warn(ownerLabel + ": skipped a bad tag (use non-empty strings).");
        continue;
      }
      const name = t.trim();
      if (!kept.includes(name)) kept.push(name);
    }
    item.tags = kept;
  }
  const cleanLogField = (item, field, ownerLabel) => {
    const v = item[field];
    if (v === undefined) return;
    const ok = typeof v === "string" ? !!v : Array.isArray(v) && v.some(e => typeof e === "string" && e);
    if (!ok) {
      warn(ownerLabel + ": bad " + field + " (use a string or an array of strings), using the default.");
      delete item[field];
    }
  };
  for (const a of ACTIONS) {
    if (typeof a.name !== "string" || !a.name) a.name = a.id;
    if (typeof a.tickSeconds !== "number" || !Number.isFinite(a.tickSeconds) || a.tickSeconds <= 0) {
      if (a.tickSeconds !== undefined) warn('Action "' + a.id + '": bad tickSeconds, reset to 1.');
      a.tickSeconds = 1;
    }
    a.costs = cleanMap(a.costs, 'Action "' + a.id + '"', "cost");
    a.gains = cleanMap(a.gains, 'Action "' + a.id + '"', "gain");
    cleanUnlock(a, 'Action "' + a.id + '"');
    cleanTags(a, 'Action "' + a.id + '"');
    cleanHeader(a, 'Action "' + a.id + '"');
    if (a.improvements !== undefined) {
      const imp = a.improvements, impLabel = 'Action "' + a.id + '" improvement';
      if (!imp || typeof imp !== "object" || !Number.isInteger(imp.every) || imp.every <= 0) {
        warn('Action "' + a.id + '": bad improvements (need { every: <positive integer>, ... }), ignored.');
        delete a.improvements;
      } else {
        if (imp.maxLevel === undefined) imp.maxLevel = Infinity;
        if (imp.maxLevel !== Infinity && (!Number.isInteger(imp.maxLevel) || imp.maxLevel <= 0)) {
          warn(impLabel + ": bad maxLevel, uncapped.");
          imp.maxLevel = Infinity;
        }
        imp.bonus = cleanMap(imp.bonus, impLabel, "bonus");
        cleanLogField(imp, "improvementLog", impLabel);
      }
    }
    if (a.description !== undefined && typeof a.description !== "string") {
      warn('Action "' + a.id + '": bad description, auto-generated.');
      delete a.description;
    }
    if (!a.description) a.description = autoActionDescription(a);
    cleanLogField(a, "startLog", 'Action "' + a.id + '"');
    cleanLogField(a, "stopLog", 'Action "' + a.id + '"');
    cleanLogField(a, "fullLog", 'Action "' + a.id + '"');
  }
  for (const u of UPGRADES) {
    if (typeof u.name !== "string" || !u.name) u.name = u.id;
    u.cost = cleanMap(u.cost, 'Upgrade "' + u.id + '"', "cost");
    cleanUnlock(u, 'Upgrade "' + u.id + '"');
    cleanTags(u, 'Upgrade "' + u.id + '"');
    cleanHeader(u, 'Upgrade "' + u.id + '"');
    if (u.maxPurchases === undefined) u.maxPurchases = 1;
    if (u.maxPurchases !== Infinity && (!Number.isFinite(u.maxPurchases) || u.maxPurchases <= 0)) {
      warn('Upgrade "' + u.id + '": bad maxPurchases, reset to 1.');
      u.maxPurchases = 1;
    } else if (Number.isFinite(u.maxPurchases) && !Number.isInteger(u.maxPurchases)) {
      const fixed = Math.max(1, Math.floor(u.maxPurchases));
      warn('Upgrade "' + u.id + '": maxPurchases rounded down to ' + fixed + '.');
      u.maxPurchases = fixed;
    }
    if (u.effects === undefined) u.effects = [];
    if (!Array.isArray(u.effects)) {
      warn('Upgrade "' + u.id + '": bad effects, ignored.');
      u.effects = [];
    } else {
      const kept = [];
      for (const e of u.effects) {
        if (!e || e.type !== "max" || typeof e.resource !== "string" || typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount <= 0) {
          warn('Upgrade "' + u.id + '": skipped an invalid effect (use { type: "max", resource, amount }).');
          continue;
        }
        if (!getResource(e.resource)) warn('Upgrade "' + u.id + '": effect targets unknown resource "' + e.resource + '".');
        kept.push({ type: "max", resource: e.resource, amount: e.amount });
      }
      u.effects = kept;
    }
    if (u.description !== undefined && typeof u.description !== "string") {
      warn('Upgrade "' + u.id + '": bad description, auto-generated.');
      delete u.description;
    }
    if (!u.description) u.description = autoUpgradeDescription(u);
  }
  return warnings;
}

// Resource tooltip: header row (name left, amount/cap right), tag chips
// below it, a right-aligned per-second row (only while nonzero), then
// the description text. The live numbers are filled in by render().
