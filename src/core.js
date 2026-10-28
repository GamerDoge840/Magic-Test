// Labor Game core: DOM refs, lookups, formatters, costs, tags, unlocks, state factory.
/* ============================================================
   GAME ENGINE - you should not need to edit below this line.
   It reads RESOURCES, ACTIONS, and UPGRADES above, so new items just work.
   ============================================================ */

const currenciesCtn = document.getElementById("currenciesCtn");
const vitalsCtn = document.getElementById("vitalsCtn");
// Home-tab mirrors (may be null in stripped-down copies): the resource and
// log builders below fan out to EVERY .js-currencies / .js-vitals / .js-log
// container in the page, so adding these panels to a future tab is just
// adding three divs with those classes - no JS changes needed.
const currenciesCtnHome = document.getElementById("currenciesCtnHome");
const vitalsCtnHome = document.getElementById("vitalsCtnHome");
const logElHome = document.getElementById("logElHome");
const actionsCtn = document.getElementById("actionsCtn");
const statusEl = document.getElementById("statusEl");
const resetBtn = document.getElementById("resetBtn");
const logEl = document.getElementById("logEl");
const clearLogBtn = document.getElementById("clearLogBtn");
const logFilterBtn = document.getElementById("logFilterBtn");
const logFilterModal = document.getElementById("logFilterModal");
const logFilterCloseBtn = document.getElementById("logFilterCloseBtn");
const logFilterBtnHome = document.getElementById("logFilterBtnHome");
const clearLogBtnHome = document.getElementById("clearLogBtnHome");
const logBeginChk = document.getElementById("logBeginChk");
const logStopChk = document.getElementById("logStopChk");
const logUpgradesChk = document.getElementById("logUpgradesChk");
const logUnlocksChk = document.getElementById("logUnlocksChk");
const logSkillUpsChk = document.getElementById("logSkillUpsChk");
const logImprovementsChk = document.getElementById("logImprovementsChk");
const balloonFilterBtn = document.getElementById("balloonFilterBtn");
const balloonFilterModal = document.getElementById("balloonFilterModal");
const balloonFilterCloseBtn = document.getElementById("balloonFilterCloseBtn");
const balloonSkillChk = document.getElementById("balloonSkillChk");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importInput = document.getElementById("importInput");
const exportClipBtn = document.getElementById("exportClipBtn");
const importClipBtn = document.getElementById("importClipBtn");
const clipBox = document.getElementById("clipBox");
const clipArea = document.getElementById("clipArea");
const clipLoadBtn = document.getElementById("clipLoadBtn");
let clipMode = null;
// Item-hiding mode (purely visual): per panel kind (currencies, vitals,
// actions, milestones). While on, user-hidden items show struck-through so they can be
// unhidden; exiting re-applies the hiding. Runtime-only, never saved.
const hidingMode = { currencies: false, vitals: false, actions: false, milestones: false };
// User-hidden item ids ("a:<id>", "u:<id>", "r:<id>", "m:<skillId>:<level>"), from hiding mode.
// Display-only: hidden things still work (actions run, unlocks land).
function itemHidden(key) {
  return !!state.options.hidden[key];
}
const tabWorkBtn = document.getElementById("tabWorkBtn");
const tabPlayerBtn = document.getElementById("tabPlayerBtn");
const tabSkillsBtn = document.getElementById("tabSkillsBtn");
const tabOptionsBtn = document.getElementById("tabOptionsBtn");
const tabWork = document.getElementById("tabWork");
const tabPlayer = document.getElementById("tabPlayer");
const tabSkills = document.getElementById("tabSkills");
const tabOptions = document.getElementById("tabOptions");
const playerNameEl = document.getElementById("playerNameEl");
const playerNameInput = document.getElementById("playerNameInput");
const playerNameEditBtn = document.getElementById("playerNameEditBtn");
const playerStatsCtn = document.getElementById("playerStatsCtn");
const tabHomeBtn = document.getElementById("tabHomeBtn");
const tabHome = document.getElementById("tabHome");
const homeSelectBtn = document.getElementById("homeSelectBtn");
const homeModal = document.getElementById("homeModal");
const homeCloseBtn = document.getElementById("homeCloseBtn");
const homeListCtn = document.getElementById("homeListCtn");
const floorSpaceEl = document.getElementById("floorSpaceEl");
const homeFullNote = document.getElementById("homeFullNote");
const furnitureCtn = document.getElementById("furnitureCtn");
const sortSpaceBtn = document.getElementById("sortSpaceBtn");
const sortNameBtn = document.getElementById("sortNameBtn");
const currenciesHideBtn = document.getElementById("currenciesHideBtn");
const currenciesHideBtnHome = document.getElementById("currenciesHideBtnHome");
const vitalsHideBtn = document.getElementById("vitalsHideBtn");
const actionsHideBtn = document.getElementById("actionsHideBtn");
const milesHideBtn = document.getElementById("milesHideBtn");
const furnFilterBtn = document.getElementById("furnFilterBtn");
const furnFilterModal = document.getElementById("furnFilterModal");
const furnFilterCloseBtn = document.getElementById("furnFilterCloseBtn");
const furnMaxedChk = document.getElementById("furnMaxedChk");
const furnOwnedChk = document.getElementById("furnOwnedChk");
const furnUnownedChk = document.getElementById("furnUnownedChk");
const furnBlockedChk = document.getElementById("furnBlockedChk");
const showMaxedChk = document.getElementById("showMaxedChk");
const stopIfFullChk = document.getElementById("stopIfFullChk");
const logLimitInput = document.getElementById("logLimitInput");
const manualSaveBtn = document.getElementById("manualSaveBtn");
const manualLoadBtn = document.getElementById("manualLoadBtn");
// Live DOM refs per item, rebuilt by buildUI: render() reads these
// instead of querying the DOM every frame (keeps 50ms renders cheap
// with hundreds of items on screen).
const uiRefs = new Map();

function showTab(which) {
  tabWork.hidden = which !== "work";
  tabHome.hidden = which !== "home";
  tabPlayer.hidden = which !== "player";
  if (tabSkills) tabSkills.hidden = which !== "skills";
  tabOptions.hidden = which !== "options";
  tabWorkBtn.classList.toggle("active", which === "work");
  tabHomeBtn.classList.toggle("active", which === "home");
  tabPlayerBtn.classList.toggle("active", which === "player");
  if (tabSkillsBtn) tabSkillsBtn.classList.toggle("active", which === "skills");
  tabOptionsBtn.classList.toggle("active", which === "options");
  tabWorkBtn.setAttribute("aria-selected", which === "work" ? "true" : "false");
  tabHomeBtn.setAttribute("aria-selected", which === "home" ? "true" : "false");
  tabPlayerBtn.setAttribute("aria-selected", which === "player" ? "true" : "false");
  if (tabSkillsBtn) tabSkillsBtn.setAttribute("aria-selected", which === "skills" ? "true" : "false");
  tabOptionsBtn.setAttribute("aria-selected", which === "options" ? "true" : "false");
}

// Work Log cap: keeps the DOM small for performance. Default 200 entries,
// customizable in Options, clamped to 10-1000.
const LOG_LIMIT_DEFAULT = 200;
const LOG_LIMIT_MIN = 10;
const LOG_LIMIT_MAX = 1000;
function normalizeLogLimit(v) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return LOG_LIMIT_DEFAULT;
  return Math.min(LOG_LIMIT_MAX, Math.max(LOG_LIMIT_MIN, n));
}

// Furniture sort: { key: "space"|"name", dir: 1|-1 }. Defaults to name A-Z.
function normalizeFurnSort(v) {
  const key = (v && v.key === "space") ? "space" : "name";
  const dir = (v && v.dir === -1) ? -1 : 1;
  return { key, dir };
}

const configWarnings = normalizeConfig();
let state = makeFreshState();
let lastTime = performance.now();

function makeFreshState() {
  const amounts = {};
  const seen = {};
  for (const r of RESOURCES) {
    amounts[r.id] = r.start ?? 0;
    if ((r.start ?? 0) > 0 && isCurrency(r)) seen[r.id] = true;
  }
  const upgrades = {};
  for (const u of UPGRADES) upgrades[u.id] = 0;
  const playerStats = {};
  for (const s of PLAYER_STATS) playerStats[s.id] = s.start ?? 1;
  const furniture = {};
  for (const f of FURNITURE) furniture[f.id] = 0;
  const homes = {};
  const specialMessages = {};
  const skills = {};
  for (const s of SKILLS) skills[s.id] = { xp: 0, level: 0 };
  return { amounts, seen, upgrades, unlocked: {}, options: { showMaxedUpgrades: false, stopIfFull: true, logActionBegin: true, logActionStop: true, logUpgrades: true, logUnlocks: true, logSkillUps: true, logImprovements: true, balloonSkillMilestones: true, logLimit: LOG_LIMIT_DEFAULT, hidden: {}, furnFilters: { maxed: true, owned: true, unowned: true, blocked: true }, furnTypes: {}, furnSort: { key: "name", dir: 1 } }, playerName: "Placeholder", playerStats, homes, currentHome: null, furniture, specialMessages, skills, stats: { actions: {} }, currentActionId: null, cycles: {}, builds: {}, activeBuildId: null, fullOverride: {}, impBase: {} };
}

// Player name: trimmed, capped at 24 chars, never blank (falls back to
// the default). Renaming is cosmetic - nothing reads the name yet.
const PLAYER_NAME_DEFAULT = "Placeholder";
const PLAYER_NAME_MAXLEN = 24;
function normalizePlayerName(v) {
  const t = typeof v === "string" ? v.trim().slice(0, PLAYER_NAME_MAXLEN) : "";
  return t || PLAYER_NAME_DEFAULT;
}

function getPlayerStat(id) {
  return PLAYER_STATS.find(s => s.id === id);
}

function getHome(id) {
  return HOMES.find(h => h.id === id);
}

function getSkill(id) {
  return (typeof SKILLS !== "undefined" ? SKILLS : []).find(s => s.id === id);
}

function getFurniture(id) {
  return FURNITURE.find(f => f.id === id);
}

// Home tab unlock: visible once any home is owned.
function ownsAnyHome() {
  return HOMES.some(h => state.homes[h.id]);
}

function currentHomeDef() {
  return state.currentHome ? getHome(state.currentHome) : undefined;
}

// Floor Space accounting: total used vs the current home's max.
function furnitureSpaceUsed() {
  let n = 0;
  for (const f of FURNITURE) n += (state.furniture[f.id] ?? 0) * (f.space ?? 1);
  return n;
}

// Effect collectors: the only two places raw effect lists are gathered,
// so every value reader below is a filter over one of them. Item effects
// scale by ownership (upgrades/furniture × owned count, current home ×1);
// skill milestone effects scale by skill level (see attainedSkill...).
function activeItemEffects() {
  const out = [];
  for (const u of UPGRADES) {
    const owned = state.upgrades[u.id] ?? 0;
    if (!owned) continue;
    for (const e of u.effects || []) out.push({ effect: e, mult: owned });
  }
  for (const f of FURNITURE) {
    const owned = state.furniture[f.id] ?? 0;
    if (!owned) continue;
    for (const e of f.effects || []) out.push({ effect: e, mult: owned });
  }
  const home = currentHomeDef();
  if (home) for (const e of home.effects || []) out.push({ effect: e, mult: 1 });
  return out;
}

// Every skill milestone effect as { source, req, effect } (attained or
// not). Value readers use attainedSkillMilestoneEffects(); skillUnlocked
// uses the full list (a skill is locked while targeted but unattained).
function allSkillMilestoneEffects() {
  const out = [];
  if (typeof SKILLS === "undefined") return out;
  for (const s of SKILLS) for (const m of s.milestones ?? []) for (const e of m.effects ?? []) out.push({ source: s.id, req: m.level, effect: e });
  return out;
}
function attainedSkillMilestoneEffects() {
  return allSkillMilestoneEffects().filter(x => skillLevel(x.source) >= x.req);
}

// Effective furniture purchase cap: base maxPurchases plus every owned
// "furnitureCap" upgrade effect and the current home's (e.g. Medium Tent's
// upgrade lets you stack a third Coin Pile).
function getEffectiveFurnCap(f) {
  let cap = f.maxPurchases ?? 1;
  if (cap !== Infinity) {
    for (const { effect: e, mult } of activeItemEffects()) {
      if (e.type === "furnitureCap" && e.furniture === f.id) cap += e.amount * mult;
    }
  }
  return cap;
}

// Effective upgrade purchase cap: base maxPurchases plus every attained
// skill-milestone "upgradeCap" effect for it (e.g. Pouch Organizing lets
// you buy more Pockets). Read everywhere the cap matters so the
// maxed gate, buy log, tooltip count, and save clamp all agree.
function getEffectiveUpgradeCap(u) {
  let cap = u.maxPurchases ?? 1;
  if (cap !== Infinity) {
    for (const x of attainedSkillMilestoneEffects()) {
      if (x.effect.type === "upgradeCap" && x.effect.upgrade === u.id) cap += x.effect.amount;
    }
  }
  return cap;
}

// Effective action time: base tickSeconds minus every owned "time" effect
// for that action (furniture like Pillows, upgrades, current home), floored
// so the main loop can never hit zero/negative cycles.
const MIN_TICK_SECONDS = 0.1;
function getEffectiveTick(a) {
  let t = a.tickSeconds;
  for (const { effect: e, mult } of activeItemEffects()) {
    if (e.type === "time" && e.action === a.id) t -= e.amount * mult;
  }
  return Math.max(MIN_TICK_SECONDS, t);
}

function homeSpaceMax() {
  const h = currentHomeDef();
  return h ? h.space : 0;
}

// Furniture unlock: visible once ANY of its required homes is owned (a
// string id or an array of ids - e.g. ["tent", "mediumTent"] survives the
// Small Tent being replaced). Owned furniture stays visible via its new
// home. No requirement = always visible.
function unlockFurniture(f) {
  if (!f.requiresHome) return true;
  const req = Array.isArray(f.requiresHome) ? f.requiresHome : [f.requiresHome];
  return req.some(id => !!state.homes[id]);
}

// Blocked = unlocked but not currently buyable (maxed, unaffordable or no room).
function furnitureBlocked(f) {
  const owned = state.furniture[f.id] ?? 0;
  if (owned >= getEffectiveFurnCap(f)) return false;
  if (!canAfford(f.cost)) return true;
  return furnitureSpaceUsed() + (f.space ?? 1) > homeSpaceMax();
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

// Currency discovery: a currency row stays hidden in every Currencies
// panel until the player has held it at least once (any positive amount,
// from any system - actions, refunds, future mechanics). Vitals always
// show. `seen` is saved; fresh resources with start > 0 count as seen.
// The render loop also lazily marks anything currently held, so future
// gain paths work with no extra wiring - just grant the resource.
function markCurrencySeen(id) {
  const rid = typeof id === "string" ? id : id && id.id;
  if (!rid) return;
  const def = getResource(rid);
  if (def && !isCurrency(def)) return;
  if (!state.seen) state.seen = {};
  state.seen[rid] = true;
}

function currencySeen(rOrId) {
  const def = typeof rOrId === "string" ? getResource(rOrId) : rOrId;
  if (!def) return true;
  if (!isCurrency(def)) return true;
  if ((def.start ?? 0) > 0) return true;
  return !!state.seen?.[def.id];
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

// Sticky unlocks: hidden until the conditions are first ALL met, then
// visible forever (persisted in the save) with a one-time Work Log
// message. Every gate below is optional and AND-stacks without limit,
// so endgame items can demand many skills plus high currency amounts:
//   { resources: { coin: 40, research: 10 } } = hold at least that
//     much of EACH currency right now (checked live, not spent).
//     Shorthand for one currency: { resource: "coin", amount: 5 }.
//   { homes: ["tent", "mediumTent"] } = own EVERY listed home.
//     Shorthand: { home: "tent" } (a single id, or an array).
//   { skills: { basicKnowledge: 4, sleeping: 2 } } = reach EACH skill
//     level. Shorthand: { skill: "basicKnowledge", skillLevel: 4 }
//     (level defaults to 1). Missing skills.js = skill gates pass.
//   { upgrades: { pockets: 5 } } = own at least that many of EACH
//     upgrade. Shorthand: { upgrade: "pockets", upgradeCount: 5 }
//     (count defaults to 1). Works on actions too.
// Add `unlock` to any action or upgrade to gate it; groups with nothing
// visible collapse on their own. Set `unlockLog` to customize the
// message; it defaults to "Unlocked Action: <name>" /
// "Unlocked Upgrade: <name>".
function unlockMet(item, prefix) {
  if (!item.unlock) return true;
  const key = prefix + ":" + item.id;
  if (state.unlocked[key]) return true;
  const u = item.unlock;
  // Legacy single-currency gate (uncleaned runtime items) plus the
  // canonical resources map. Holding is checked live, never spent.
  if (typeof u.resource === "string") {
    if ((state.amounts[u.resource] ?? 0) < u.amount) return false;
  }
  if (u.resources) {
    for (const [id, n] of Object.entries(u.resources)) {
      if ((state.amounts[id] ?? 0) < n) return false;
    }
  }
  // Home gate(s): EVERY listed home must be owned. Accepts the legacy
  // `home` (single id or array) and the canonical `homes` the same way.
  const homeReqs = [];
  if (typeof u.home === "string") homeReqs.push(u.home);
  else if (Array.isArray(u.home)) homeReqs.push(...u.home);
  if (typeof u.homes === "string") homeReqs.push(u.homes);
  else if (Array.isArray(u.homes)) homeReqs.push(...u.homes);
  for (const h of homeReqs) if (!state.homes[h]) return false;
  // Optional skill gates (e.g. BK L4 for the Survivalist's Tent): sticky
  // once met, like everything else here. Missing skills.js = gates pass.
  if (typeof u.skill === "string" && typeof skillLevel === "function" && skillLevel(u.skill) < (u.skillLevel ?? 1)) return false;
  if (u.skills && typeof skillLevel === "function") {
    for (const [sid, lvl] of Object.entries(u.skills)) {
      if (skillLevel(sid) < lvl) return false;
    }
  }
  // Upgrade-ownership gates: own at least that many of each upgrade.
  if (typeof u.upgrade === "string") {
    if ((state.upgrades[u.upgrade] ?? 0) < (u.upgradeCount ?? 1)) return false;
  }
  if (u.upgrades) {
    for (const [uid, n] of Object.entries(u.upgrades)) {
      if ((state.upgrades[uid] ?? 0) < n) return false;
    }
  }
  state.unlocked[key] = true;
  log(item.unlockLog ?? ("Unlocked " + (prefix === "u" ? "Upgrade" : "Action") + ": " + item.name), "unlock");
  return true;
}

// Special messages: one-time circumstantial messages (see SPECIAL_MESSAGES
// in the config). Fired flags live in state.specialMessages (saved), so each
// message shows once ever - even across save/load, and even if the
// circumstance later stops holding (e.g. selling the furniture afterwards).
function specialMessageMet(m) {
  const req = m.requires ?? {};
  for (const [id, n] of Object.entries(req.furniture ?? {})) if ((state.furniture[id] ?? 0) < n) return false;
  for (const [id, n] of Object.entries(req.upgrades ?? {})) if ((state.upgrades[id] ?? 0) < n) return false;
  for (const [id, n] of Object.entries(req.resources ?? {})) if ((state.amounts[id] ?? 0) < n) return false;
  for (const [id, n] of Object.entries(req.actions ?? {})) if ((state.stats.actions[id] ?? 0) < n) return false;
  return true;
}

// Runs every frame from render(): cheap (a few entries), and catches every
// path - buying, importing a save that already qualifies, future systems.
function checkSpecialMessages() {
  for (const m of SPECIAL_MESSAGES) {
    if (state.specialMessages[m.id]) continue;
    if (specialMessageMet(m)) {
      state.specialMessages[m.id] = true;
      log(m.text, m.category ?? "specialMessage");
    }
  }
}

function hideEmptyGroups(ctn) {
  // Collapse sections whose every button is hidden (unlock/maxed/user
  // hidden), then headers whose every group is hidden. Resource rows
  // (.currency/.res) count too, so hiding a panel's last row collapses it.
  for (const g of ctn.querySelectorAll(".taskGroup")) {
    const btns = [...g.querySelectorAll("button, .currency, .res")];
    g.hidden = btns.length > 0 && btns.every(b => b.hidden);
  }
  for (const h of ctn.querySelectorAll(".taskHeader")) {
    const gs = [...h.querySelectorAll(".taskGroup")];
    h.hidden = gs.length > 0 && gs.every(g => g.hidden);
  }
}

function getEffectiveMax(resourceId) {
  // Base max from RESOURCES plus every active "max" item effect.
  const def = getResource(resourceId);
  if (!def || def.max === undefined || def.max === Infinity) return Infinity;
  let max = def.max;
  for (const { effect: e, mult } of activeItemEffects()) {
    if (e.type === "max" && e.resource === resourceId) max += e.amount * mult;
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

// Human-readable effect lines for tooltips and auto descriptions (moved
// here from tips.js: config normalization auto-writes missing upgrade /
// action descriptions at load time, before tips.js runs).
function describeEffect(e) {
  if (e.type === "max") {
    const def = getResource(e.resource);
    return "+" + formatNum(e.amount) + " " + (def ? def.name : e.resource) + " max";
  }
  if (e.type === "gain") {
    const def = getResource(e.resource);
    const act = e.action ? getAction(e.action) : null;
    return "+" + formatNum(e.amount) + " " + (def ? def.name : e.resource) + " to " + (act ? act.name : e.action);
  }
  if (e.type === "home") {
    const h = e.home ? getHome(e.home) : null;
    return "Home: " + (h ? h.name : e.home);
  }
  if (e.type === "furnitureCap") {
    const f = e.furniture ? getFurniture(e.furniture) : null;
    return "+" + formatNum(e.amount) + " " + (f ? f.name : e.furniture) + " purchase cap";
  }
  if (e.type === "upgradeCap") {
    const u = e.upgrade ? getUpgrade(e.upgrade) : null;
    return "+" + formatNum(e.amount) + " " + (u ? u.name : e.upgrade) + " purchase cap";
  }
  if (e.type === "time") {
    const act = e.action ? getAction(e.action) : null;
    return "-" + formatNum(e.amount) + "s " + (act ? act.name : e.action) + " time";
  }
  return e.type + (e.resource ? " " + e.resource : "");
}

function autoActionDescription(a) {
  const tick = formatDuration(a.tickSeconds, (s) => formatNum(s) + "s");
  const hasCosts = a.costs && Object.keys(a.costs).length > 0;
  const hasGains = a.gains && Object.keys(a.gains).length > 0;
  if (hasCosts && hasGains) return "Spend " + describeCost(a.costs) + " \u2192 +" + describeCost(a.gains) + " (" + tick + ").";
  if (hasGains) return "+" + describeCost(a.gains) + " (" + tick + ").";
  if (hasCosts) return "Spend " + describeCost(a.costs) + " (" + tick + ").";
  return "Takes " + tick + ".";
}

function autoUpgradeDescription(u) {
  const hasCost = u.cost && Object.keys(u.cost).length > 0;
  const hasFx = u.effects && u.effects.length > 0;
  let base;
  if (hasCost && hasFx) base = describeCost(u.cost) + " \u2192 " + u.effects.map(describeEffect).join(", ") + ".";
  else if (hasFx) base = u.effects.map(describeEffect).join(", ") + ".";
  else if (hasCost) base = "Costs " + describeCost(u.cost) + ".";
  else base = "No effect.";
  // Timed purchases state their build time up front, like actions do.
  if (u.buildTime) base += " Takes " + formatDuration(u.buildTime, (s) => formatNum(s) + "s") + " to finish.";
  return base;
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

function currencyGainsAreFull(gains) {
  // True when any currency payout is already at its finite cap (e.g. Buy
  // Scrolls with full Scroll storage). Vitals keep their own all-full rule
  // in gainsAreFull; uncapped currencies can never be full. Drives the
  // "Stop if Full" option (on by default): without it, capped currency
  // payouts are silently destroyed each cycle and the action runs forever.
  for (const id of Object.keys(gains ?? {})) {
    const def = getResource(id);
    if (!def || !isCurrency(def)) continue;
    const max = getEffectiveMax(id);
    if (max === Infinity) continue;
    if ((state.amounts[id] ?? 0) >= max) return true;
  }
  return false;
}

function outputsAreFull(gains, actionId) {
  // One stop check for the loop: vitals-full always stops; currency-full
  // stops only while "Stop if Full" is on and the action hasn't been
  // force-started past the cap (clicking an orange-bordered action sets
  // fullOverride, cleared when the outputs drop back under cap).
  if (gainsAreFull(gains)) return true;
  if (state.options.stopIfFull === false) return false;
  if (actionId && state.fullOverride && state.fullOverride[actionId]) return false;
  return currencyGainsAreFull(gains);
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

// Effective improvement cap: base maxLevel plus every attained
// "improvementCap" skill-milestone bonus for that action (e.g. Odd Jobs
// Mastery raises Odd Jobs' cap by 5). Uncapped actions stay uncapped.
function getEffectiveImpMax(a) {
  const imp = a && a.improvements;
  if (!imp) return 0;
  if (imp.maxLevel === Infinity) return Infinity;
  return imp.maxLevel + (typeof improvementCapBonus === "function" ? improvementCapBonus(a.id) : 0);
}

// Improvement level from completions: every `every` runs is +1 level,
// capped at the effective max. Raising the cap is never retroactive: past
// the base cap, extra levels must be re-earned with completions past both
// the base cap and the milestone that raised it (tracked per action in
// state.impBase), so unlocking headroom never grants levels instantly.
// Takes an optional count override so doTick can compare the new level
// against the previous cycle's (same math both sides - the base-max clamp
// in the old doTick check silently ate every post-cap level-up).
function actionLevel(a, countOverride) {
  const imp = a.improvements;
  if (!imp) return 0;
  const count = countOverride ?? state.stats.actions[a.id] ?? 0;
  const earned = Math.floor(count / imp.every);
  if (imp.maxLevel === Infinity) return earned;
  const bonus = typeof improvementCapBonus === "function" ? improvementCapBonus(a.id) : 0;
  if (bonus <= 0) return Math.min(imp.maxLevel, earned);
  if (earned < imp.maxLevel) return earned;
  const base = state.impBase ?? {};
  const since = Math.max(Number.isFinite(base[a.id]) ? base[a.id] : 0, imp.maxLevel * imp.every);
  return Math.min(imp.maxLevel + bonus, imp.maxLevel + Math.floor(Math.max(0, count - since) / imp.every));
}

// One cycle's payout: base gains plus the improvement bonus per level,
// plus every active item "gain" effect and every attained skill-milestone
// "gain" effect for this action (e.g. Sleeping quickens Rest).
function effectiveGains(a) {
  const out = { ...(a.gains ?? {}) };
  const imp = a.improvements;
  if (imp && imp.bonus) {
    const lvl = actionLevel(a);
    if (lvl > 0) for (const [id, n] of Object.entries(imp.bonus)) out[id] = (out[id] ?? 0) + n * lvl;
  }
  for (const { effect: e, mult } of activeItemEffects()) {
    if (e.type === "gain" && e.action === a.id && e.resource) out[e.resource] = (out[e.resource] ?? 0) + e.amount * mult;
  }
  for (const x of attainedSkillMilestoneEffects()) {
    const e = x.effect;
    if (e.type === "gain" && e.action === a.id && e.resource) out[e.resource] = (out[e.resource] ?? 0) + e.amount * (e.perLevel ? skillLevel(x.source) : 1);
  }
  return out;
}

// One cycle's skill XP: base `xp` plus the improvement xpBonus per level
// (same level timing as the payout bonus - the level just earned counts
// next cycle, since counts increment after the grant). Read everywhere XP
// is granted or displayed so tooltips stay truthful as levels land.
function effectiveXp(a) {
  const out = { ...(a.xp ?? {}) };
  const imp = a.improvements;
  if (imp && imp.xpBonus) {
    const lvl = actionLevel(a);
    if (lvl > 0) for (const [sid, n] of Object.entries(imp.xpBonus)) out[sid] = (out[sid] ?? 0) + n * lvl;
  }
  return out;
}

// Bottom line of an improved action's tooltip: progress to the next level.
// Past the base cap this measures from the non-retroactive baseline, not
// from zero: progress toward a bonus level is (count - since), where since
// is the same max(impBase, baseMax * every) actionLevel uses. The old
// count % every reset to ~0% every `every` runs without leveling (off by
// impBase % every), making the header look stuck while the % looped.
function improvementFooter(a) {
  const imp = a.improvements;
  if (actionLevel(a) >= getEffectiveImpMax(a)) return "Max level";
  const count = state.stats.actions[a.id] ?? 0;
  let done = count % imp.every;
  const bonus = typeof improvementCapBonus === "function" ? improvementCapBonus(a.id) : 0;
  if (imp.maxLevel !== Infinity && bonus > 0 && Math.floor(count / imp.every) >= imp.maxLevel) {
    const base = state.impBase ?? {};
    const since = Math.max(Number.isFinite(base[a.id]) ? base[a.id] : 0, imp.maxLevel * imp.every);
    done = (count - since) % imp.every;
    if (done < 0) done = 0; // count can never trail since naturally; clamp save-edited states
  }
  const pct = Math.floor(done / imp.every * 100);
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
  for (const [arr, kind] of [[RESOURCES, "resource"], [ACTIONS, "action"], [UPGRADES, "upgrade"], [PLAYER_STATS, "player stat"], [HOMES, "home"], [FURNITURE, "furniture"], [SPECIAL_MESSAGES, "special message"], [SKILLS, "skill"]]) {
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
  for (const s of PLAYER_STATS) {
    if (typeof s.name !== "string" || !s.name) s.name = s.id;
    if (typeof s.abbr !== "string" || !s.abbr) s.abbr = s.name.slice(0, 3).toUpperCase();
    if (typeof s.start !== "number" || !Number.isFinite(s.start)) {
      if (s.start !== undefined) warn('Player stat "' + s.id + '": bad start, reset to 1.');
      s.start = 1;
    }
    if (s.tooltip !== undefined && typeof s.tooltip !== "string") {
      warn('Player stat "' + s.id + '": bad tooltip, ignored.');
      delete s.tooltip;
    }
    cleanTags(s, 'Player stat "' + s.id + '"');
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
    if (!k || typeof k !== "object" || Array.isArray(k)) {
      warn(ownerLabel + ": bad unlock, always visible.");
      delete item.unlock;
      return;
    }
    // Every gate below is optional; present gates AND-stack without
    // limit. Any malformed gate fails the whole unlock visible (same as
    // the old single-gate behavior), so typos surface instead of hiding
    // items forever. Cleaned unlocks are stored in canonical plural
    // form; unlockMet still accepts the legacy singular keys too, so
    // runtime-injected items work before normalizeConfig() re-runs.
    const fail = (msg) => {
      warn(ownerLabel + msg + ", always visible.");
      delete item.unlock;
      return true;
    };
    // Currency gates: legacy { resource, amount } plus a plural map.
    // Same rule as costs: unknown resources warn but still lock.
    const resources = {};
    if (k.resource !== undefined || k.amount !== undefined) {
      if (typeof k.resource !== "string" || typeof k.amount !== "number" || !Number.isFinite(k.amount) || k.amount < 0) return void fail(": bad unlock");
      if (k.amount > 0) {
        if (!getResource(k.resource)) warn(ownerLabel + ': unlock watches unknown resource "' + k.resource + '".');
        resources[k.resource] = Math.max(resources[k.resource] ?? 0, k.amount);
      }
    }
    if (k.resources !== undefined) {
      if (!k.resources || typeof k.resources !== "object" || Array.isArray(k.resources)) return void fail(": bad unlock resources");
      for (const [rk, rv] of Object.entries(k.resources)) {
        if (typeof rv !== "number" || !Number.isFinite(rv) || rv < 0) {
          warn(ownerLabel + ': bad unlock resources amount for "' + rk + '", skipped.');
          continue;
        }
        if (rv === 0) continue;
        if (!getResource(rk)) warn(ownerLabel + ': unlock watches unknown resource "' + rk + '".');
        resources[rk] = Math.max(resources[rk] ?? 0, rv);
      }
    }
    // Home gates: legacy `home` plus canonical `homes`; each accepts a
    // single id or an array, and EVERY listed home must be owned (AND).
    const homes = [];
    for (const hkey of ["home", "homes"]) {
      if (k[hkey] === undefined) continue;
      const list = Array.isArray(k[hkey]) ? k[hkey] : [k[hkey]];
      if (!list.length) return void fail(": bad unlock home");
      for (const id of list) {
        if (typeof id !== "string" || !getHome(id)) return void fail(": bad unlock home");
        if (!homes.includes(id)) homes.push(id);
      }
    }
    // Skill gates: legacy { skill, skillLevel } plus a plural map.
    const skills = {};
    if (k.skill !== undefined || k.skillLevel !== undefined) {
      if (typeof k.skill !== "string" || !k.skill || (typeof getSkill === "function" && !getSkill(k.skill))) return void fail(": bad unlock skill");
      const sl = k.skillLevel ?? 1;
      if (!Number.isInteger(sl) || sl < 1) return void fail(": bad unlock skillLevel");
      skills[k.skill] = Math.max(skills[k.skill] ?? 0, sl);
    }
    if (k.skills !== undefined) {
      if (!k.skills || typeof k.skills !== "object" || Array.isArray(k.skills)) return void fail(": bad unlock skills");
      for (const [sid, sl] of Object.entries(k.skills)) {
        if (typeof getSkill === "function" && !getSkill(sid)) return void fail(": bad unlock skill");
        if (!Number.isInteger(sl) || sl < 1) return void fail(": bad unlock skillLevel");
        skills[sid] = Math.max(skills[sid] ?? 0, sl);
      }
    }
    // Upgrade-ownership gates: legacy { upgrade, upgradeCount } plus a
    // plural map. Own at least that many of each upgrade (works on
    // actions too, e.g. an action unlocked by 5 Pockets).
    const upgrades = {};
    if (k.upgrade !== undefined || k.upgradeCount !== undefined) {
      if (typeof k.upgrade !== "string" || !getUpgrade(k.upgrade)) return void fail(": bad unlock upgrade");
      const uc = k.upgradeCount ?? 1;
      if (!Number.isInteger(uc) || uc < 1) return void fail(": bad unlock upgradeCount");
      upgrades[k.upgrade] = Math.max(upgrades[k.upgrade] ?? 0, uc);
    }
    if (k.upgrades !== undefined) {
      if (!k.upgrades || typeof k.upgrades !== "object" || Array.isArray(k.upgrades)) return void fail(": bad unlock upgrades");
      for (const [uid, uc] of Object.entries(k.upgrades)) {
        if (typeof uid !== "string" || !getUpgrade(uid)) return void fail(": bad unlock upgrade");
        if (!Number.isInteger(uc) || uc < 1) return void fail(": bad unlock upgradeCount");
        upgrades[uid] = Math.max(upgrades[uid] ?? 0, uc);
      }
    }
    for (const key of Object.keys(k)) {
      if (!["resource", "amount", "resources", "home", "homes", "skill", "skillLevel", "skills", "upgrade", "upgradeCount", "upgrades"].includes(key)) {
        warn(ownerLabel + ': unknown unlock key "' + key + '", ignored.');
      }
    }
    if (item.id && upgrades[item.id] !== undefined) {
      warn(ownerLabel + ": unlock requires its own purchase, so it can never appear.");
    }
    if (!Object.keys(resources).length && !homes.length && !Object.keys(skills).length && !Object.keys(upgrades).length) {
      warn(ownerLabel + ": bad unlock, always visible.");
      delete item.unlock;
      return;
    }
    item.unlock = {};
    if (Object.keys(resources).length) item.unlock.resources = resources;
    if (homes.length) item.unlock.homes = homes;
    if (Object.keys(skills).length) item.unlock.skills = skills;
    if (Object.keys(upgrades).length) item.unlock.upgrades = upgrades;
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
  // Conditional action logs: extra start/stop/full/stopFull variants that
  // join the random pick while their requires hold (see pickActionLog in
  // log.js), e.g. conditionalLogs: [{ start: "You whistle while you work.",
  // requires: { skills: { oddJobsMastery: 2 } } }]. Requires AND-stack:
  // skills (level), upgrades/resources/actions/furniture (count), homes
  // (array: own every listed home). Bad entries/slots are skipped with a
  // warning; unknown ids warn but still gate (a typo just never fires).
  const cleanConditionalLogs = (item, ownerLabel) => {
    if (item.conditionalLogs === undefined) return;
    if (!Array.isArray(item.conditionalLogs)) {
      warn(ownerLabel + ": bad conditionalLogs (use an array of entries), ignored.");
      delete item.conditionalLogs;
      return;
    }
    const cleanCountReq = (map, kind, finder, integer) => {
      if (map === undefined) return {};
      if (!map || typeof map !== "object" || Array.isArray(map)) {
        warn(ownerLabel + ": bad conditionalLogs " + kind + " requires, ignored.");
        return {};
      }
      const cleaned = {};
      for (const [k, v] of Object.entries(map)) {
        if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || (integer && !Number.isInteger(v))) {
          warn(ownerLabel + ": bad conditionalLogs " + kind + ' requires amount for "' + k + '", skipped.');
          continue;
        }
        if (!finder(k)) warn(ownerLabel + ": conditionalLogs " + kind + ' requires unknown "' + k + '".');
        cleaned[k] = v;
      }
      return cleaned;
    };
    const kept = [];
    for (const e of item.conditionalLogs) {
      const eLabel = ownerLabel + " conditional log";
      if (!e || typeof e !== "object" || Array.isArray(e)) {
        warn(eLabel + ": skipped an invalid entry.");
        continue;
      }
      if (e.requires !== undefined && (e.requires === null || typeof e.requires !== "object" || Array.isArray(e.requires))) {
        warn(eLabel + ": bad requires, skipped the entry.");
        continue;
      }
      const req = e.requires ?? {};
      for (const key of Object.keys(req)) {
        if (!["furniture", "upgrades", "resources", "actions", "skills", "homes"].includes(key)) {
          warn(eLabel + ': unknown requires key "' + key + '", ignored.');
        }
      }
      const homes = [];
      if (req.homes !== undefined) {
        const list = Array.isArray(req.homes) ? req.homes : [req.homes];
        for (const id of list) {
          if (typeof id !== "string" || !getHome(id)) warn(eLabel + ": bad requires home, skipped.");
          else if (!homes.includes(id)) homes.push(id);
        }
      }
      const entry = {
        requires: {
          furniture: cleanCountReq(req.furniture, "furniture", (k) => getFurniture(k)),
          upgrades: cleanCountReq(req.upgrades, "upgrade", (k) => getUpgrade(k)),
          resources: cleanCountReq(req.resources, "resource", (k) => getResource(k)),
          actions: cleanCountReq(req.actions, "action", (k) => getAction(k)),
          skills: cleanCountReq(req.skills, "skill", (k) => getSkill(k), true),
          homes,
        },
      };
      let hasSlot = false;
      for (const slot of ["start", "stop", "full", "stopFull"]) {
        const v = e[slot];
        if (v === undefined) continue;
        const ok = typeof v === "string" ? !!v : Array.isArray(v) && v.some(x => typeof x === "string" && x);
        if (!ok) {
          warn(eLabel + ': bad "' + slot + '" text (use a string or an array of strings), skipped.');
          continue;
        }
        entry[slot] = v;
        hasSlot = true;
      }
      if (!hasSlot) {
        warn(eLabel + ": no usable log text, skipped.");
        continue;
      }
      kept.push(entry);
    }
    item.conditionalLogs = kept;
  };
  // Effect registry: every { type: ... } effect in ONE table, shared by
  // upgrades, homes, furniture, AND skill milestones - so milestone effects
  // stay as easy as upgrade effects. To add a new effect type:
  //   1. add an entry below (validation + which item kinds allow it),
  //   2. add a reader over activeItemEffects() and/or
  //      attainedSkillMilestoneEffects() (see the collectors beneath),
  //   3. if upgrades can carry it, teach describeEffect() its display text.
  // Readers never loop raw lists - they filter one of the two collectors.
  // Each entry's clean() preserves that family's history: item effects
  // (upgrade/home/furniture) warn about unknown ids but keep the effect,
  // while skill effects skip unknown targets outright.
  const EFFECT_DEFS = {
    max: {
      contexts: ["upgrade", "home", "furniture"],
      clean(e, ownerLabel) {
        if (typeof e.resource !== "string" || typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount <= 0) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "max", resource, amount }).');
          return null;
        }
        if (!getResource(e.resource)) warn(ownerLabel + ': effect targets unknown resource "' + e.resource + '".');
        return { type: "max", resource: e.resource, amount: e.amount };
      },
    },
    gain: {
      contexts: ["home", "furniture", "skill"],
      clean(e, ownerLabel, kind) {
        if (typeof e.action !== "string" || typeof e.resource !== "string" || typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount <= 0) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "gain", action, resource, amount }).');
          return null;
        }
        // Skill-gated payout: times the skill's level when perLevel (e.g.
        // Sleeping restores extra Stamina). Read through effectiveGains.
        if (kind === "skill") {
          if (!getAction(e.action) || !getResource(e.resource)) {
            warn(ownerLabel + ': skipped an invalid effect (use { type: "gain", action, resource, amount }).');
            return null;
          }
          return { type: "gain", action: e.action, resource: e.resource, amount: e.amount, perLevel: e.perLevel === true };
        }
        if (!getAction(e.action)) warn(ownerLabel + ': effect targets unknown action "' + e.action + '".');
        if (!getResource(e.resource)) warn(ownerLabel + ': effect targets unknown resource "' + e.resource + '".');
        return { type: "gain", action: e.action, resource: e.resource, amount: e.amount };
      },
    },
    home: {
      contexts: ["upgrade"],
      clean(e, ownerLabel) {
        if (typeof e.home !== "string" || !getHome(e.home)) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "home", home }).');
          return null;
        }
        return { type: "home", home: e.home };
      },
    },
    furnitureCap: {
      contexts: ["upgrade", "home"],
      clean(e, ownerLabel) {
        if (typeof e.furniture !== "string" || !getFurniture(e.furniture) || !Number.isInteger(e.amount) || e.amount < 1) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "furnitureCap", furniture, amount }).');
          return null;
        }
        return { type: "furnitureCap", furniture: e.furniture, amount: e.amount };
      },
    },
    upgradeCap: {
      contexts: ["skill"],
      clean(e, ownerLabel) {
        if (typeof e.upgrade !== "string" || !getUpgrade(e.upgrade) || !Number.isInteger(e.amount) || e.amount < 1) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "upgradeCap", upgrade, amount }).');
          return null;
        }
        return { type: "upgradeCap", upgrade: e.upgrade, amount: e.amount };
      },
    },
    time: {
      contexts: ["upgrade", "furniture", "home"],
      clean(e, ownerLabel) {
        if (typeof e.action !== "string" || typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount <= 0) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "time", action, amount }).');
          return null;
        }
        if (!getAction(e.action)) warn(ownerLabel + ': effect targets unknown action "' + e.action + '".');
        return { type: "time", action: e.action, amount: e.amount };
      },
    },
    stat: {
      contexts: ["skill"],
      clean(e, ownerLabel) {
        if (typeof e.stat !== "string" || !getPlayerStat(e.stat) || typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount === 0) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "stat", stat, amount }).');
          return null;
        }
        return { type: "stat", stat: e.stat, amount: e.amount, perLevel: e.perLevel === true };
      },
    },
    cost: {
      contexts: ["skill"],
      clean(e, ownerLabel) {
        // Cost discount: each cycle of `action` costs `amount` less of
        // `resource` (floored at zero), e.g. Scroll Frugality makes Buy
        // Scrolls cost 2.5 less Coin per scroll.
        if (typeof e.action !== "string" || !getAction(e.action) || typeof e.resource !== "string" || !getResource(e.resource) || typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount <= 0) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "cost", action, resource, amount }).');
          return null;
        }
        return { type: "cost", action: e.action, resource: e.resource, amount: e.amount };
      },
    },
    improvementCap: {
      contexts: ["skill"],
      clean(e, ownerLabel) {
        // Improvement headroom: `action` can earn `amount` more Improvement
        // levels past its base max (re-earned, never retroactive).
        const target = (typeof e.action === "string") ? getAction(e.action) : null;
        if (!target || !target.improvements || !Number.isInteger(e.amount) || e.amount < 1) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "improvementCap", action, amount } on an improved action).');
          return null;
        }
        return { type: "improvementCap", action: e.action, amount: e.amount };
      },
    },
    skill: {
      contexts: ["skill"],
      clean(e, ownerLabel, kind, ownerId) {
        // Skill unlock: earning this milestone lets `skill` gain XP (locked
        // skills earn nothing and hide from tooltips until unlocked).
        if (typeof e.skill !== "string" || !getSkill(e.skill)) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "skill", skill }).');
          return null;
        }
        if (e.skill === ownerId) {
          warn(ownerLabel + ": a skill cannot unlock itself, skipped.");
          return null;
        }
        return { type: "skill", skill: e.skill };
      },
    },
  };
  // Effect entries shared by upgrades, homes, furniture, and skill
  // milestones. `kind` gates which types are valid here: "upgrade",
  // "home", "furniture", or "skill" (see EFFECT_DEFS contexts). Returns
  // the cleaned effect, or null when it should be skipped.
  const cleanEffect = (e, ownerLabel, kind, ownerId) => {
    if (!e || typeof e !== "object" || typeof e.type !== "string") {
      warn(ownerLabel + ": skipped an invalid effect.");
      return null;
    }
    const def = EFFECT_DEFS[e.type];
    if (!def || !def.contexts.includes(kind)) {
      warn(ownerLabel + ": skipped an invalid effect.");
      return null;
    }
    return def.clean(e, ownerLabel, kind, ownerId);
  };
  const cleanMaxPurchases = (item, ownerLabel) => {
    if (item.maxPurchases === undefined) item.maxPurchases = 1;
    if (item.maxPurchases !== Infinity && (!Number.isFinite(item.maxPurchases) || item.maxPurchases <= 0)) {
      warn(ownerLabel + ": bad maxPurchases, reset to 1.");
      item.maxPurchases = 1;
    } else if (Number.isFinite(item.maxPurchases) && !Number.isInteger(item.maxPurchases)) {
      const fixed = Math.max(1, Math.floor(item.maxPurchases));
      warn(ownerLabel + ": maxPurchases rounded down to " + fixed + ".");
      item.maxPurchases = fixed;
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
    // Skill XP per completed cycle: { skillId: amount }. Unknown skills
    // warn and are skipped (the engine grants what's left in doTick).
    if (a.xp === undefined) a.xp = {};
    else if (!a.xp || typeof a.xp !== "object" || Array.isArray(a.xp)) {
      warn('Action "' + a.id + '": bad xp, ignored.');
      a.xp = {};
    } else {
      const cleaned = {};
      for (const [k, v] of Object.entries(a.xp)) {
        if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
          warn('Action "' + a.id + '": bad xp amount for "' + k + '", skipped.');
          continue;
        }
        if (!getSkill(k)) warn('Action "' + a.id + '": xp grants unknown skill "' + k + '".');
        cleaned[k] = v;
      }
      a.xp = cleaned;
    }
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
        // Improvement XP bonus: { skillId: amount } = that much more of
        // the skill's XP granted per cycle per improvement level (e.g.
        // Research Scrolls quickening Basic Knowledge). Unknown skills
        // and non-positive amounts are skipped with a warning.
        if (imp.xpBonus !== undefined) {
          if (!imp.xpBonus || typeof imp.xpBonus !== "object" || Array.isArray(imp.xpBonus)) {
            warn(impLabel + ": bad xpBonus, ignored.");
            delete imp.xpBonus;
          } else {
            const kept = {};
            for (const [sid, n] of Object.entries(imp.xpBonus)) {
              if (!getSkill(sid)) { warn(impLabel + ': xpBonus targets unknown skill "' + sid + '", skipped.'); continue; }
              if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) { warn(impLabel + ': bad xpBonus amount for "' + sid + '", skipped.'); continue; }
              kept[sid] = n;
            }
            if (!Object.keys(kept).length) delete imp.xpBonus;
            else imp.xpBonus = kept;
          }
        }
        cleanLogField(imp, "improvementLog", impLabel);
      }
    }
    if (a.description !== undefined && typeof a.description !== "string") {
      warn('Action "' + a.id + '": bad description, auto-generated.');
      delete a.description;
    }
    // Remember whether the description was auto-written: auto text embeds
    // the base costs, so it is refreshed live (discounts change it), while
    // custom descriptions are left exactly as written.
    if (a.description === undefined) {
      a.description = autoActionDescription(a);
      a._autoDesc = true;
    } else if (a._autoDesc === undefined) {
      a._autoDesc = false;
    }
    cleanLogField(a, "startLog", 'Action "' + a.id + '"');
    cleanLogField(a, "stopLog", 'Action "' + a.id + '"');
    cleanLogField(a, "fullLog", 'Action "' + a.id + '"');
    cleanLogField(a, "stopFullLog", 'Action "' + a.id + '"');
    cleanConditionalLogs(a, 'Action "' + a.id + '"');
  }
  for (const u of UPGRADES) {
    if (typeof u.name !== "string" || !u.name) u.name = u.id;
    u.cost = cleanMap(u.cost, 'Upgrade "' + u.id + '"', "cost");
    cleanUnlock(u, 'Upgrade "' + u.id + '"');
    cleanTags(u, 'Upgrade "' + u.id + '"');
    cleanHeader(u, 'Upgrade "' + u.id + '"');
    cleanMaxPurchases(u, 'Upgrade "' + u.id + '"');
    // Timed purchase: seconds to finish, working like action completion
    // time (paid at start, pausable, free resume). Must be positive.
    if (u.buildTime !== undefined) {
      if (typeof u.buildTime !== "number" || !Number.isFinite(u.buildTime) || u.buildTime <= 0) {
        warn('Upgrade "' + u.id + '": bad buildTime, instant purchase.');
        delete u.buildTime;
      }
    }
    if (u.effects === undefined) u.effects = [];
    if (!Array.isArray(u.effects)) {
      warn('Upgrade "' + u.id + '": bad effects, ignored.');
      u.effects = [];
    } else {
      const kept = [];
      for (const e of u.effects) {
        const c = cleanEffect(e, 'Upgrade "' + u.id + '"', "upgrade");
        if (c) kept.push(c);
      }
      u.effects = kept;
    }
    if (u.description !== undefined && typeof u.description !== "string") {
      warn('Upgrade "' + u.id + '": bad description, auto-generated.');
      delete u.description;
    }
    if (!u.description) u.description = autoUpgradeDescription(u);
    // Build start text: only timed (buildTime) upgrades use it - instant
    // purchases grant immediately with buyLog, so a start line would just
    // double-log. Fires on every build start and free resume (like actions).
    if (u.startLog !== undefined) {
      if (!u.buildTime) {
        warn('Upgrade "' + u.id + '": startLog needs buildTime, ignored.');
        delete u.startLog;
      } else cleanLogField(u, "startLog", 'Upgrade "' + u.id + '"');
    }
  }
  for (const h of HOMES) {
    if (typeof h.name !== "string" || !h.name) h.name = h.id;
    if (!Number.isInteger(h.space) || h.space <= 0) {
      if (h.space !== undefined) warn('Home "' + h.id + '": bad space, reset to 1.');
      h.space = 1;
    }
    if (h.tooltip !== undefined && typeof h.tooltip !== "string") {
      warn('Home "' + h.id + '": bad tooltip, ignored.');
      delete h.tooltip;
    }
    if (h.unlockHint !== undefined && typeof h.unlockHint !== "string") {
      warn('Home "' + h.id + '": bad unlockHint, ignored.');
      delete h.unlockHint;
    }
    // Replaces: this home overrides (removes) the listed homes when granted,
    // and instantly becomes current - e.g. Medium Tent replaces Small Tent.
    if (h.replaces !== undefined) {
      const list = Array.isArray(h.replaces) ? h.replaces : [h.replaces];
      const kept = [];
      for (const r of list) {
        if (typeof r !== "string" || !getHome(r)) warn('Home "' + h.id + '": bad replaces entry, skipped.');
        else if (!kept.includes(r)) kept.push(r);
      }
      if (kept.length) h.replaces = kept;
      else delete h.replaces;
    }
    if (h.effects === undefined) h.effects = [];
    if (!Array.isArray(h.effects)) {
      warn('Home "' + h.id + '": bad effects, ignored.');
      h.effects = [];
    } else {
      const kept = [];
      for (const e of h.effects) {
        const c = cleanEffect(e, 'Home "' + h.id + '"', "home");
        if (c) kept.push(c);
      }
      h.effects = kept;
    }
    cleanTags(h, 'Home "' + h.id + '"');
  }
  for (const f of FURNITURE) {
    if (typeof f.name !== "string" || !f.name) f.name = f.id;
    // Floor Space comes in 0.5 steps (0.5, 1, 1.5, ...) so small items
    // like Pillows can share space; floats stay exact at halves.
    if (typeof f.space !== "number" || !Number.isFinite(f.space) || f.space <= 0 || Math.round(f.space * 2) !== f.space * 2) {
      if (f.space !== undefined) warn('Furniture "' + f.id + '": bad space (use 0.5 steps), reset to 1.');
      f.space = 1;
    }
    f.cost = cleanMap(f.cost, 'Furniture "' + f.id + '"', "cost");
    cleanMaxPurchases(f, 'Furniture "' + f.id + '"');
    if (f.effects === undefined) f.effects = [];
    if (!Array.isArray(f.effects)) {
      warn('Furniture "' + f.id + '": bad effects, ignored.');
      f.effects = [];
    } else {
      const kept = [];
      for (const e of f.effects) {
        const c = cleanEffect(e, 'Furniture "' + f.id + '"', "furniture");
        if (c) kept.push(c);
      }
      f.effects = kept;
    }
    // Required home: a single id or an array of ids - visible when ANY is
    // owned, so entries shared across a home replacement never lock again.
    if (f.requiresHome !== undefined) {
      const list = Array.isArray(f.requiresHome) ? f.requiresHome : [f.requiresHome];
      const keptReq = [];
      for (const r of list) {
        if (typeof r !== "string" || !getHome(r)) warn('Furniture "' + f.id + '": bad requiresHome entry, skipped.');
        else if (!keptReq.includes(r)) keptReq.push(r);
      }
      if (keptReq.length === 1 && !Array.isArray(f.requiresHome)) f.requiresHome = keptReq[0];
      else if (keptReq.length) f.requiresHome = keptReq;
      else {
        warn('Furniture "' + f.id + '": bad requiresHome, always visible.');
        delete f.requiresHome;
      }
    }
    if (f.description !== undefined && typeof f.description !== "string") {
      warn('Furniture "' + f.id + '": bad description, auto-generated.');
      delete f.description;
    }
    if (!f.description) f.description = "Furniture for your home.";
    cleanLogField(f, "buyLog", 'Furniture "' + f.id + '"');
    cleanLogField(f, "sellLog", 'Furniture "' + f.id + '"');
    if (f.flavor !== undefined && typeof f.flavor !== "string") {
      warn('Furniture "' + f.id + '": bad flavor, ignored.');
      delete f.flavor;
    }
    cleanTags(f, 'Furniture "' + f.id + '"');
  }
  // Special messages: one-time circumstantial log messages (see
  // SPECIAL_MESSAGES in the config). Requires-maps are cleaned like costs: non-negative finite
  // amounts only, unknown ids warned about but still checked.
  const cleanReq = (map, mLabel, kind, finder) => {
    if (map === undefined) return {};
    if (!map || typeof map !== "object" || Array.isArray(map)) {
      warn(mLabel + ": bad " + kind + " requires, ignored.");
      return {};
    }
    const cleaned = {};
    for (const [k, v] of Object.entries(map)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
        warn(mLabel + ": bad " + kind + ' requires amount for "' + k + '", skipped.');
        continue;
      }
      if (!finder(k)) warn(mLabel + ": " + kind + ' requires unknown "' + k + '".');
      cleaned[k] = v;
    }
    return cleaned;
  };
  for (let i = 0; i < SPECIAL_MESSAGES.length; i++) {
    const m = SPECIAL_MESSAGES[i];
    const mLabel = 'Special message "' + (m.id || "?") + '"';
    if (typeof m.text !== "string" || !m.text) {
      warn(mLabel + ": no text, removed.");
      SPECIAL_MESSAGES.splice(i, 1); i--;
      continue;
    }
    if (m.requires !== undefined && (!m.requires || typeof m.requires !== "object" || Array.isArray(m.requires))) {
      warn(mLabel + ": bad requires, removed.");
      SPECIAL_MESSAGES.splice(i, 1); i--;
      continue;
    }
    const req = m.requires ?? {};
    m.requires = {
      furniture: cleanReq(req.furniture, mLabel, "furniture", (k) => getFurniture(k)),
      upgrades: cleanReq(req.upgrades, mLabel, "upgrade", (k) => getUpgrade(k)),
      resources: cleanReq(req.resources, mLabel, "resource", (k) => getResource(k)),
      actions: cleanReq(req.actions, mLabel, "action", (k) => getAction(k)),
    };
    if (m.category !== undefined && typeof m.category !== "string") {
      warn(mLabel + ": bad category, using the default.");
      delete m.category;
    }
  }
  // Skills: leveled abilities fed by action XP. Bad numbers reset to safe
  // defaults so one typo can't break the tab; bad milestones are skipped.
  // Level curve: 0 -> 1 always costs 1 XP; 1 -> 2 costs baseXp; later
  // levels multiply by scaling each time. Milestone effects use the shared
  // EFFECT_DEFS registry above (same { type, ... } shape as upgrades) -
  // see its header for how to add a type.
  for (const s of SKILLS) {
    const sLabel = 'Skill "' + (s.id || "?") + '"';
    if (typeof s.name !== "string" || !s.name) s.name = s.id;
    if (!Number.isInteger(s.maxLevel) || s.maxLevel <= 0) {
      if (s.maxLevel !== undefined) warn(sLabel + ": bad maxLevel, reset to 1.");
      s.maxLevel = 1;
    }
    if (typeof s.baseXp !== "number" || !Number.isFinite(s.baseXp) || s.baseXp <= 0) {
      if (s.baseXp !== undefined) warn(sLabel + ": bad baseXp, reset to 3.");
      s.baseXp = 3;
    }
    if (typeof s.scaling !== "number" || !Number.isFinite(s.scaling) || s.scaling < 1) {
      if (s.scaling !== undefined) warn(sLabel + ": bad scaling, reset to 1.5.");
      s.scaling = 1.5;
    }
    if (s.description !== undefined && typeof s.description !== "string") {
      warn(sLabel + ": bad description, ignored.");
      delete s.description;
    }
    // Flavor works exactly like actions: an italic line at the bottom of
    // the tooltip. Skills without one show no flavor line at all.
    if (s.flavor !== undefined && typeof s.flavor !== "string") {
      warn(sLabel + ": bad flavor, ignored.");
      delete s.flavor;
    }
    cleanTags(s, sLabel);
    cleanHeader(s, sLabel);
    if (s.milestones === undefined) s.milestones = [];
    if (!Array.isArray(s.milestones)) {
      warn(sLabel + ": bad milestones, ignored.");
      s.milestones = [];
    } else {
      const kept = [];
      for (const m of s.milestones) {
        if (!m || typeof m !== "object") { warn(sLabel + ": skipped an invalid milestone."); continue; }
        if (!Number.isInteger(m.level) || m.level < 1 || m.level > s.maxLevel) { warn(sLabel + ": skipped a milestone with a bad level."); continue; }
        if (typeof m.text !== "string" || !m.text) { warn(sLabel + ": skipped a milestone with no text."); continue; }
        // Custom names render as "[Lvl. N] <name>" (level auto-prepended);
        // without one the header reads "[Lvl. N] Milestone".
        let name = undefined;
        if (m.name !== undefined) {
          if (typeof m.name !== "string" || !m.name.trim()) warn(sLabel + ": milestone " + m.level + " has a bad name, ignored.");
          else name = m.name.trim();
        }
        const effs = [];
        for (const e of (Array.isArray(m.effects) ? m.effects : [])) {
          const c = cleanEffect(e, sLabel + " milestone " + m.level, "skill", s.id);
          if (c) effs.push(c);
        }
        kept.push({ level: m.level, name, text: m.text, effects: effs });
      }
      kept.sort((x, y) => x.level - y.level);
      s.milestones = kept;
    }
  }
  return warnings;
}

// Resource tooltip: header row (name left, amount/cap right), tag chips
// below it, a right-aligned per-second row (only while nonzero), then
// the description text. The live numbers are filled in by render().
