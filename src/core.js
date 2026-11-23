// Labor Game core: DOM refs, lookups, formatters, costs, tags, unlocks, state factory.
/* ============================================================
   GAME ENGINE - you should not need to edit below this line.
   It reads the config lists (RESOURCES, ACTIONS, UPGRADES, ...),
   so new items just work.
   ============================================================ */

 // Shared magic strings (one copy - engine + UI all read these, so a
 // rename touches one line): the furniture tag that reveals the Crafting
 // tab, the tile tag that gates shops/selling, and the vital that meals
 // can overheal past its cap.
const CRAFTING_TAG = "Crafting";
const STORE_TAG = "General Store";
const OVERHEAL_RESOURCE = "stamina";
// Named UI literals (single copy - the values are still hex by necessity,
// but a retune touches one line): fallback bar color for vitals without
// one in config, full-stack number glow, overheal gradient end, and the
// two fog-of-war text inks picked by tile luminance in worldTileColors.
const DEFAULT_BAR_COLOR = "#FFFCAD";
const CAP_GLOW_COLOR = "#FFFE40";
const OVERHEAL_GRADIENT_END = "#CBFFA3";
const FOG_TEXT_ON_DARK = "#f2ede4";
const FOG_TEXT_ON_LIGHT = "#14301c";
// Per-tick catch-up caps: a background-throttled frame may owe many cycles
// at once; each loop applies at most this many, then the remainder waits
// for the next 50ms tick (self-corrects, no explosion - see main.js).
const MAX_CYCLES_PER_TICK = 10;
const MAX_FUEL_UNITS_PER_TICK = 10;
// Named timings (single copy): milestone balloon lifetime, exported-save
// object-URL revocation delay, and the main-loop tick (see main.js).
const MILESTONE_BALLOON_MS = 15000;
const EXPORT_URL_REVOKE_MS = 5000;
const MAIN_TICK_MS = 50;

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
const logFilterBtnWorld = document.getElementById("logFilterBtnWorld");
const clearLogBtnWorld = document.getElementById("clearLogBtnWorld");
const logFilterBtnInv = document.getElementById("logFilterBtnInv");
const clearLogBtnInv = document.getElementById("clearLogBtnInv");
const clearLogBtnCraft = document.getElementById("clearLogBtnCraft");
const logFilterBtnCraft = document.getElementById("logFilterBtnCraft");
const clearLogBtnOptions = document.getElementById("clearLogBtnOptions");
const logFilterBtnOptions = document.getElementById("logFilterBtnOptions");
const optSubSavingBtn = document.getElementById("optSubSavingBtn");
const optSubDisplayBtn = document.getElementById("optSubDisplayBtn");
const optSubActionsBtn = document.getElementById("optSubActionsBtn");
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
// Selling Mode refs: the arm/disarm button, the amount row it reveals,
// and the inline custom-amount field in that row.
const invSellBtn = document.getElementById("invSellBtn");
const invSellRow = document.getElementById("invSellRow");
const sellQtyInput = document.getElementById("sellQtyInput");
// Inventory search: static input row above the type chips (never rebuilt,
// so typing never loses focus); the query lives in options like the
// other inventory filters and AND-combines with them in renderInventory.
const invSearchInput = document.getElementById("invSearchInput");
// Item-hiding mode (purely visual): per panel kind (currencies, vitals,
// actions, milestones, plans, recipes). While on, user-hidden items show struck-through so they can be
// unhidden; exiting re-applies the hiding. Runtime-only, never saved.
const hidingMode = { currencies: false, vitals: false, actions: false, milestones: false, plans: false, recipes: false };
// User-hidden item ids ("a:<id>", "u:<id>", "r:<id>", "m:<skillId>:<level>",
// "p:<planId>", "c:<planId>:<recipeId>"), from hiding mode.
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
const tabWorldBtn = document.getElementById("tabWorldBtn");
const tabWorld = document.getElementById("tabWorld");
const tabInventoryBtn = document.getElementById("tabInventoryBtn");
const tabInventory = document.getElementById("tabInventory");
const tabCraftingBtn = document.getElementById("tabCraftingBtn");
const tabCrafting = document.getElementById("tabCrafting");
const playerNameEl = document.getElementById("playerNameEl");
const playerNameInput = document.getElementById("playerNameInput");
const playerNameEditBtn = document.getElementById("playerNameEditBtn");
const playerStatsCtn = document.getElementById("playerStatsCtn");
const craftStatsCtn = document.getElementById("craftStatsCtn");
const craftStatsHead = document.getElementById("craftStatsHead");
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
const craftPlansHideBtn = document.getElementById("craftPlansHideBtn");
const craftRecipesHideBtn = document.getElementById("craftRecipesHideBtn");
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
const autosaveChk = document.getElementById("autosaveChk");
const autosaveEverySel = document.getElementById("autosaveEverySel");
const autosaveLogChk = document.getElementById("autosaveLogChk");
const manualSaveBtn = document.getElementById("manualSaveBtn");
const manualLoadBtn = document.getElementById("manualLoadBtn");
const themeSel = document.getElementById("themeSel");
// Live DOM refs per item, rebuilt by buildUI: render() reads these
// instead of querying the DOM every frame (keeps 50ms renders cheap
// with hundreds of items on screen).
const uiRefs = new Map();

function showTab(which) {
  // Leaving the Inventory tab disarms Selling mode: selling only happens
  // on inventory cells at a store, so an armed mode elsewhere is stale
  // (and could sit armed on a storeless tile). Silent - the Sell button
  // simply reads "Sell" again on return.
  if (which !== "inventory" && typeof disarmSelling === "function") disarmSelling();
  tabWork.hidden = which !== "work";
  tabHome.hidden = which !== "home";
  tabPlayer.hidden = which !== "player";
  if (tabSkills) tabSkills.hidden = which !== "skills";
  tabOptions.hidden = which !== "options";
  if (tabWorld) tabWorld.hidden = which !== "world";
  if (tabInventory) tabInventory.hidden = which !== "inventory";
  if (typeof tabCrafting !== "undefined" && tabCrafting) tabCrafting.hidden = which !== "crafting";
  tabWorkBtn.classList.toggle("active", which === "work");
  tabHomeBtn.classList.toggle("active", which === "home");
  tabPlayerBtn.classList.toggle("active", which === "player");
  if (tabSkillsBtn) tabSkillsBtn.classList.toggle("active", which === "skills");
  tabOptionsBtn.classList.toggle("active", which === "options");
  if (tabWorldBtn) tabWorldBtn.classList.toggle("active", which === "world");
  if (tabInventoryBtn) tabInventoryBtn.classList.toggle("active", which === "inventory");
  if (typeof tabCraftingBtn !== "undefined" && tabCraftingBtn) tabCraftingBtn.classList.toggle("active", which === "crafting");
  tabWorkBtn.setAttribute("aria-selected", which === "work" ? "true" : "false");
  tabHomeBtn.setAttribute("aria-selected", which === "home" ? "true" : "false");
  tabPlayerBtn.setAttribute("aria-selected", which === "player" ? "true" : "false");
  if (tabSkillsBtn) tabSkillsBtn.setAttribute("aria-selected", which === "skills" ? "true" : "false");
  tabOptionsBtn.setAttribute("aria-selected", which === "options" ? "true" : "false");
  if (tabWorldBtn) tabWorldBtn.setAttribute("aria-selected", which === "world" ? "true" : "false");
  if (tabInventoryBtn) tabInventoryBtn.setAttribute("aria-selected", which === "inventory" ? "true" : "false");
  if (typeof tabCraftingBtn !== "undefined" && tabCraftingBtn) tabCraftingBtn.setAttribute("aria-selected", which === "crafting" ? "true" : "false");
}

// Work Log cap: keeps the DOM small for performance. Default 100 entries,
// customizable in Options, clamped to 10-1000.
const LOG_LIMIT_DEFAULT = 100;
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

// Autosave interval in minutes: 1, 5, or 10. Anything else resets to 5.
const AUTOSAVE_EVERY_DEFAULT = 5;
function normalizeAutosaveEvery(v) {
  const n = Math.floor(Number(v));
  return (n === 1 || n === 5 || n === 10) ? n : AUTOSAVE_EVERY_DEFAULT;
}
// Theme override: "system" follows the OS (CSS media queries), "light"
// and "dark" force that scheme via body classes (see render.js
// applyTheme). Anything else resets to "system".
function normalizeTheme(v) {
  return (v === "light" || v === "dark") ? v : "system";
}

// O(1) id lookups over the static config lists: a length-guarded Map per
// list array, so content growth never turns the per-tick getX scans linear.
// First match wins (same as .find); the length guard rebuilds on push/pop.
// In-place field edits read live through the cached refs. bustStaticCaches
// drops everything (probes that swap whole def objects call it; file edits
// + refresh reset module state anyway).
// NOTE: these `let`s must stay above `const configWarnings =
// normalizeConfig()` below: validation already calls the memoized
// collectors, so declaring them later would throw in TDZ at load.
let __lookupMaps = new WeakMap();
let __allMilestones = null; // { n, list }
let __attainedCache = { key: null, val: null };
let __activeCache = { key: null, val: null };
function bustStaticCaches() {
  __lookupMaps = new WeakMap();
  __allMilestones = null;
  __attainedCache = { key: null, val: null };
  __activeCache = { key: null, val: null };
  if (typeof bustWorldCaches === "function") bustWorldCaches();
  if (typeof bustCraftCaches === "function") bustCraftCaches();
}
function lookupIn(list, id) {
  if (!Array.isArray(list)) return undefined;
  let m = __lookupMaps.get(list);
  if (!m || m.n !== list.length) {
    const map = new Map();
    for (const e of list) {
      if (e && e.id !== undefined && !map.has(e.id)) map.set(e.id, e);
    }
    m = { map, n: list.length };
    __lookupMaps.set(list, m);
  }
  return m.map.get(id);
}

// Item rarities, commonest-first (inventory grid + filter chips follow
// this order). Declared up here because normalizeConfig() below validates
// ITEMS rarities against it at load time. Colors live with the inventory
// UI; ids are engine truth.
const RARITY_ORDER = ["junk", "common", "uncommon", "rare", "exotic", "legendary"];

const configWarnings = normalizeConfig();
let state = makeFreshState();
let lastTime = performance.now();

// Fresh World position: first tier's start tile (top-left origin), no
// travel in progress. Reads WORLD_TIERS defensively so stripped copies
// without world config still boot (world.js guards everything else).
// visitedBiomes tracks every biome the player has ever stood on (forest
// visits unlock the Stone Axe) - sticky, saved, never cleared.
function defaultWorldState() {
  let tier = null, x = 3, y = 3;
  if (typeof WORLD_TIERS !== "undefined" && WORLD_TIERS.length) {
    const t = WORLD_TIERS[0];
    tier = t.id;
    const size = Number.isInteger(t.size) && t.size > 0 ? t.size : 6;
    x = (t.start && Number.isInteger(t.start.x)) ? Math.min(size - 1, Math.max(0, t.start.x)) : Math.floor(size / 2);
    y = (t.start && Number.isInteger(t.start.y)) ? Math.min(size - 1, Math.max(0, t.start.y)) : Math.floor(size / 2);
  }
  return { tier, x, y, travel: null, visitedBiomes: {}, posByTier: {} };
}

// Fresh crafting state: one slot record per known plan (built from the
// cleaned CRAFTING config so future plans just work), recipe discovery
// per plan, the selected group/plan, and per-group plan memory (selPlans,
// so sub-tabs return to the plan you were on). Item slots hold { id, n } or
// null (one slot per recipe input); the fuel slot likewise; fuelLeft/
// fuelMax track the partially-burned fuel unit so a reload mid-burn
// keeps its remainder; progress is the current craft's 0..1 fraction;
// selRecipe is the clicked recipe button (autofill highlight).
function defaultCraftState() {
  const st = { sel: { group: null, plan: null }, selPlans: {}, plans: {}, discovered: {} };
  if (typeof CRAFTING === "undefined") return st;
  for (const g of CRAFTING) {
    if (!st.sel.group) st.sel.group = g.id;
    for (const p of g.plans ?? []) {
      if (!st.sel.plan) st.sel.plan = p.id;
      st.plans[p.id] = { unlocked: false, items: [null], fuel: null, fuelLeft: 0, fuelMax: 1, progress: 0, selRecipe: null };
      st.discovered[p.id] = [];
    }
  }
  return st;
}

function makeFreshState() {
  const amounts = {};
  const seen = {};
  for (const r of RESOURCES) {
    amounts[r.id] = r.start ?? 0;
    if ((r.start ?? 0) > 0 && isCurrency(r)) seen[r.id] = true;
  }
  // Items share the amounts map (uncapped, so no cap math anywhere).
  if (typeof ITEMS !== "undefined") for (const it of ITEMS) amounts[it.id] = it.start ?? 0;
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
  return { amounts, seen, upgrades, unlocked: {}, options: { showMaxedUpgrades: false, stopIfFull: true, logActionBegin: true, logActionStop: true, logUpgrades: true, logUnlocks: true, logSkillUps: true, logImprovements: true, logGathering: true, logCrafting: true, logSelling: true, logConsuming: true, logSkillXp: false, logDiscovery: false, balloonSkillMilestones: true, showMaxedSkills: false, logLimit: LOG_LIMIT_DEFAULT, hidden: {}, furnFilters: { maxed: true, owned: true, unowned: true, blocked: true }, furnTypes: {}, furnSort: { key: "name", dir: 1 }, invRarity: "all", invType: "all", invSearch: "", hideEmptyInv: true, sellWarn: true, showActionTime: true, showUnlockReqs: false, theme: "system", autosave: false, autosaveEvery: AUTOSAVE_EVERY_DEFAULT, logAutosaves: true }, playerName: "Placeholder", playerStats, homes, currentHome: null, furniture, specialMessages, skills, stats: { actions: {} }, currentActionId: null, cycles: {}, builds: {}, activeBuildId: null, fullOverride: {}, impBase: {}, world: defaultWorldState(), crafting: defaultCraftState() };
}

// Player name: trimmed, capped at 24 chars, never blank (falls back to
// the default). Renaming is cosmetic - nothing reads the name yet.
const PLAYER_NAME_DEFAULT = "Placeholder";
const PLAYER_NAME_MAXLEN = 24;
function normalizePlayerName(v) {
  const t = typeof v === "string" ? v.trim().slice(0, PLAYER_NAME_MAXLEN) : "";
  return t || PLAYER_NAME_DEFAULT;
}

// Lookup helper above (see the `let`s before normalizeConfig): first
// match wins (same as .find); the length guard rebuilds on push/pop.
function getPlayerStat(id) {
  return lookupIn(typeof PLAYER_STATS !== "undefined" ? PLAYER_STATS : [], id);
}

function getHome(id) {
  return lookupIn(typeof HOMES !== "undefined" ? HOMES : [], id);
}

function getSkill(id) {
  return lookupIn(typeof SKILLS !== "undefined" ? SKILLS : [], id);
}

function getFurniture(id) {
  return lookupIn(typeof FURNITURE !== "undefined" ? FURNITURE : [], id);
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
// Both collectors are memoized on a fingerprint of their inputs (owned
// counts + home, skill levels): recomputed only when something actually
// changed, otherwise the cached array is shared. All readers only iterate
// the result, so sharing is safe; the wrappers hold live effect refs, so
// in-place amount edits read fresh. Structural config swaps (replaced
// def objects) need bustStaticCaches(), like the lookup maps above.
function activeItemEffects() {
  let key = UPGRADES.length + "/" + FURNITURE.length + "|";
  for (const u of UPGRADES) key += (state.upgrades[u.id] ?? 0) + ",";
  key += "|";
  for (const f of FURNITURE) key += (state.furniture[f.id] ?? 0) + ",";
  key += "|" + (state.currentHome ?? "");
  if (__activeCache.key !== key) {
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
    __activeCache = { key, val: out };
  }
  return __activeCache.val;
}

// Every skill milestone effect as { source, req, effect } (attained or
// not). Value readers use attainedSkillMilestoneEffects(); skillUnlocked
// uses the full list (a skill is locked while targeted but unattained).
// The flat list is structural (config-only), so it is built once and
// rebuilt only when the skill count changes (see bustStaticCaches for
// whole-def swaps). Readers only iterate - never mutated.
function allSkillMilestoneEffects() {
  const lists = (typeof SKILLS !== "undefined") ? SKILLS : [];
  if (!__allMilestones || __allMilestones.n !== lists.length) {
    const out = [];
    for (const s of lists) for (const m of s.milestones ?? []) for (const e of m.effects ?? []) out.push({ source: s.id, req: m.level, effect: e });
    __allMilestones = { n: lists.length, list: out };
  }
  return __allMilestones.list;
}
// Memoized on skill levels (see activeItemEffects above for the sharing
// contract): the filter re-runs only when a level actually changed.
function attainedSkillMilestoneEffects() {
  const lists = (typeof SKILLS !== "undefined") ? SKILLS : [];
  let key = lists.length + "|";
  if (state && state.skills) {
    for (const s of lists) {
      const st = state.skills[s.id];
      key += ((st && st.level) || 0) + ",";
    }
  }
  if (__attainedCache.key !== key) {
    __attainedCache = { key, val: allSkillMilestoneEffects().filter(x => skillLevel(x.source) >= x.req) };
  }
  return __attainedCache.val;
}

// Per-level skill scaling with an optional cap: an effect with
// `perLevel: true, cap: 5` counts at most 5 levels (e.g. Sleeping's
// first milestone stops growing past Sleeping Level 5). Read everywhere
// a perLevel skill effect is valued so tooltips and engine agree.
function skillEffectLevels(sourceId, e) {
  if (!e.perLevel) return 1;
  const lvl = skillLevel(sourceId);
  return (typeof e.cap === "number") ? Math.min(lvl, e.cap) : lvl;
}

// Effective furniture purchase cap: base maxPurchases plus every owned
// "furnitureCap" upgrade/home effect and every attained skill-milestone
// "furnitureCap" effect (e.g. Sleeping's Another Blanket lets you own
// more Blankets), plus the current home's. Read everywhere the cap
// matters so gating, tooltips, and save clamping all agree.
function getEffectiveFurnCap(f) {
  let cap = f.maxPurchases ?? 1;
  if (cap !== Infinity) {
    for (const { effect: e, mult } of activeItemEffects()) {
      if (e.type === "furnitureCap" && e.furniture === f.id) cap += e.amount * mult;
    }
    for (const x of attainedSkillMilestoneEffects()) {
      if (x.effect.type === "furnitureCap" && x.effect.furniture === f.id) cap += x.effect.amount;
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

// Current tile's biome id (or null): per-biome action stats resolve
// against the live tile, so tooltips, checks, payments, and grants all
// agree. Guarded so stripped-down copies without the world script run.
function currentBiomeId() {
  if (typeof worldUnlocked !== "function" || !worldUnlocked() || !state.world) return null;
  if (typeof worldTileAt !== "function") return null;
  const t = worldTileAt(state.world.x, state.world.y);
  return (t && t.biome && t.biome.id) || null;
}

// Per-tag action override lookup (tickByTag/costsByTag/xpByTag): the value
// of the first config entry whose tag sits on the player's tile (biome
// tags and modifier tags alike, matched case-insensitively), or undefined
// when nothing matches. Guarded like currentBiomeId (pre-World unlock =
// base stats). Tag overrides beat biome overrides beat base.
function tileTagOverride(map) {
  if (!map || typeof worldUnlocked !== "function" || !worldUnlocked() || !state.world) return undefined;
  if (typeof worldPlayerTileTags !== "function") return undefined;
  const tags = worldPlayerTileTags().map(t => String(t).toLowerCase());
  for (const [tag, v] of Object.entries(map)) {
    if (tags.includes(String(tag).toLowerCase())) return v;
  }
  return undefined;
}

// Recipe tag inputs: a recipe input key "tag:Fruit" accepts any item
// carrying that tag (matched case-insensitively), so one recipe covers
// every present and future fruit. Concrete keys match one id exactly.
function isTagInputKey(k) {
  return typeof k === "string" && k.startsWith("tag:") && k.length > 4;
}
function tagInputTag(k) {
  return k.slice(4);
}
function recipeInputMatches(key, itemId) {
  if (key === itemId) return true;
  if (!isTagInputKey(key)) return false;
  const want = tagInputTag(key).toLowerCase();
  const def = (typeof getItem === "function") ? getItem(itemId) : null;
  return !!def && getTags(def).some(t => String(t).toLowerCase() === want);
}
// Concrete item ids carrying a tag input's tag, in ITEMS order.
function tagInputItems(key) {
  if (!isTagInputKey(key)) return [key];
  const want = tagInputTag(key).toLowerCase();
  const list = (typeof ITEMS !== "undefined") ? ITEMS : [];
  return list.filter(it => getTags(it).some(t => String(t).toLowerCase() === want)).map(it => it.id);
}

// Effective action time: base tickSeconds minus every owned "time" effect
// for that action (furniture like Pillows, upgrades, current home), floored
// so the main loop can never hit zero/negative cycles.
const MIN_TICK_SECONDS = 0.1;
// Progress-bar style threshold: cycles this fast (4+ fills per second)
// read as jitter on a discrete fill, so render shows a full-width
// flowing striped bar instead (see .action-progress.flowing).
const FAST_BAR_TICK_SECONDS = 0.25;
function getEffectiveTick(a) {
  let t = a.tickSeconds ?? 1;
  // Per-biome override for the current tile (e.g. Forage runs 5s cycles
  // on forest tiles): replaces the base before reductions apply. A
  // per-tag override (e.g. 8s on Cabbage Fields) wins over the biome one.
  const bb = currentBiomeId();
  if (bb && a.tickByBiome && typeof a.tickByBiome[bb] === "number") t = a.tickByBiome[bb];
  if (a.tickByTag && typeof tileTagOverride === "function") {
    const tv = tileTagOverride(a.tickByTag);
    if (typeof tv === "number") t = tv;
  }
  for (const { effect: e, mult } of activeItemEffects()) {
    if (e.type === "time" && e.action === a.id) t -= e.amount * mult;
  }
  for (const x of attainedSkillMilestoneEffects()) {
    const e = x.effect;
    if (e.type === "time" && e.action === a.id) t -= e.amount * skillEffectLevels(x.source, e);
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
// home. An optional `requiresSeenTag` (a tag or an array of tags, e.g.
// "Food") additionally hides the entry until any item carrying one of
// those tags has been discovered (state.seen) - seen flags are sticky,
// so it never locks again. No requirements at all = always visible.
function unlockFurniture(f) {
  if (f.requiresHome !== undefined) {
    const req = Array.isArray(f.requiresHome) ? f.requiresHome : [f.requiresHome];
    if (!req.some(id => !!state.homes[id])) return false;
  }
  if (f.requiresSeenTag !== undefined) {
    const tags = Array.isArray(f.requiresSeenTag) ? f.requiresSeenTag : [f.requiresSeenTag];
    const items = (typeof ITEMS !== "undefined") ? ITEMS : [];
    if (!tags.some(t => items.some(it => getTags(it).includes(t) && state.seen && state.seen[it.id]))) return false;
  }
  return true;
}

// Blocked = unlocked but not currently buyable (maxed, unaffordable or no room).
function furnitureBlocked(f) {
  const owned = state.furniture[f.id] ?? 0;
  if (owned >= getEffectiveFurnCap(f)) return false;
  if (!canAfford(f.cost)) return true;
  return furnitureSpaceUsed() + (f.space ?? 1) > homeSpaceMax();
}

function getResource(id) {
  return lookupIn(typeof RESOURCES !== "undefined" ? RESOURCES : [], id) ?? lookupIn(typeof ITEMS !== "undefined" ? ITEMS : [], id);
}

// Inventory items: non-currency holdings (no cap, no bar) from the ITEMS
// list. They live in state.amounts like resources, so costs, gains,
// unlock watches, and auto-written descriptions accept item ids
// anywhere a resource id works - getResource resolves both lists, and
// getEffectiveMax returns Infinity for anything without a finite max.
function getItem(id) {
  return lookupIn(typeof ITEMS !== "undefined" ? ITEMS : [], id);
}

// Display name for a resource/item id, falling back to the raw id.
function resourceName(id) {
  const d = getResource(id);
  return d ? d.name : id;
}

// Display name for a looked-up def (action, home, furniture, upgrade),
// falling back to the raw id.
function entityName(get, id) {
  const d = id ? get(id) : null;
  return d ? d.name : id;
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

// Resource unlocks: a RESOURCES entry can carry `unlock` (same shape as
// action/upgrade unlocks, e.g. Health's { upgrade: "exploreTown" }); the
// row stays hidden in every panel until the gate passes. Sticky + logged
// like other unlocks (as "Unlocked Vital/Currency: <name>").
function resourceUnlocked(r) {
  if (!r || !r.unlock) return true;
  return unlockMet(r, "r");
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
  return lookupIn(typeof ACTIONS !== "undefined" ? ACTIONS : [], id);
}

function getUpgrade(id) {
  return lookupIn(typeof UPGRADES !== "undefined" ? UPGRADES : [], id);
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
    // Tags render capitalized ("consumable" -> "Consumable"); the raw
    // lowercase form stays the mechanic key checked by code.
    chip.textContent = t.slice(0, 1).toUpperCase() + t.slice(1);
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
//   { visitedBiomes: ["forest"] } = ever stood on EVERY listed biome.
//     Shorthand: { visitedBiome: "forest" } (a single id, or an array).
// Add `unlock` to any action or upgrade to gate it; groups with nothing
// visible collapse on their own. Set `unlockLog` to customize the
// message; it defaults to "Unlocked Action: <name>" /
// "Unlocked Upgrade: <name>".
// Sticky biome visits (see defaultWorldState/markBiomeVisited in world.js):
// true once the player has ever stood on that biome, matched
// case-insensitively so config may write "forest" or "Forest" alike.
function hasVisitedBiome(id) {
  if (!id || !state.world || !state.world.visitedBiomes || typeof state.world.visitedBiomes !== "object") return false;
  const want = String(id).toLowerCase();
  for (const k of Object.keys(state.world.visitedBiomes)) {
    if (String(k).toLowerCase() === want && state.world.visitedBiomes[k]) return true;
  }
  return false;
}

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
  // Biome-visit gates: EVERY listed biome must have been stood on at least
  // once (e.g. the Stone Axe needs a forest visit). Accepts the legacy
  // `visitedBiome` (single id or array) and the canonical `visitedBiomes`.
  const visitReqs = [];
  if (typeof u.visitedBiome === "string") visitReqs.push(u.visitedBiome);
  else if (Array.isArray(u.visitedBiome)) visitReqs.push(...u.visitedBiome);
  if (typeof u.visitedBiomes === "string") visitReqs.push(u.visitedBiomes);
  else if (Array.isArray(u.visitedBiomes)) visitReqs.push(...u.visitedBiomes);
  for (const b of visitReqs) if (!hasVisitedBiome(b)) return false;
  state.unlocked[key] = true;
  const kind = prefix === "u" ? "Upgrade" : prefix === "r" ? (isCurrency(item) ? "Currency" : "Vital") : "Action";
  log(item.unlockLog ?? ("Unlocked " + kind + ": " + item.name), "unlock");
  return true;
}

// Special messages: one-time circumstantial messages (see SPECIAL_MESSAGES
// in the config). Fired flags live in state.specialMessages (saved), so each
// message shows once ever - even across save/load, and even if the
// circumstance later stops holding (e.g. selling the furniture afterwards).
function specialMessageMet(m) {
  const req = m.requires ?? {};
  const stores = { furniture: state.furniture, upgrades: state.upgrades, resources: state.amounts, actions: state.stats.actions };
  for (const [kind, store] of Object.entries(stores)) {
    for (const [id, n] of Object.entries(req[kind] ?? {})) if ((store[id] ?? 0) < n) return false;
  }
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

// Resource/vital panel hosts (static index.html markup - only their
// innerHTML is ever wiped, the host elements themselves never change),
// so the document-wide host query runs once instead of every render.
let __resHosts = null;
function resPanelHosts() {
  if (!__resHosts) __resHosts = [...document.querySelectorAll(".js-currencies, .js-vitals")];
  return __resHosts;
}

// Node-list cache for hideEmptyGroups (below): group/header structure
// only changes on rebuilds (buildUI wipes containers), while hidden flags
// flip every tick - so cache the node arrays once and re-read .hidden per
// tick instead of re-querying the DOM. Validated cheaply with no queries:
// a rebuild replaces the container's children, so a changed first child
// or child count means the cache is stale. Stale entries for wiped
// containers simply get GC'd (WeakMap), like the other node caches.
const __hideCache = new WeakMap();
function hideEmptyGroups(ctn) {
  // Collapse sections whose every button is hidden (unlock/maxed/user
  // hidden), then headers whose every group is hidden. Resource rows
  // (.currency/.res) count too, so hiding a panel's last row collapses it.
  let c = __hideCache.get(ctn);
  if (!c || c.first !== ctn.firstElementChild || c.n !== ctn.childElementCount) {
    c = {
      first: ctn.firstElementChild,
      n: ctn.childElementCount,
      groups: [...ctn.querySelectorAll(".taskGroup")].map(g => ({ el: g, kids: [...g.querySelectorAll("button, .currency, .res")] })),
      headers: [...ctn.querySelectorAll(".taskHeader")].map(h => ({ el: h, gs: [...h.querySelectorAll(".taskGroup")] })),
    };
    __hideCache.set(ctn, c);
  }
  for (const g of c.groups) g.el.hidden = g.kids.length > 0 && g.kids.every(b => b.hidden);
  for (const h of c.headers) h.el.hidden = h.gs.length > 0 && h.gs.every(g => g.hidden);
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
    parts.push(formatNum(n) + " " + resourceName(id));
  }
  return parts.join(", ");
}

// Human-readable effect lines for tooltips and auto descriptions (moved
// here from tips.js: config normalization auto-writes missing upgrade /
// action descriptions at load time, before tips.js runs).
function describeEffect(e) {
  if (e.type === "max") {
    return "+" + formatNum(e.amount) + " " + resourceName(e.resource) + " max";
  }
  if (e.type === "gain") {
    return "+" + formatNum(e.amount) + " " + resourceName(e.resource) + " to " + entityName(getAction, e.action);
  }
  if (e.type === "home") {
    return "Home: " + entityName(getHome, e.home);
  }
  if (e.type === "furnitureCap") {
    return "+" + formatNum(e.amount) + " " + entityName(getFurniture, e.furniture) + " purchase cap";
  }
  if (e.type === "upgradeCap") {
    return "+" + formatNum(e.amount) + " " + entityName(getUpgrade, e.upgrade) + " purchase cap";
  }
  if (e.type === "time") {
    return "-" + formatNum(e.amount) + "s " + entityName(getAction, e.action) + " time";
  }
  if (e.type === "travelTime") {
    const b = (e.biome && typeof worldBiomeDef === "function") ? worldBiomeDef(e.biome) : null;
    return "-" + formatNum(e.amount) + "s " + (b ? b.name + " " : "World ") + "travel time";
  }
  if (e.type === "terrainDifficulty") {
    const b = (e.biome && typeof worldBiomeDef === "function") ? worldBiomeDef(e.biome) : null;
    return "-" + formatNum(e.amount) + "/s " + (b ? b.name + " " : "World ") + "travel Stamina drain";
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
    if (e.type === "gain" && e.action === a.id && e.resource) out[e.resource] = (out[e.resource] ?? 0) + e.amount * skillEffectLevels(x.source, e);
  }
  // Vital restoration (e.g. Rest heals: { health: 0.02 }): a share of
  // current max per cycle, once the vital itself is unlocked. Dynamic so
  // max-boosting effects flow through; rounded to 3dp to keep float dust
  // out of the vitals panel. Locked vitals grant nothing and the tooltip
  // hides their rows (see buildActionTipBody/renderActionTipLive).
  for (const [rid, pct] of Object.entries(a.heals ?? {})) {
    if (typeof resourceUnlocked !== "function" || typeof getResource !== "function") continue;
    const r = getResource(rid);
    if (!r || !resourceUnlocked(r)) continue;
    const mx = (typeof getEffectiveMax === "function") ? getEffectiveMax(rid) : NaN;
    if (Number.isFinite(mx) && mx > 0) out[rid] = (out[rid] ?? 0) + Math.round(mx * pct * 1000) / 1000;
  }
  return out;
}

// One cycle's skill XP: base `xp` plus the improvement xpBonus per level
// (same level timing as the payout bonus - the level just earned counts
// next cycle, since counts increment after the grant). Read everywhere XP
// is granted or displayed so tooltips stay truthful as levels land.
function effectiveXp(a) {
  const out = { ...(a.xp ?? {}) };
  // Per-biome XP override for the current tile (e.g. Forage pays 0.35
  // Foraging XP on forest tiles): replaces the base entry, then
  // improvement bonuses and multipliers stack on top as usual. A per-tag
  // override wins over the biome one, like tick and costs.
  const bb = currentBiomeId();
  if (bb && a.xpByBiome && a.xpByBiome[bb]) for (const [sid, n] of Object.entries(a.xpByBiome[bb])) out[sid] = n;
  if (a.xpByTag && typeof tileTagOverride === "function") {
    const tv = tileTagOverride(a.xpByTag);
    if (tv && typeof tv === "object") for (const [sid, n] of Object.entries(tv)) out[sid] = n;
  }
  const imp = a.improvements;
  if (imp && imp.xpBonus) {
    const lvl = actionLevel(a);
    if (lvl > 0) for (const [sid, n] of Object.entries(imp.xpBonus)) out[sid] = (out[sid] ?? 0) + n * lvl;
  }
  // Milestone XP multipliers (e.g. Plain Sense II): applied last so the
  // action tooltip already reflects the doubled rate.
  if (typeof xpMultFor === "function") for (const sid of Object.keys(out)) {
    const m = xpMultFor(sid);
    if (m !== 1) out[sid] *= m;
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
  // Shared validation micro-helpers: NaN, infinities and non-numbers fail
  // every numeric gate, so one predicate reads better than a dozen
  // `typeof ... || !Number.isFinite ...` clauses.
  function badAmount(v) { return typeof v !== "number" || !Number.isFinite(v) || v <= 0; }
  function badNonNeg(v) { return typeof v !== "number" || !Number.isFinite(v) || v < 0; }
  function badCount(v) { return !Number.isInteger(v) || v <= 0; }
  // Every named list falls back to its id when the name is missing.
  function defaultName(o) { if (typeof o.name !== "string" || !o.name) o.name = o.id; }
  // Drop a mistyped text field with a warning (`blank` also drops "").
  function dropBadString(o, field, label, note, blank) {
    if (o[field] !== undefined && (typeof o[field] !== "string" || (blank && !o[field]))) {
      warn(label + ": bad " + field + ", " + note + ".");
      delete o[field];
    }
  }
  // Remove entries with missing/duplicate ids in place (keeps the
  // first). `dupMsg` defaults to the missing message when duplicates
  // share it (the world lists do).
  function dedupeIds(arr, missingMsg, dupMsg) {
    const dup = dupMsg === undefined ? () => missingMsg : dupMsg;
    const seen = new Set();
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (!e || typeof e.id !== "string" || !e.id || seen.has(e.id)) {
        warn((!e || typeof e.id !== "string" || !e.id) ? missingMsg : dup(e.id));
        arr.splice(i, 1); i--; continue;
      }
      seen.add(e.id);
    }
  }
  // Known-biome check for per-biome overrides and travel effects.
  function knownBiome(id) {
    return (typeof WORLD_BIOMES !== "undefined") && WORLD_BIOMES.some(b => b && b.id === id);
  }
  // Map of skill ids to positive amounts (action xp, xpBonus): unknown
  // skills warn and drop (a kept entry would grant nothing yet show a
  // phantom row in tooltips).
  // Tile overrides (xpByBiome/xpByTag) pass allowZero: an explicit 0 means
  // "no XP on this tile" (overwriting the base), while a missing entry
  // means "fall back to the base" - dropping the 0 would silently run the
  // base instead of nothing (same class as the cost-zero bug below).
  function cleanXpMap(map, label, amountNoun, grantVerb, allowZero) {
    const cleaned = {};
    for (const [k, v] of Object.entries(map)) {
      const bad = allowZero
        ? (typeof v !== "number" || !Number.isFinite(v) || v < 0)
        : badAmount(v);
      if (bad) { warn(label + ": bad " + amountNoun + ' amount for "' + k + '", skipped.'); continue; }
      if (!getSkill(k)) { warn(label + ": " + grantVerb + ' unknown skill "' + k + '", skipped.'); continue; }
      cleaned[k] = v;
    }
    return cleaned;
  }
  // Map of ids to positive counts (conditional requires, message
  // requires): unknown ids warn but are kept (a typo still gates).
  function cleanCountMap(map, label, kind, finder, integer) {
    if (map === undefined) return {};
    if (!map || typeof map !== "object" || Array.isArray(map)) {
      warn(label + ": bad " + kind + " requires, ignored.");
      return {};
    }
    const cleaned = {};
    for (const [k, v] of Object.entries(map)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || (integer && !Number.isInteger(v))) {
        warn(label + ": bad " + kind + ' requires amount for "' + k + '", skipped.');
        continue;
      }
      if (!finder(k)) warn(label + ": " + kind + ' requires unknown "' + k + '".');
      cleaned[k] = v;
    }
    return cleaned;
  }
  // One biome-keyed override field (tickByBiome/costsByBiome/xpByBiome):
  // bad shapes warn and drop the field, unknown biomes warn and drop the
  // entry, and `cleanEntry` cleans one biome's value (return undefined to
  // drop it). An emptied field is deleted.
  function cleanBiomeField(a, aLabel, field, cleanEntry) {
    if (a[field] === undefined) return;
    if (!a[field] || typeof a[field] !== "object" || Array.isArray(a[field])) {
      warn(aLabel + ": bad " + field + ", ignored.");
      delete a[field];
      return;
    }
    const kept = {};
    for (const [bk, bv] of Object.entries(a[field])) {
      if (!knownBiome(bk)) { warn(aLabel + ": " + field + ' targets unknown biome "' + bk + '", skipped.'); continue; }
      const c = cleanEntry(bk, bv);
      if (c !== undefined) kept[bk] = c;
    }
    if (!Object.keys(kept).length) delete a[field];
    else a[field] = kept;
  }
  // One tile-tag-keyed override field (tickByTag/costsByTag/xpByTag):
  // same value cleaning as the biome fields, but keys are free-form tile
  // tags (biome or modifier tags, matched case-insensitively at runtime),
  // so only empty keys warn and drop. First matching entry wins per tick.
  function cleanTagField(a, aLabel, field, cleanEntry) {
    if (a[field] === undefined) return;
    if (!a[field] || typeof a[field] !== "object" || Array.isArray(a[field])) {
      warn(aLabel + ": bad " + field + ", ignored.");
      delete a[field];
      return;
    }
    const kept = {};
    for (const [tk, tv] of Object.entries(a[field])) {
      if (typeof tk !== "string" || !tk.trim()) { warn(aLabel + ": " + field + " has an empty tag, skipped."); continue; }
      const c = cleanEntry(tk, tv);
      if (c !== undefined) kept[tk] = c;
    }
    if (!Object.keys(kept).length) delete a[field];
    else a[field] = kept;
  }
  // Effect lists on upgrades, homes and furniture: same clean + collect.
  function cleanEffectsList(item, label, kind) {
    if (item.effects === undefined) item.effects = [];
    else if (!Array.isArray(item.effects)) {
      warn(label + ": bad effects, ignored.");
      item.effects = [];
    } else {
      const kept = [];
      for (const e of item.effects) {
        const c = cleanEffect(e, label, kind);
        if (c) kept.push(c);
      }
      item.effects = kept;
    }
  }
  // Skill-effect leveling tail: perLevel scales by skill level, cap stops
  // the growth. Returns false when the whole effect must be skipped.
  function applySkillScaling(e, kind, ownerLabel, out) {
    if (kind === "skill" && e.perLevel === true) out.perLevel = true;
    if (kind !== "skill") return true;
    const cap = cleanSkillCap(e, ownerLabel);
    if (cap === null) return false;
    if (cap !== undefined) out.cap = cap;
    return true;
  }
  // Optional `biome` limiter on travel effects, validated against
  // WORLD_BIOMES. Returns undefined (absent), the id, or null (invalid).
  function cleanEffectBiome(e, type, ownerLabel) {
    if (e.biome === undefined) return undefined;
    if (typeof e.biome !== "string" || !knownBiome(e.biome)) {
      warn(ownerLabel + ": skipped an invalid effect (unknown " + type + ' biome "' + e.biome + '").');
      return null;
    }
    return e.biome;
  }
  // travelTime and terrainDifficulty differ only in type name: one
  // factory builds both registry entries (docs live here, once).
  // Faster/easier travel: each World tile takes `amount` fewer seconds
  // to enter / drains `amount` less Stamina per second (floored at 0,
  // stacking). Read through getEffectiveTravelTime /
  // getEffectiveTerrainDifficulty so tooltips and travel agree. An
  // optional `biome` limits it to one biome's tiles.
  function travelEffectDef(type) {
    return {
      contexts: ["upgrade", "home", "furniture", "skill"],
      clean(e, ownerLabel, kind) {
        if (badAmount(e.amount)) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "' + type + '", amount }).');
          return null;
        }
        const biome = cleanEffectBiome(e, type, ownerLabel);
        if (biome === null) return null;
        const out = { type, amount: e.amount };
        if (biome) out.biome = biome;
        if (!applySkillScaling(e, kind, ownerLabel, out)) return null;
        return out;
      },
    };
  }
  // Purge unusable entries first (arrays are const, so edit in place):
  // a missing id would crash every engine loop, and duplicate ids would
  // share one DOM id. Later duplicates are removed, keeping the first.
  // Entries added later at runtime should call normalizeConfig() again
  // before buildUI().
  for (const [arr, kind] of [[RESOURCES, "resource"], [ACTIONS, "action"], [UPGRADES, "upgrade"], [PLAYER_STATS, "player stat"], [HOMES, "home"], [FURNITURE, "furniture"], [SPECIAL_MESSAGES, "special message"], [SKILLS, "skill"], ...(typeof ITEMS !== "undefined" ? [[ITEMS, "item"]] : [])]) {
    dedupeIds(arr, "Removed " + kind + " with no id.", (id) => "Duplicate " + kind + ' id "' + id + '" - removed the later entry.');
  }
  for (const r of RESOURCES) {
    defaultName(r);
    const rLabel = 'Resource "' + r.id + '"';
    if (badNonNeg(r.start)) {
      if (r.start !== undefined) warn(rLabel + ": bad start, reset to 0.");
      r.start = 0;
    }
    if (r.max === undefined) r.max = Infinity;
    if (r.max !== Infinity && badAmount(r.max)) {
      warn(rLabel + ": bad max, treated as uncapped.");
      r.max = Infinity;
    }
    if (r.kind !== undefined && r.kind !== "currency" && r.kind !== "vital") {
      warn(rLabel + ": bad kind, ignored.");
      delete r.kind;
    }
    cleanTags(r, rLabel);
    cleanHeader(r, rLabel);
    cleanUnlock(r, rLabel);
  }
  // Items: same name/tags shape as resources, plus rarity and an optional
  // consume bundle. Unknown or malformed bits warn and reset - an item can
  // never silently stop being edible or change color.
  if (typeof ITEMS !== "undefined") for (const it of ITEMS) {
    const label = 'Item "' + it.id + '"';
    defaultName(it);
    dropBadString(it, "plural", label, "ignored", true);
    dropBadString(it, "description", label, "ignored");
    if (it.rarity === undefined) it.rarity = "common";
    else if (!RARITY_ORDER.includes(it.rarity)) {
      warn(label + ': unknown rarity "' + it.rarity + '", reset to common.');
      it.rarity = "common";
    }
    cleanTags(it, label);
    const consumable = getTags(it).includes("consumable");
    // Edibility is tag-driven: the consume bundle only works with the
    // "consumable" tag, and the tag needs a valid bundle to do anything.
    if (it.consume !== undefined && !consumable) {
      warn(label + ": consume bundle without the consumable tag, ignored.");
      delete it.consume;
    } else if (consumable) {
      if (!it.consume || typeof it.consume !== "object" || Array.isArray(it.consume)) {
        warn(label + ": consumable but no valid consume bundle - eating it does nothing.");
        it.consume = { gains: {} };
      } else {
        if (it.consume.button !== undefined && (typeof it.consume.button !== "string" || !it.consume.button)) {
          warn(label + ": bad consume button, reset to Consume.");
          delete it.consume.button;
        }
        it.consume.gains = cleanMap(it.consume.gains, label, "consume gains", false);
        // Unknown gain ids would grant phantom amounts and paint raw-id
        // tooltip rows (same class as the action-xp bug #4); an entry
        // paying the item's own id would mint stock (eat one, get one
        // back, plus free gains). Drop both - typos must fail loudly,
        // never silently print money.
        for (const k of Object.keys(it.consume.gains)) {
          if (k === it.id) { warn(label + ": consume gains pay its own id, skipped."); delete it.consume.gains[k]; }
          else if (!getResource(k)) { warn(label + ': consume gains reference unknown resource "' + k + '", skipped.'); delete it.consume.gains[k]; }
        }
        if (it.consume.log !== undefined && typeof it.consume.log !== "string") {
          warn(label + ": bad consume log, ignored.");
          delete it.consume.log;
        }
      }
    }
    // Nutrition (Meal overheal): optional Stamina-cap multiplier for this
    // food's own grants (1.1 = heals up to 110% of max). Must be a finite
    // number above 1; anything else warns and is ignored (never blocks
    // eating, never overheals).
    if (it.nutrition !== undefined && (typeof it.nutrition !== "number" || !Number.isFinite(it.nutrition) || it.nutrition <= 1)) {
      warn(label + ": bad nutrition, ignored.");
      delete it.nutrition;
    }
  }
  for (const s of PLAYER_STATS) {
    defaultName(s);
    const sLabel2 = 'Player stat "' + s.id + '"';
    if (typeof s.abbr !== "string" || !s.abbr) s.abbr = s.name.slice(0, 3).toUpperCase();
    if (typeof s.start !== "number" || !Number.isFinite(s.start)) {
      if (s.start !== undefined) warn(sLabel2 + ": bad start, reset to 1.");
      s.start = 1;
    }
    dropBadString(s, "tooltip", sLabel2, "ignored");
    cleanTags(s, sLabel2);
  }
  // Tile cost overrides (costsByBiome/costsByTag) pass keepZero: an explicit
  // 0 means "free on this tile" (overwriting the base), while a missing
  // entry means "fall back to the base" - dropping the 0 would silently
  // charge the base instead of nothing.
  function cleanMap(map, ownerLabel, kind, warnUnknown, keepZero) {
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
      if (v === 0 && !keepZero) continue; // zero amounts are free: drop them so tips stay clean.
      // Consume gains and sell prices pass warnUnknown=false: unknown ids
      // are dropped (with their own "skipped" warning) by their callers,
      // so the kept-with-warning note below would be a lie for them.
      if (!getResource(k) && warnUnknown !== false) warn(ownerLabel + ": " + kind + ' references unknown resource "' + k + '".');
      cleaned[k] = v;
    }
    return cleaned;
  }
  // Item sell prices (Selling Mode): same rules as costs - non-negative
  // finite numbers, zeros dropped, unknown ids warn - plus two drops
  // costs don't need: unknown proceeds would mint phantom currencies
  // (same class as the consume twin above), and a price paying the
  // item's own id would mint stock (sell 1, get 2 back). An item is
  // sellable only when at least one priced entry survives cleaning.
  if (typeof ITEMS !== "undefined") for (const it of ITEMS) {
    it.sellPrice = cleanMap(it.sellPrice, 'Item "' + it.id + '"', "sell price", false);
    for (const k of Object.keys(it.sellPrice)) {
      if (k === it.id) { warn('Item "' + it.id + '": sell price pays its own id, skipped.'); delete it.sellPrice[k]; }
      else if (!getResource(k)) { warn('Item "' + it.id + '": sell price references unknown resource "' + k + '", skipped.'); delete it.sellPrice[k]; }
    }
  }
  function cleanUnlock(item, ownerLabel) {
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
    // Biome-visit gates: legacy `visitedBiome` plus canonical
    // `visitedBiomes`; each accepts a single id or an array, and EVERY
    // listed biome must have been stood on (see hasVisitedBiome).
    const visitedBiomes = [];
    for (const vkey of ["visitedBiome", "visitedBiomes"]) {
      if (k[vkey] === undefined) continue;
      const list = Array.isArray(k[vkey]) ? k[vkey] : [k[vkey]];
      if (!list.length) return void fail(": bad unlock visited biome");
      for (const id of list) {
        if (typeof id !== "string" || !id || (typeof knownBiome === "function" && !knownBiome(id))) return void fail(": bad unlock visited biome");
        if (!visitedBiomes.some(x => String(x).toLowerCase() === String(id).toLowerCase())) visitedBiomes.push(id);
      }
    }
    for (const key of Object.keys(k)) {
      if (!["resource", "amount", "resources", "home", "homes", "skill", "skillLevel", "skills", "upgrade", "upgradeCount", "upgrades", "visitedBiome", "visitedBiomes"].includes(key)) {
        warn(ownerLabel + ': unknown unlock key "' + key + '", ignored.');
      }
    }
    if (item.id && upgrades[item.id] !== undefined) {
      warn(ownerLabel + ": unlock requires its own purchase, so it can never appear.");
    }
    if (!Object.keys(resources).length && !homes.length && !Object.keys(skills).length && !Object.keys(upgrades).length && !visitedBiomes.length) {
      warn(ownerLabel + ": bad unlock, always visible.");
      delete item.unlock;
      return;
    }
    item.unlock = {};
    if (Object.keys(resources).length) item.unlock.resources = resources;
    if (homes.length) item.unlock.homes = homes;
    if (Object.keys(skills).length) item.unlock.skills = skills;
    if (Object.keys(upgrades).length) item.unlock.upgrades = upgrades;
    if (visitedBiomes.length) item.unlock.visitedBiomes = visitedBiomes;
  }
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
  // Tile requirement: which world tile tags this action/upgrade/
  // furniture needs ("requiresTile: 'General Store'" or an array like
  // ["General Store", "Market"] - ANY match satisfies it, matched
  // case-insensitively against the tile's tags). Normalizes to an array;
  // bad entries are skipped with a warning, an empty result is deleted
  // (no requirement). The legacy "shopping" tag still implies
  // ["General Store"] - see tileRequirementTags in world.js.
  function cleanTileRequires(item, ownerLabel) {
    if (item.requiresTile === undefined) return;
    const list = Array.isArray(item.requiresTile) ? item.requiresTile : [item.requiresTile];
    const kept = [];
    for (const t of list) {
      if (typeof t !== "string" || !t.trim()) {
        warn(ownerLabel + ": skipped a bad requiresTile entry (use non-empty strings).");
        continue;
      }
      const name = t.trim();
      if (!kept.some(k => k.toLowerCase() === name.toLowerCase())) kept.push(name);
    }
    if (!kept.length) {
      warn(ownerLabel + ": bad requiresTile, ignored.");
      delete item.requiresTile;
    } else item.requiresTile = kept;
  };
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
          furniture: cleanCountMap(req.furniture, ownerLabel, "conditionalLogs furniture", (k) => getFurniture(k)),
          upgrades: cleanCountMap(req.upgrades, ownerLabel, "conditionalLogs upgrade", (k) => getUpgrade(k)),
          resources: cleanCountMap(req.resources, ownerLabel, "conditionalLogs resource", (k) => getResource(k)),
          actions: cleanCountMap(req.actions, ownerLabel, "conditionalLogs action", (k) => getAction(k)),
          skills: cleanCountMap(req.skills, ownerLabel, "conditionalLogs skill", (k) => getSkill(k), true),
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
  // Optional per-level cap for skill effects (see skillEffectLevels):
  // `cap` is a skill level number - scaling counts at most that many
  // levels. Returns the cap, undefined when absent, or null (skip the
  // whole effect) when present but invalid.
  const cleanSkillCap = (e, ownerLabel) => {
    if (e.cap === undefined) return undefined;
    if (!Number.isInteger(e.cap) || e.cap < 1) {
      warn(ownerLabel + ': skipped an invalid effect (bad cap - use a positive integer skill level).');
      return null;
    }
    return e.cap;
  };
  const EFFECT_DEFS = {
    max: {
      contexts: ["upgrade", "home", "furniture"],
      clean(e, ownerLabel) {
        if (typeof e.resource !== "string" || badAmount(e.amount)) {
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
        if (typeof e.action !== "string" || typeof e.resource !== "string" || badAmount(e.amount)) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "gain", action, resource, amount }).');
          return null;
        }
        // Skill-gated payout: times the skill's level when perLevel (e.g.
        // Sleeping restores extra Stamina). Read through effectiveGains.
        // An optional `cap` stops the scaling past that skill level.
        if (kind === "skill") {
          if (!getAction(e.action) || !getResource(e.resource)) {
            warn(ownerLabel + ': skipped an invalid effect (use { type: "gain", action, resource, amount }).');
            return null;
          }
          const out = { type: "gain", action: e.action, resource: e.resource, amount: e.amount, perLevel: e.perLevel === true };
          if (!applySkillScaling(e, kind, ownerLabel, out)) return null;
          return out;
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
      contexts: ["upgrade", "home", "skill"],
      clean(e, ownerLabel) {
        if (typeof e.furniture !== "string" || !getFurniture(e.furniture) || badCount(e.amount)) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "furnitureCap", furniture, amount }).');
          return null;
        }
        return { type: "furnitureCap", furniture: e.furniture, amount: e.amount };
      },
    },
    upgradeCap: {
      contexts: ["skill"],
      clean(e, ownerLabel) {
        if (typeof e.upgrade !== "string" || !getUpgrade(e.upgrade) || badCount(e.amount)) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "upgradeCap", upgrade, amount }).');
          return null;
        }
        return { type: "upgradeCap", upgrade: e.upgrade, amount: e.amount };
      },
    },
    time: {
      contexts: ["upgrade", "furniture", "home", "skill"],
      clean(e, ownerLabel, kind) {
        if (typeof e.action !== "string" || badAmount(e.amount)) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "time", action, amount }).');
          return null;
        }
        if (!getAction(e.action)) warn(ownerLabel + ': effect targets unknown action "' + e.action + '".');
        const out = { type: "time", action: e.action, amount: e.amount };
        if (!applySkillScaling(e, kind, ownerLabel, out)) return null;
        return out;
      },
    },
    stat: {
      contexts: ["skill"],
      clean(e, ownerLabel, kind) {
        if (typeof e.stat !== "string" || !getPlayerStat(e.stat) || typeof e.amount !== "number" || !Number.isFinite(e.amount) || e.amount === 0) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "stat", stat, amount }).');
          return null;
        }
        const out = { type: "stat", stat: e.stat, amount: e.amount, perLevel: e.perLevel === true };
        if (!applySkillScaling(e, kind, ownerLabel, out)) return null;
        return out;
      },
    },
    travelTime: travelEffectDef("travelTime"),
    terrainDifficulty: travelEffectDef("terrainDifficulty"),
    cost: {
      contexts: ["skill"],
      clean(e, ownerLabel) {
        // Cost discount: each cycle of `action` costs `amount` less of
        // `resource` (floored at zero), e.g. Scroll Frugality makes Buy
        // Scrolls cost 2.5 less Coin per scroll. With `skill` (instead of
        // or alongside `action`), every action granting that skill's XP is
        // discounted, covering present and future actions alike.
        if (e.action !== undefined && (typeof e.action !== "string" || !getAction(e.action))) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "cost", action, resource, amount } or { type: "cost", skill, resource, amount }).');
          return null;
        }
        if (e.skill !== undefined && (typeof e.skill !== "string" || !getSkill(e.skill))) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "cost", action, resource, amount } or { type: "cost", skill, resource, amount }).');
          return null;
        }
        if (e.action === undefined && e.skill === undefined) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "cost", action, resource, amount } or { type: "cost", skill, resource, amount }).');
          return null;
        }
        if (typeof e.resource !== "string" || !getResource(e.resource) || badAmount(e.amount)) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "cost", action, resource, amount } or { type: "cost", skill, resource, amount }).');
          return null;
        }
        const out = { type: "cost", resource: e.resource, amount: e.amount };
        if (e.action !== undefined) out.action = e.action;
        if (e.skill !== undefined) out.skill = e.skill;
        return out;
      },
    },
    improvementCap: {
      contexts: ["skill"],
      clean(e, ownerLabel) {
        // Improvement headroom: `action` can earn `amount` more Improvement
        // levels past its base max (re-earned, never retroactive).
        const target = (typeof e.action === "string") ? getAction(e.action) : null;
        if (!target || !target.improvements || badCount(e.amount)) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "improvementCap", action, amount } on an improved action).');
          return null;
        }
        return { type: "improvementCap", action: e.action, amount: e.amount };
      },
    },
    xpMult: {
      contexts: ["skill"],
      clean(e, ownerLabel) {
        // Skill XP multiplier: every XP grant for `skill` is multiplied by
        // `amount` (compounding when several apply), e.g. Plain Sense II
        // doubles Plains Navigation XP. Read through xpMultFor wherever XP
        // is granted (effectiveXp, footfall) so tooltips stay truthful.
        if (typeof e.skill !== "string" || !getSkill(e.skill) || badAmount(e.amount)) {
          warn(ownerLabel + ': skipped an invalid effect (use { type: "xpMult", skill, amount }).');
          return null;
        }
        return { type: "xpMult", skill: e.skill, amount: e.amount };
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
    defaultName(a);
    const aLabel = 'Action "' + a.id + '"';
    if (badAmount(a.tickSeconds)) {
      if (a.tickSeconds !== undefined) warn(aLabel + ": bad tickSeconds, reset to 1.");
      a.tickSeconds = 1;
    }
    a.costs = cleanMap(a.costs, aLabel, "cost");
    a.gains = cleanMap(a.gains, aLabel, "gain");
    // Vital restoration as a share of max, e.g. heals: { health: 0.02 }.
    // Unknown vitals warn and drop; malformed maps reset to {}.
    if (a.heals === undefined) a.heals = {};
    else if (!a.heals || typeof a.heals !== "object" || Array.isArray(a.heals)) {
      warn(aLabel + ": bad heals, ignored.");
      a.heals = {};
    } else {
      const kept = {};
      for (const [rid, pct] of Object.entries(a.heals)) {
        if (typeof pct !== "number" || !Number.isFinite(pct) || pct <= 0) { warn(aLabel + ': bad heals amount for "' + rid + '", skipped.'); continue; }
        if (typeof getResource === "function" && !getResource(rid)) { warn(aLabel + ': heals references unknown resource "' + rid + '", skipped.'); continue; }
        kept[rid] = pct;
      }
      a.heals = kept;
    }
    // Skill XP per completed cycle: { skillId: amount } (see cleanXpMap:
    // unknown skills warn and drop, or tooltips would show a phantom
    // "Skill XP" row with the raw id).
    if (a.xp === undefined) a.xp = {};
    else if (!a.xp || typeof a.xp !== "object" || Array.isArray(a.xp)) {
      warn(aLabel + ": bad xp, ignored.");
      a.xp = {};
    } else a.xp = cleanXpMap(a.xp, aLabel, "xp", "xp grants");
    cleanUnlock(a, aLabel);
    // Per-biome stat overrides, resolved against the player's current
    // tile (see currentBiomeId): unknown biomes and malformed amounts
    // warn and drop, so typos surface instead of silently never firing.
    cleanBiomeField(a, aLabel, "tickByBiome", (bk, bv) => {
      if (badAmount(bv)) { warn(aLabel + ': bad tickByBiome amount for "' + bk + '", skipped.'); return undefined; }
      return bv;
    });
    cleanBiomeField(a, aLabel, "costsByBiome", (bk, bm) => {
      if (!bm || typeof bm !== "object" || Array.isArray(bm)) { warn(aLabel + ': bad costsByBiome map for "' + bk + '", skipped.'); return undefined; }
      return cleanMap(bm, aLabel, "cost (biome " + bk + ")", true, true);
    });
    cleanBiomeField(a, aLabel, "xpByBiome", (bk, bm) => {
      if (!bm || typeof bm !== "object" || Array.isArray(bm)) { warn(aLabel + ': bad xpByBiome map for "' + bk + '", skipped.'); return undefined; }
      return cleanXpMap(bm, aLabel, "xpByBiome", "xpByBiome grants", true);
    });
    // Tag-scoped overrides (see tileTagOverride): same shapes as the
    // biome fields, keyed by tile tag instead of biome id.
    cleanTagField(a, aLabel, "tickByTag", (tk, tv) => {
      if (badAmount(tv)) { warn(aLabel + ': bad tickByTag amount for "' + tk + '", skipped.'); return undefined; }
      return tv;
    });
    cleanTagField(a, aLabel, "costsByTag", (tk, bm) => {
      if (!bm || typeof bm !== "object" || Array.isArray(bm)) { warn(aLabel + ': bad costsByTag map for "' + tk + '", skipped.'); return undefined; }
      return cleanMap(bm, aLabel, "cost (tag " + tk + ")", true, true);
    });
    cleanTagField(a, aLabel, "xpByTag", (tk, bm) => {
      if (!bm || typeof bm !== "object" || Array.isArray(bm)) { warn(aLabel + ': bad xpByTag map for "' + tk + '", skipped.'); return undefined; }
      return cleanXpMap(bm, aLabel, "xpByTag", "xpByTag grants", true);
    });
    cleanTags(a, aLabel);
    cleanHeader(a, aLabel);
    if (a.improvements !== undefined) {
      const imp = a.improvements, impLabel = 'Action "' + a.id + '" improvement';
      if (!imp || typeof imp !== "object" || badCount(imp.every)) {
        warn(aLabel + ": bad improvements (need { every: <positive integer>, ... }), ignored.");
        delete a.improvements;
      } else {
        if (imp.maxLevel === undefined) imp.maxLevel = Infinity;
        if (imp.maxLevel !== Infinity && badCount(imp.maxLevel)) {
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
            const kept = cleanXpMap(imp.xpBonus, impLabel, "xpBonus", "xpBonus targets");
            if (!Object.keys(kept).length) delete imp.xpBonus;
            else imp.xpBonus = kept;
          }
        }
        cleanLogField(imp, "improvementLog", impLabel);
      }
    }
    dropBadString(a, "description", aLabel, "auto-generated");
    // Remember whether the description was auto-written: auto text embeds
    // the base costs, so it is refreshed live (discounts change it), while
    // custom descriptions are left exactly as written.
    if (a.description === undefined) {
      a.description = autoActionDescription(a);
      a._autoDesc = true;
    } else if (a._autoDesc === undefined) {
      a._autoDesc = false;
    }
    for (const f of ["startLog", "stopLog", "fullLog", "stopFullLog"]) cleanLogField(a, f, aLabel);
    cleanConditionalLogs(a, aLabel);
    cleanTileRequires(a, aLabel);
  }
  for (const u of UPGRADES) {
    defaultName(u);
    const uLabel = 'Upgrade "' + u.id + '"';
    u.cost = cleanMap(u.cost, uLabel, "cost");
    cleanUnlock(u, uLabel);
    cleanTags(u, uLabel);
    cleanHeader(u, uLabel);
    cleanMaxPurchases(u, uLabel);
    // Timed purchase: seconds to finish, working like action completion
    // time (paid at start, pausable, free resume). Must be positive.
    if (u.buildTime !== undefined) {
      if (badAmount(u.buildTime)) {
        warn(uLabel + ": bad buildTime, instant purchase.");
        delete u.buildTime;
      }
    }
    cleanEffectsList(u, uLabel, "upgrade");
    dropBadString(u, "description", uLabel, "auto-generated");
    if (!u.description) u.description = autoUpgradeDescription(u);
    // Build start text: only timed (buildTime) upgrades use it - instant
    // purchases grant immediately with buyLog, so a start line would just
    // double-log. Fires on every build start and free resume (like actions).
    if (u.startLog !== undefined) {
      if (!u.buildTime) {
        warn(uLabel + ": startLog needs buildTime, ignored.");
        delete u.startLog;
      } else cleanLogField(u, "startLog", uLabel);
    }
    cleanTileRequires(u, uLabel);
  }
  for (const h of HOMES) {
    defaultName(h);
    const hLabel = 'Home "' + h.id + '"';
    if (badCount(h.space)) {
      if (h.space !== undefined) warn(hLabel + ": bad space, reset to 1.");
      h.space = 1;
    }
    dropBadString(h, "tooltip", hLabel, "ignored");
    dropBadString(h, "unlockHint", hLabel, "ignored");
    // Replaces: this home overrides (removes) the listed homes when granted,
    // and instantly becomes current - e.g. Medium Tent replaces Small Tent.
    if (h.replaces !== undefined) {
      const list = Array.isArray(h.replaces) ? h.replaces : [h.replaces];
      const kept = [];
      for (const r of list) {
        if (typeof r !== "string" || !getHome(r)) warn(hLabel + ": bad replaces entry, skipped.");
        else if (!kept.includes(r)) kept.push(r);
      }
      if (kept.length) h.replaces = kept;
      else delete h.replaces;
    }
    cleanEffectsList(h, hLabel, "home");
    cleanTags(h, hLabel);
  }
  for (const f of FURNITURE) {
    defaultName(f);
    const fLabel = 'Furniture "' + f.id + '"';
    // Floor Space comes in 0.5 steps (0.5, 1, 1.5, ...) so small items
    // like Pillows can share space; floats stay exact at halves.
    if (badAmount(f.space) || Math.round(f.space * 2) !== f.space * 2) {
      if (f.space !== undefined) warn(fLabel + ": bad space (use 0.5 steps), reset to 1.");
      f.space = 1;
    }
    f.cost = cleanMap(f.cost, fLabel, "cost");
    cleanMaxPurchases(f, fLabel);
    cleanEffectsList(f, fLabel, "furniture");
    // Required home: a single id or an array of ids - visible when ANY is
    // owned, so entries shared across a home replacement never lock again.
    if (f.requiresHome !== undefined) {
      const list = Array.isArray(f.requiresHome) ? f.requiresHome : [f.requiresHome];
      const keptReq = [];
      for (const r of list) {
        if (typeof r !== "string" || !getHome(r)) warn(fLabel + ": bad requiresHome entry, skipped.");
        else if (!keptReq.includes(r)) keptReq.push(r);
      }
      if (keptReq.length === 1 && !Array.isArray(f.requiresHome)) f.requiresHome = keptReq[0];
      else if (keptReq.length) f.requiresHome = keptReq;
      else {
        warn(fLabel + ": bad requiresHome, always visible.");
        delete f.requiresHome;
      }
    }
    dropBadString(f, "description", fLabel, "auto-generated");
    cleanTileRequires(f, fLabel);
    // Discovery gate: hidden until any item carrying one of these tags
    // has been discovered (state.seen), e.g. requiresSeenTag: "Food".
    // Seen flags are sticky, so the entry never locks again afterwards.
    if (f.requiresSeenTag !== undefined) {
      const list = Array.isArray(f.requiresSeenTag) ? f.requiresSeenTag : [f.requiresSeenTag];
      const keptSeen = [];
      for (const t of list) {
        if (typeof t !== "string" || !t.trim()) warn(fLabel + ": bad requiresSeenTag entry, skipped.");
        else if (!keptSeen.includes(t.trim())) keptSeen.push(t.trim());
      }
      if (!keptSeen.length) {
        warn(fLabel + ": bad requiresSeenTag, always visible.");
        delete f.requiresSeenTag;
      } else {
        f.requiresSeenTag = (keptSeen.length === 1 && !Array.isArray(f.requiresSeenTag)) ? keptSeen[0] : keptSeen;
        if (typeof ITEMS !== "undefined") for (const t of keptSeen) {
          if (!ITEMS.some(it => getTags(it).includes(t))) warn(fLabel + ': requiresSeenTag watches unknown item tag "' + t + '".');
        }
      }
    }
    if (!f.description) f.description = "Furniture for your home.";
    for (const lf of ["buyLog", "sellLog", "unlockLog"]) cleanLogField(f, lf, fLabel);
    dropBadString(f, "flavor", fLabel, "ignored");
    cleanTags(f, fLabel);
  }
  // Crafting: groups of plans with recipes (see CRAFTING in the config).
  // Groups need a station furniture tag; plans need at least one recipe
  // with at least one input and at least one output. A plan runs one
  // Item Slot per recipe input (the most-input recipe sets the count)
  // plus a Fuel Slot unless fuelPerSec is 0 (a fuelless plan runs on
  // ingredients alone). Bad entries are removed with a warning; bad
  // numbers reset to safe defaults. Guarded so stripped copies without
  // crafting config boot.
  if (typeof CRAFTING !== "undefined") {
    const seenCraftIds = new Set();
    for (let gi = CRAFTING.length - 1; gi >= 0; gi--) {
      const g = CRAFTING[gi];
      const gLabel = 'Crafting group "' + (g && g.id || "?") + '"';
      if (!g || typeof g !== "object" || typeof g.id !== "string" || !g.id) {
        warn(gLabel + ": bad group, removed.");
        CRAFTING.splice(gi, 1);
        continue;
      }
      if (seenCraftIds.has(g.id)) {
        warn(gLabel + ": duplicate id, removed.");
        CRAFTING.splice(gi, 1);
        continue;
      }
      seenCraftIds.add(g.id);
      defaultName(g);
      if (typeof g.stationTag !== "string" || !g.stationTag) {
        warn(gLabel + ": bad stationTag, removed.");
        CRAFTING.splice(gi, 1);
        continue;
      }
      if (g.noStationMsg !== undefined && typeof g.noStationMsg !== "string") {
        warn(gLabel + ": bad noStationMsg, ignored.");
        delete g.noStationMsg;
      }
      if (!g.noStationMsg) g.noStationMsg = "You need a " + g.stationTag + ".";
      if (g.skill !== undefined && (typeof g.skill !== "string" || (typeof getSkill === "function" && !getSkill(g.skill)))) {
        warn(gLabel + ": bad skill, ignored.");
        delete g.skill;
      }
      if (g.speedStat !== undefined && (typeof g.speedStat !== "string" || !getPlayerStat(g.speedStat))) {
        warn(gLabel + ": bad speedStat, ignored.");
        delete g.speedStat;
      }
      if (!Array.isArray(g.plans) || !g.plans.length) {
        warn(gLabel + ": no plans, removed.");
        CRAFTING.splice(gi, 1);
        continue;
      }
      for (let pi = g.plans.length - 1; pi >= 0; pi--) {
        const p = g.plans[pi];
        const pLabel = gLabel + ' plan "' + (p && p.id || "?") + '"';
        if (!p || typeof p !== "object" || typeof p.id !== "string" || !p.id) {
          warn(pLabel + ": bad plan, removed.");
          g.plans.splice(pi, 1);
          continue;
        }
        if (seenCraftIds.has("plan:" + p.id)) {
          warn(pLabel + ": duplicate id, removed.");
          g.plans.splice(pi, 1);
          continue;
        }
        seenCraftIds.add("plan:" + p.id);
        defaultName(p);
        dropBadString(p, "description", pLabel, "ignored");
        if (badAmount(p.time)) {
          if (p.time !== undefined) warn(pLabel + ": bad time, reset to 5.");
          p.time = 5;
        }
        if (typeof p.fuelPerSec !== "number" || !Number.isFinite(p.fuelPerSec) || p.fuelPerSec < 0) {
          if (p.fuelPerSec !== undefined) warn(pLabel + ": bad fuelPerSec, reset to 0.25.");
          p.fuelPerSec = 0.25;
        }
        // Fixed Item Slot count: raised above the recipe-derived count
        // (never shrunk below it, so every input always has a slot).
        if (p.slots !== undefined && (!Number.isInteger(p.slots) || p.slots <= 0)) {
          warn(pLabel + ": bad slots, ignored.");
          delete p.slots;
        }
        if (p.starter !== undefined && typeof p.starter !== "boolean") {
          warn(pLabel + ": bad starter, ignored.");
          delete p.starter;
        }
        // Event unlock, e.g. unlock: { seen: "cabbage", skill: "cooking", skillLevel: 1 }.
        // Seen gates (item id or array) AND-stack with skill gates (legacy
        // skill/skillLevel plus a plural skills map). Unknown ids warn but
        // are kept (like costs), so typos surface instead of silently firing.
        if (p.unlock !== undefined) {
          if (!p.unlock || typeof p.unlock !== "object" || Array.isArray(p.unlock)) {
            warn(pLabel + ": bad unlock, ignored.");
            delete p.unlock;
          } else {
            const u = p.unlock;
            if (u.seen !== undefined) {
              const list = Array.isArray(u.seen) ? u.seen : [u.seen];
              const kept = [];
              for (const id of list) {
                if (typeof id !== "string" || !id) { warn(pLabel + ": bad unlock seen, skipped."); continue; }
                if (typeof getItem === "function" && !getItem(id)) warn(pLabel + ': unlock watches unknown item "' + id + '".');
                if (!kept.includes(id)) kept.push(id);
              }
              if (!kept.length) delete u.seen;
              else u.seen = Array.isArray(u.seen) ? kept : kept[0];
            }
            const skills = {};
            if (u.skill !== undefined || u.skillLevel !== undefined) {
              if (typeof u.skill !== "string" || !u.skill) { warn(pLabel + ": bad unlock skill, ignored."); delete u.skill; delete u.skillLevel; }
              else {
                const sl = u.skillLevel ?? 1;
                if (!Number.isInteger(sl) || sl < 1) { warn(pLabel + ": bad unlock skillLevel, ignored."); delete u.skill; delete u.skillLevel; }
                else {
                  if (typeof getSkill === "function" && !getSkill(u.skill)) warn(pLabel + ': unlock watches unknown skill "' + u.skill + '".');
                  skills[u.skill] = Math.max(skills[u.skill] ?? 0, sl);
                }
              }
            }
            if (u.skills !== undefined) {
              if (!u.skills || typeof u.skills !== "object" || Array.isArray(u.skills)) { warn(pLabel + ": bad unlock skills, ignored."); delete u.skills; }
              else {
                const kept = {};
                for (const [sid, sl] of Object.entries(u.skills)) {
                  if (!Number.isInteger(sl) || sl < 1) { warn(pLabel + ': bad unlock skills level for "' + sid + '", skipped.'); continue; }
                  if (typeof getSkill === "function" && !getSkill(sid)) warn(pLabel + ': unlock watches unknown skill "' + sid + '".');
                  kept[sid] = Math.max(kept[sid] ?? 0, sl);
                }
                if (!Object.keys(kept).length) delete u.skills;
                else u.skills = kept;
              }
            }
          }
        }
        p.xp = (!p.xp || typeof p.xp !== "object" || Array.isArray(p.xp)) ? {} : cleanXpMap(p.xp, pLabel, "xp", "craft XP");
        if (!Array.isArray(p.recipes) || !p.recipes.length) {
          warn(pLabel + ": no recipes, removed.");
          g.plans.splice(pi, 1);
          continue;
        }
        for (let ri = p.recipes.length - 1; ri >= 0; ri--) {
          const r = p.recipes[ri];
          const rLabel = pLabel + ' recipe "' + (r && r.id || "?") + '"';
          if (!r || typeof r !== "object" || typeof r.id !== "string" || !r.id) {
            warn(rLabel + ": bad recipe, removed.");
            p.recipes.splice(ri, 1);
            continue;
          }
          if (seenCraftIds.has("recipe:" + r.id)) {
            warn(rLabel + ": duplicate id, removed.");
            p.recipes.splice(ri, 1);
            continue;
          }
          seenCraftIds.add("recipe:" + r.id);
          defaultName(r);
          // Any number of inputs (one Item Slot each); a "tag:Fruit" key
          // accepts any item carrying that tag (see recipeInputMatches).
          // Bad amounts are dropped, unknown ids and unmatched tags warn
          // but are kept (see costs).
          const inMap = r.inputs && typeof r.inputs === "object" && !Array.isArray(r.inputs) ? r.inputs : {};
          const cleanIns = {};
          for (const k of Object.keys(inMap)) {
            const a = inMap[k];
            if (typeof a !== "number" || !Number.isFinite(a) || a <= 0) {
              warn(rLabel + ': bad input amount for "' + k + '", ignored.');
              continue;
            }
            if (typeof isTagInputKey === "function" && isTagInputKey(k)) {
              const tag = tagInputTag(k);
              if (!tag.trim()) { warn(rLabel + ': bad tag input "' + k + '", ignored.'); continue; }
              const lower = tag.toLowerCase();
              if (!(typeof ITEMS !== "undefined" && ITEMS.some(it => getTags(it).some(t => String(t).toLowerCase() === lower)))) warn(rLabel + ': tag input "' + k + '" matches no item yet.');
            }
            else if (!getResource(k)) warn(rLabel + ': inputs reference unknown item "' + k + '".');
            cleanIns[k] = Math.floor(a) || 1;
          }
          if (!Object.keys(cleanIns).length) {
            warn(rLabel + ": no inputs, removed.");
            p.recipes.splice(ri, 1);
            continue;
          }
          r.inputs = cleanIns;
          r.outputs = cleanMap(r.outputs, rLabel, "outputs");
          if (!Object.keys(r.outputs).length) {
            warn(rLabel + ": no outputs, removed.");
            p.recipes.splice(ri, 1);
            continue;
          }
          dropBadString(r, "completeLog", rLabel, "using the default");
          // Optional per-recipe craft time (seconds): overrides the plan
          // time for this recipe only. Bad values warn and fall back to
          // the plan time.
          if (r.time !== undefined && badAmount(r.time)) {
            warn(rLabel + ": bad time, using the plan time.");
            delete r.time;
          }
        }
        if (!p.recipes.length) {
          warn(pLabel + ": no recipes, removed.");
          g.plans.splice(pi, 1);
        }
      }
      if (!g.plans.length) {
        warn(gLabel + ": no plans, removed.");
        CRAFTING.splice(gi, 1);
      }
    }
  }
  // Special messages: one-time circumstantial log messages (see
  // SPECIAL_MESSAGES in the config). Requires-maps are cleaned like costs: non-negative finite
  // amounts only, unknown ids warned about but still checked.
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
      furniture: cleanCountMap(req.furniture, mLabel, "furniture", (k) => getFurniture(k)),
      upgrades: cleanCountMap(req.upgrades, mLabel, "upgrade", (k) => getUpgrade(k)),
      resources: cleanCountMap(req.resources, mLabel, "resource", (k) => getResource(k)),
      actions: cleanCountMap(req.actions, mLabel, "action", (k) => getAction(k)),
    };
    dropBadString(m, "category", mLabel, "using the default");
  }
  // Skills: leveled abilities fed by action XP. Bad numbers reset to safe
  // defaults so one typo can't break the tab; bad milestones are skipped.
  // Level curve: 0 -> 1 always costs 1 XP; 1 -> 2 costs baseXp; later
  // levels multiply by scaling each time. Milestone effects use the shared
  // EFFECT_DEFS registry above (same { type, ... } shape as upgrades) -
  // see its header for how to add a type.
  for (const s of SKILLS) {
    const sLabel = 'Skill "' + (s.id || "?") + '"';
    defaultName(s);
    if (badCount(s.maxLevel)) {
      if (s.maxLevel !== undefined) warn(sLabel + ": bad maxLevel, reset to 1.");
      s.maxLevel = 1;
    }
    if (badAmount(s.baseXp)) {
      if (s.baseXp !== undefined) warn(sLabel + ": bad baseXp, reset to 3.");
      s.baseXp = 3;
    }
    if (typeof s.scaling !== "number" || !Number.isFinite(s.scaling) || s.scaling < 1) {
      if (s.scaling !== undefined) warn(sLabel + ": bad scaling, reset to 1.5.");
      s.scaling = 1.5;
    }
    dropBadString(s, "description", sLabel, "ignored");
    // Flavor works exactly like actions: an italic line at the bottom of
    // the tooltip. Skills without one show no flavor line at all.
    dropBadString(s, "flavor", sLabel, "ignored");
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
  // World: tiers, biomes, modifiers, sites, mirrored actions (see WORLD_*
  // in the config). Missing arrays (stripped copies) are skipped; bad
  // entries warn and are removed in place, like everything above.
  {
    const worldBiomes = (typeof WORLD_BIOMES !== "undefined") ? WORLD_BIOMES : [];
    const worldTiers = (typeof WORLD_TIERS !== "undefined") ? WORLD_TIERS : [];
    const worldMods = (typeof WORLD_MODIFIERS !== "undefined") ? WORLD_MODIFIERS : [];
    const worldSites = (typeof WORLD_SITES !== "undefined") ? WORLD_SITES : [];
    dedupeIds(worldBiomes, "Removed world biome with no id.");
    for (const b of worldBiomes) {
      defaultName(b);
      const bLabel = 'World biome "' + b.id + '"';
      if (badAmount(b.travelTime)) {
        if (b.travelTime !== undefined) warn(bLabel + ": bad travelTime, reset to 5.");
        b.travelTime = 5;
      }
      if (badNonNeg(b.terrainDifficulty)) {
        if (b.terrainDifficulty !== undefined) warn(bLabel + ": bad terrainDifficulty, reset to 1.");
        b.terrainDifficulty = 1;
      }
      dropBadString(b, "color", bLabel, "ignored");
      dropBadString(b, "description", bLabel, "ignored");
      cleanTags(b, bLabel);
      // Footfall lessons for walking the land (see grantTileEntryXp):
      // needs a known skill plus a positive amount, or the biome
      // teaches nothing underfoot.
      if (b.entryXp !== undefined) {
        const ex = b.entryXp;
        if (!ex || typeof ex !== "object" || Array.isArray(ex) || typeof ex.skill !== "string" || !ex.skill || ((typeof getSkill === "function") && !getSkill(ex.skill)) || badAmount(ex.amount)) {
          warn(bLabel + ": bad entryXp, ignored.");
          delete b.entryXp;
        } else b.entryXp = { skill: ex.skill, amount: ex.amount };
      }
    }
    dedupeIds(worldTiers, "Removed world tier with no id.");
    for (let i = 0; i < worldTiers.length; i++) {
      const t = worldTiers[i];
      defaultName(t);
      const tLabel = 'World tier "' + t.id + '"';
      if (badCount(t.size)) {
        if (t.size !== undefined) warn(tLabel + ": bad size, reset to 6.");
        t.size = 6;
      }
      if (typeof t.biome !== "string" || !worldBiomes.some(b => b.id === t.biome)) {
        warn(tLabel + ": unknown biome, removed.");
        worldTiers.splice(i, 1); i--; continue;
      }
      const s = t.start;
      if (!s || !Number.isInteger(s.x) || !Number.isInteger(s.y) || s.x < 0 || s.y < 0 || s.x >= t.size || s.y >= t.size) {
        if (s !== undefined) warn(tLabel + ": bad start, centered.");
        t.start = { x: Math.floor(t.size / 2), y: Math.floor(t.size / 2) };
      }
    }
    dedupeIds(worldMods, "Removed world modifier with no id.");
    for (const m of worldMods) {
      defaultName(m);
      const mLabel = 'World modifier "' + m.id + '"';
      if (m.short !== undefined && (typeof m.short !== "string" || !m.short || m.short.length > 4)) {
        warn(mLabel + ": bad short overlay, ignored.");
        delete m.short;
      }
      if (m.travelTime !== undefined && (typeof m.travelTime !== "number" || !Number.isFinite(m.travelTime))) {
        warn(mLabel + ": bad travelTime, ignored.");
        delete m.travelTime;
      }
      if (m.terrainDifficulty !== undefined && (typeof m.terrainDifficulty !== "number" || !Number.isFinite(m.terrainDifficulty))) {
        warn(mLabel + ": bad terrainDifficulty, ignored.");
        delete m.terrainDifficulty;
      }
      dropBadString(m, "description", mLabel, "ignored");
      // Paint color: a CSS color string (e.g. "#84240c") overriding the
      // tile's biome background. Bad values are ignored (biome shows).
      if (m.color !== undefined && (typeof m.color !== "string" || !m.color.trim())) {
        warn(mLabel + ": bad color, ignored.");
        delete m.color;
      }
      // Paint size: fraction of the tile's width/height the modifier
      // color covers (0..1, default 1 = full tile). Bad values are
      // ignored (modifier covers the whole tile).
      if (m.size !== undefined && (typeof m.size !== "number" || !Number.isFinite(m.size) || m.size <= 0 || m.size > 1)) {
        warn('World modifier "' + m.id + '": bad size, ignored.');
        delete m.size;
      }
      // Action locks: action ids banned on this tile (e.g. Hamlet
      // locking Forage). Unknown ids warn and drop; an empty list or a
      // bad shape clears the field (nothing locked).
      if (m.locks !== undefined) {
        const list = Array.isArray(m.locks) ? m.locks : [m.locks];
        const kept = [];
        for (const id of list) {
          if (typeof id !== "string" || !id) {
            warn(mLabel + ": skipped a bad locked action (use action ids).");
            continue;
          }
          if (kept.some(k => k.toLowerCase() === id.toLowerCase())) continue;
          if (!ACTIONS.some(a => a.id === id)) {
            warn(mLabel + ': unknown locked action "' + id + '", removed.');
            continue;
          }
          kept.push(id);
        }
        if (!kept.length) delete m.locks;
        else m.locks = kept;
      }
      cleanTags(m, mLabel);
    }
    const seenSite = new Set();
    for (let i = 0; i < worldSites.length; i++) {
      const s = worldSites[i];
      const tier = s ? worldTiers.find(t => t.id === s.tier) : null;
      const mod = s ? worldMods.find(m => m.id === s.modifier) : null;
      const bio = (s && typeof s.biome === "string") ? worldBiomes.find(b => b.id === s.biome) : null;
      const key = s ? (s.tier + ":" + s.x + "," + s.y) : "?";
      if (!s || !tier || (!mod && !bio) || !Number.isInteger(s.x) || !Number.isInteger(s.y) || s.x < 0 || s.y < 0 || s.x >= tier.size || s.y >= tier.size || seenSite.has(key)) {
        warn("Removed a bad world site (needs a known tier, in-range x/y, and a known modifier and/or biome).");
        worldSites.splice(i, 1); i--; continue;
      }
      seenSite.add(key);
    }
    if (typeof WORLD_ACTIONS !== "undefined") {
      if (!Array.isArray(WORLD_ACTIONS)) {
        warn("WORLD_ACTIONS: bad list, ignored.");
        WORLD_ACTIONS.length = 0;
      } else {
        const seenActs = new Set();
        for (let i = 0; i < WORLD_ACTIONS.length; i++) {
          const id = WORLD_ACTIONS[i];
          if (typeof id !== "string" || !getAction(id)) {
            warn('WORLD_ACTIONS: unknown action "' + id + '", removed.');
            WORLD_ACTIONS.splice(i, 1); i--; continue;
          }
          // A repeated mirror id would build two same-id buttons while
          // only the last stays synced (dead duplicate DOM ids) - drop it.
          if (seenActs.has(id)) {
            warn('WORLD_ACTIONS: duplicate action "' + id + '", removed.');
            WORLD_ACTIONS.splice(i, 1); i--; continue;
          }
          seenActs.add(id);
        }
      }
    }
    // Forage loot tables: which items an action like Forage can find, per
    // tier plus an optional biome id or tile tag (first list match wins).
    // Bad entries are dropped with a warning; an empty table stays empty
    // (those tiles simply yield nothing).
    if (typeof FORAGE_TABLES !== "undefined") {
      if (!Array.isArray(FORAGE_TABLES)) {
        warn("FORAGE_TABLES: bad list, ignored.");
        FORAGE_TABLES.length = 0;
      } else {
        for (let i = 0; i < FORAGE_TABLES.length; i++) {
          const t = FORAGE_TABLES[i];
          const bad = !t || typeof t !== "object" || Array.isArray(t) || typeof t.tier !== "string" || !t.tier || !Array.isArray(t.items);
          const list = !bad ? t.items : [];
          const kept = [];
          if (!bad) for (const e of list) {
            if (!e || typeof e !== "object" || typeof e.item !== "string" || !getItem(e.item) || typeof e.weight !== "number" || !Number.isFinite(e.weight) || e.weight <= 0) {
              warn("FORAGE_TABLES: skipped a bad loot entry (needs a known item id and a positive weight).");
              continue;
            }
            kept.push({ item: e.item, weight: e.weight });
          }
          if (bad || !kept.length) {
            warn("FORAGE_TABLES: removed a bad table (needs a tier and at least one valid loot entry).");
            FORAGE_TABLES.splice(i, 1); i--; continue;
          }
          // Tables name a tier they drop on: an unknown one never matches
          // (every live position sits on a known tier), so it is a typo.
          if (!worldTiers.some(x => x && x.id === t.tier)) {
            warn('FORAGE_TABLES: removed a table for unknown tier "' + t.tier + '".');
            FORAGE_TABLES.splice(i, 1); i--; continue;
          }
          t.items = kept;
          if (t.biome !== undefined && typeof t.biome !== "string") { warn("FORAGE_TABLES: bad biome, ignored."); delete t.biome; }
          // A known-shape biome that names nothing is also a typo: without
          // this the table would silently match nothing, forever.
          if (typeof t.biome === "string" && !knownBiome(t.biome)) {
            warn('FORAGE_TABLES: removed a table for unknown biome "' + t.biome + '".');
            FORAGE_TABLES.splice(i, 1); i--; continue;
          }
          if (t.tag !== undefined && typeof t.tag !== "string") { warn("FORAGE_TABLES: bad tag, ignored."); delete t.tag; }
        }
      }
    }
  }
  return warnings;
}

// Resource tooltip: header row (name left, amount/cap right), tag chips
// below it, a right-aligned per-second row (only while nonzero), then
// the description text. The live numbers are filled in by render().
