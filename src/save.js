// Labor Game saves: file/clipboard import-export plus the browser Manual Save.
// Save files look like:
// { game: "labor-game", version: 12, savedAt: "2026-...", amounts: { stamina: 7, coin: 3 }, seen: { coin: true }, upgrades: { pockets: 1 }, unlocked: { "u:pockets": true }, options: { showMaxedUpgrades: false, stopIfFull: true, logActionBegin: true, logActionStop: true, logUpgrades: true, logUnlocks: true, logSkillUps: true, logImprovements: true, balloonSkillMilestones: true, showMaxedSkills: false, logLimit: 100, hidden: { "u:pockets": true }, furnFilters: { maxed: true, owned: true, unowned: true, blocked: true }, furnTypes: {}, furnSort: { key: "name", dir: 1 } }, playerName: "Placeholder", playerStats: { str: 1 }, homes: { tent: true }, currentHome: "tent", furniture: { coinPiles: 1 }, specialMessages: { makeshiftBed: true }, skills: { basicKnowledge: { xp: 0, level: 1 } }, stats: { actions: { oddJobs: 12 } }, currentActionId: null, cycles: {}, builds: {}, activeBuildId: null, impBase: { oddJobs: 100 }, world: { x: 3, y: 3, tier: "tier0", travel: null } }
// (options also carries logGathering, invRarity, invType, hideEmptyInv, autosave, autosaveEvery, and logAutosaves; amounts/seen also hold ITEMS ids.)
// Only ids listed in RESOURCES/ACTIONS/UPGRADES are loaded; missing ones use defaults.
// Exports use an opaque wrapper (like Antimatter Dimensions saves):
// LaborGameSavefileFormat4$<base64-zlib-json>EndOfSavefile
// Old plaintext JSON saves still import as-is.

const SAVE_GAME_ID = "labor-game";
const SAVE_VERSION = 12;
const SAVE_PREFIX = "LaborGameSavefileFormat";
const SAVE_SUFFIX = "EndOfSavefile";
// Manual Save: a single browser-local save (localStorage), separate from
// import/export. No autosave - the player presses Save Game in Options.
const MANUAL_SAVE_KEY = "labor-game-manual-save";

async function saveManualGame() {
  try {
    localStorage.setItem(MANUAL_SAVE_KEY, await encodeSaveText(serializeSave()));
    log("Game saved.");
  } catch (e) {
    log("Could not save game in this browser.");
  }
}

// Loads the browser save into state (no UI). True when one was applied.
async function loadManualSave() {
  let text = null;
  try {
    text = localStorage.getItem(MANUAL_SAVE_KEY);
  } catch (e) {
    return false;
  }
  if (!text) return false;
  try {
    applySaveData(await decodeSaveText(text));
    return true;
  } catch (e) {
    console.warn("[save] ignoring corrupt manual save");
    return "corrupt";
  }
}

async function loadManualGame() {
  const loaded = await loadManualSave();
  if (loaded === true) {
    buildUI();
    render();
    clearLog();
    log("Save loaded.");
  } else if (loaded === "corrupt") {
    log("Saved game was corrupt and could not be loaded.");
  } else {
    log("No saved game found.");
  }
}

// Autosave: the same browser slot as Save Game, on a timer while enabled
// (Options > Saving, off by default). Logs "Game Autosaved." unless its
// own log toggle is off. Fires from the main loop (see main.js).
async function autosaveGame() {
  try {
    localStorage.setItem(MANUAL_SAVE_KEY, await encodeSaveText(serializeSave()));
    if (state.options.logAutosaves !== false) log("Game Autosaved.");
  } catch (e) {
    if (state.options.logAutosaves !== false) log("Could not autosave game in this browser.");
  }
}

function serializeSave() {
  return {
    game: SAVE_GAME_ID,
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    amounts: { ...state.amounts },
    seen: { ...(state.seen ?? {}) },
    upgrades: { ...state.upgrades },
    unlocked: { ...state.unlocked },
    // Nested option objects need their own copies: a shallow spread would
    // share hidden/furnTypes/furnFilters/furnSort by reference, so mutating
    // a serialized snapshot (backups, export) would mutate live state.
    options: { ...state.options, hidden: { ...(state.options.hidden ?? {}) }, furnTypes: { ...(state.options.furnTypes ?? {}) }, furnFilters: { ...(state.options.furnFilters ?? {}) }, furnSort: { ...(state.options.furnSort ?? { key: "name", dir: 1 }) } },
    playerName: state.playerName,
    playerStats: { ...state.playerStats },
    homes: { ...state.homes },
    currentHome: state.currentHome,
    furniture: { ...state.furniture },
    specialMessages: { ...state.specialMessages },
    skills: Object.fromEntries(Object.entries(state.skills).map(([k, v]) => [k, { xp: v.xp, level: v.level }])),
    stats: { actions: { ...state.stats.actions } },
    currentActionId: state.currentActionId,
    cycles: Object.fromEntries(Object.entries(state.cycles).map(([k, v]) => [k, { progress: v.progress, paid: v.paid }])),
    // Timed upgrade builds ({ id: { progress, paid } }) + the running one.
    // Missing on old saves (v10 and earlier predate timed upgrades).
    builds: Object.fromEntries(Object.entries(state.builds ?? {}).map(([k, v]) => [k, { progress: v.progress, paid: v.paid }])),
    activeBuildId: (typeof state.activeBuildId === "string" && getUpgrade(state.activeBuildId)) ? state.activeBuildId : null,
    // Non-retroactive improvement-cap baselines ({ actionId: run count
    // when the cap-raising milestone fired }). Missing on old saves.
    impBase: { ...(state.impBase ?? {}) },
    // Crafting slots, burn remainder, progress, discovery and selection.
    // Validated on load (unknown ids dropped, counts floored) - see below.
    crafting: state.crafting ? {
      sel: { ...(state.crafting.sel ?? {}) },
      plans: Object.fromEntries(Object.entries(state.crafting.plans ?? {}).map(([k, v]) => [k, { unlocked: !!v.unlocked, items: (v.items ?? (v.item ? [v.item] : [])).map(s => s ? { ...s } : null), fuel: v.fuel ? { ...v.fuel } : null, fuelLeft: v.fuelLeft ?? 0, fuelMax: v.fuelMax ?? 1, progress: v.progress ?? 0, selRecipe: v.selRecipe ?? null }])),
      discovered: Object.fromEntries(Object.entries(state.crafting.discovered ?? {}).map(([k, v]) => [k, [...(v ?? [])]])),
    } : undefined,
    // "Run past the cap" overrides ({ actionId: true }). Not on old saves.
    fullOverride: { ...(state.fullOverride ?? {}) },
    // World position ({ x, y, tier, travel }). Missing on old saves.
    world: state.world ? {
      x: state.world.x, y: state.world.y, tier: state.world.tier,
      travel: state.world.travel ? { ...state.world.travel } : null,
    } : null,
  };
}

function applySaveData(data) {
  if (!data || typeof data !== "object") throw new Error("bad file");
  if (data.game !== SAVE_GAME_ID) throw new Error("not a Labor Game save");
  if (data.version !== undefined && data.version > SAVE_VERSION) throw new Error("save is from a newer version");
  if (typeof data.amounts !== "object" || data.amounts === null) throw new Error("bad file");

  // Skills first: upgrade caps can come from skill milestones (e.g.
  // Pocket Organizing raises Pockets 1->4), so skill levels must be
  // known before upgrades are clamped. Unknown ids dropped; counts
  // clamp to 0..maxLevel and XP stays a finite non-negative number.
  const savedSkills = (data.skills && typeof data.skills === "object") ? data.skills : {};
  const skills = {};
  for (const s of SKILLS) {
    const raw = savedSkills[s.id];
    let xp = 0, level = 0;
    if (raw && typeof raw === "object") {
      const rx = Number(raw.xp), rl = Math.floor(Number(raw.level));
      if (Number.isFinite(rx) && rx > 0) xp = rx;
      if (Number.isFinite(rl) && rl > 0) level = Math.min(s.maxLevel, rl);
    }
    skills[s.id] = { xp, level };
  }
  state.skills = skills;
  // Upgrades next (furniture caps read them), then homes + current home,
  // then furniture (its cap reads upgrades + home + skill milestones),
  // and only then amounts: clamping to the *effective* cap needs all of
  // them already loaded, or a save whose cap comes from furniture/a home
  // (e.g. 15 Coin with Coin Piles) would be wrongly clamped to the
  // smaller pre-load cap on import. Skills load first (above), so the
  // effective cap includes skill-milestone raises and over-base purchases
  // (Pockets 3/1 via Pocket Organizing, Blankets 2/1 via Another Blanket)
  // survive the round trip.
  const upgrades = {};
  const savedUpgrades = (data.upgrades && typeof data.upgrades === "object") ? data.upgrades : {};
  for (const u of UPGRADES) {
    const n = Math.floor(Number(savedUpgrades[u.id]));
    const cap = (typeof getEffectiveUpgradeCap === "function") ? getEffectiveUpgradeCap(u) : (u.maxPurchases ?? 1);
    upgrades[u.id] = !Number.isFinite(n) || n < 0 ? 0 : Math.min(cap, n);
  }
  state.upgrades = upgrades;
  // Homes owned (permanent flags) + current home. Unknown ids are dropped.
  const savedHomes = (data.homes && typeof data.homes === "object") ? data.homes : {};
  const homes = {};
  for (const h of HOMES) if (savedHomes[h.id]) homes[h.id] = true;
  state.homes = homes;
  state.currentHome = (typeof data.currentHome === "string" && getHome(data.currentHome) && homes[data.currentHome]) ? data.currentHome : null;
  if (!state.currentHome) state.currentHome = (HOMES.find(h => homes[h.id]) ?? {}).id ?? null;
  const savedFurniture = (data.furniture && typeof data.furniture === "object") ? data.furniture : {};
  const furniture = {};
  for (const f of FURNITURE) {
    // Owned counts load raw (never clamped to the cap): furnitureCap is a
    // documented home effect type (caps can move with the current home),
    // so clamping would silently destroy paid furniture after moving
    // somewhere with a lower cap. Over-cap just shows "4/2" and can't
    // buy more until room grows - the same rule a mid-session move uses.
    const n = Math.floor(Number(savedFurniture[f.id]));
    furniture[f.id] = !Number.isFinite(n) || n < 0 ? 0 : n;
  }
  state.furniture = furniture;
  // Fired one-time special-message flags. Unknown ids are dropped; old
  // saves (and fresh states) simply haven't fired them yet. Pre-rename
  // saves stored these under "milestones" - still honored.
  const savedSpecial = (data.specialMessages && typeof data.specialMessages === "object") ? data.specialMessages
    : (data.milestones && typeof data.milestones === "object") ? data.milestones : {};
  const specialMessages = {};
  for (const m of SPECIAL_MESSAGES) if (savedSpecial[m.id]) specialMessages[m.id] = true;
  state.specialMessages = specialMessages;
  const amounts = {};
  for (const r of RESOURCES) {
    const n = Number(data.amounts[r.id]);
    if (!Number.isFinite(n) || n < 0) {
      amounts[r.id] = r.start ?? 0;
    } else {
      // Meal overheal legitimately parks Stamina past its cap (up to the
      // best edible nutrition), so the loader honors that ceiling instead
      // of clamping the buffer away - tampered values still clamp.
      const over = (r.id === "stamina" && typeof maxNutritionMult === "function") ? maxNutritionMult() : 1;
      amounts[r.id] = Math.min(getEffectiveMax(r.id) * over, n);
    }
  }
  // Items are uncapped: load any non-negative finite amount as-is.
  if (typeof ITEMS !== "undefined") for (const it of ITEMS) {
    const n = Number(data.amounts[it.id]);
    amounts[it.id] = (!Number.isFinite(n) || n < 0) ? (it.start ?? 0) : Math.floor(n);
  }
  state.amounts = amounts;
  const savedUnlocked = (data.unlocked && typeof data.unlocked === "object") ? data.unlocked : {};
  const unlocked = {};
  for (const a of ACTIONS) if (savedUnlocked["a:" + a.id]) unlocked["a:" + a.id] = true;
  for (const u of UPGRADES) if (savedUnlocked["u:" + u.id]) unlocked["u:" + u.id] = true;
  for (const r of RESOURCES) if (savedUnlocked["r:" + r.id]) unlocked["r:" + r.id] = true;
  for (const f of FURNITURE) if (savedUnlocked["f:" + f.id]) unlocked["f:" + f.id] = true;
  if (savedUnlocked["tab:crafting"]) unlocked["tab:crafting"] = true;
  state.unlocked = unlocked;
  const savedStats = (data.stats && typeof data.stats === "object" && data.stats.actions && typeof data.stats.actions === "object") ? data.stats.actions : {};
  const actions = {};
  for (const a of ACTIONS) {
    const n = Math.floor(Number(savedStats[a.id]));
    actions[a.id] = !Number.isFinite(n) || n < 0 ? 0 : n;
  }
  state.stats = { actions };
  // Discovered currencies (Currencies panels hide the rest). Saved as
  // { id: true }; old saves infer it so earned history isn't lost: held
  // now, started with, paid out by any completed action, or watched by a
  // fired unlock / spent on owned furniture (which required holding it).
  // Items use the same map for Inventory discovery: any held item shows.
  const savedSeen = (data.seen && typeof data.seen === "object") ? data.seen : null;
  const seen = {};
  if (savedSeen) {
    for (const r of RESOURCES) if (savedSeen[r.id]) seen[r.id] = true;
    if (typeof ITEMS !== "undefined") for (const it of ITEMS) if (savedSeen[it.id]) seen[it.id] = true;
  } else {
    for (const r of RESOURCES) {
      if (!isCurrency(r)) continue;
      if ((amounts[r.id] ?? 0) > 0) { seen[r.id] = true; continue; }
      if ((r.start ?? 0) > 0) { seen[r.id] = true; continue; }
      let earned = false;
      for (const a of ACTIONS) {
        if ((actions[a.id] ?? 0) <= 0) continue;
        if ((a.gains?.[r.id] ?? 0) > 0) { earned = true; break; }
        if ((a.improvements?.bonus?.[r.id] ?? 0) > 0) { earned = true; break; }
      }
      if (earned) { seen[r.id] = true; continue; }
      let held = false;
      for (const key of Object.keys(unlocked ?? {})) {
        const item = key.startsWith("a:") ? getAction(key.slice(2)) : key.startsWith("u:") ? getUpgrade(key.slice(2)) : null;
        if (item?.unlock?.resource === r.id) { held = true; break; }
      }
      if (!held) for (const f of FURNITURE) {
        if ((furniture[f.id] ?? 0) > 0 && (f.cost?.[r.id] ?? 0) > 0) { held = true; break; }
      }
      if (held) seen[r.id] = true;
    }
    // Items: seen while held (or started with). Forage loot marks seen
    // live, so old saves with items in amounts still list them.
    if (typeof ITEMS !== "undefined") for (const it of ITEMS) {
      if ((amounts[it.id] ?? 0) > 0 || (it.start ?? 0) > 0) seen[it.id] = true;
    }
  }
  state.seen = seen;
  state.playerName = normalizePlayerName(data.playerName);
  const savedPlayerStats = (data.playerStats && typeof data.playerStats === "object") ? data.playerStats : {};
  const playerStats = {};
  for (const s of PLAYER_STATS) {
    const n = Math.floor(Number(savedPlayerStats[s.id]));
    // Floor at the starting value: stats never legitimately go below it,
    // so a crafted negative can't persist (and display) as e.g. -2 STR.
    playerStats[s.id] = Number.isFinite(n) ? Math.max(s.start ?? 1, n) : (s.start ?? 1);
  }
  state.playerStats = playerStats;
  state.options = {
    showMaxedUpgrades: !!(data.options && data.options.showMaxedUpgrades),
    // The old single "logActions" toggle maps onto both halves.
    logActionBegin: !data.options || (data.options.logActionBegin ?? data.options.logActions) !== false,
    logActionStop: !data.options || (data.options.logActionStop ?? data.options.logActions) !== false,
    stopIfFull: !data.options || data.options.stopIfFull !== false,
    showMaxedSkills: !!(data.options && data.options.showMaxedSkills),
    // User-hidden item ids (display only). Keep truthy string keys.
    hidden: (() => {
      const h = {};
      const raw = (data.options && typeof data.options.hidden === "object" && !Array.isArray(data.options.hidden)) ? data.options.hidden : {};
      for (const [k, v] of Object.entries(raw)) if (typeof k === "string" && v) h[k] = true;
      return h;
    })(),
    logUpgrades: !data.options || data.options.logUpgrades !== false,
    logUnlocks: !data.options || data.options.logUnlocks !== false,
    logSkillUps: !data.options || data.options.logSkillUps !== false,
    logImprovements: !data.options || data.options.logImprovements !== false,
    logGathering: !data.options || data.options.logGathering !== false,
    logCrafting: !data.options || data.options.logCrafting !== false,
    logSelling: !data.options || data.options.logSelling !== false,
    logConsuming: !data.options || data.options.logConsuming !== false,
    // Skill XP receipts (off by default to avoid per-cycle spam).
    logSkillXp: !!data.options && data.options.logSkillXp === true,
    // Recipe discovery lines (off by default).
    logDiscovery: !!data.options && data.options.logDiscovery === true,
    balloonSkillMilestones: !data.options || data.options.balloonSkillMilestones !== false,
    logLimit: normalizeLogLimit(data.options && data.options.logLimit),
    // Inventory rarity + type filters (ids stay valid via the render gates).
    invRarity: (data.options && typeof data.options.invRarity === "string") ? data.options.invRarity : "all",
    invType: (data.options && typeof data.options.invType === "string") ? data.options.invType : "all",
    // Inventory search text (plain string, AND-combined with the filters).
    invSearch: (data.options && typeof data.options.invSearch === "string") ? data.options.invSearch : "",
    // Hide exhausted inventory items (on by default): owned-0 items hide
    // instead of showing grayed-out. Never-obtained items stay hidden
    // either way (the render's seen gate is unconditional).
    hideEmptyInv: !data.options || data.options.hideEmptyInv !== false,
    // Item-tip over-cap sale warning (on by default).
    sellWarn: !data.options || data.options.sellWarn !== false,
    // Action/upgrade tooltip time lines (on by default).
    showActionTime: !data.options || data.options.showActionTime !== false,
    // Unlock-requirement sections (off by default, to keep tooltips compact).
    showUnlockReqs: !!(data.options && data.options.showUnlockReqs),
    // Theme override (follow system by default).
    theme: normalizeTheme(data.options && data.options.theme),
    // Autosave (off by default): timer save to the browser slot, every
    // 1/5/10 minutes, with its own log toggle (on by default).
    autosave: !!(data.options && data.options.autosave),
    autosaveEvery: normalizeAutosaveEvery(data.options && data.options.autosaveEvery),
    logAutosaves: !data.options || data.options.logAutosaves !== false,
    furnFilters: {
      maxed: !data.options || !data.options.furnFilters || data.options.furnFilters.maxed !== false,
      owned: !data.options || !data.options.furnFilters || data.options.furnFilters.owned !== false,
      unowned: !data.options || !data.options.furnFilters || data.options.furnFilters.unowned !== false,
      blocked: !data.options || !data.options.furnFilters || data.options.furnFilters.blocked !== false,
    },
    furnSort: normalizeFurnSort(data.options && data.options.furnSort),
    // Per-type visibility (missing tags and old saves default to shown).
    furnTypes: (data.options && typeof data.options.furnTypes === "object" && data.options.furnTypes) ? { ...data.options.furnTypes } : {},
  };
  delete state.progress;
  // Per-action cycle progress ({ id: { progress, paid } }): stopping keeps
  // it, resuming a paid cycle is free. Old saves have none - start fresh.
  const cycles = {};
  if (data.cycles && typeof data.cycles === "object") {
    for (const a of ACTIONS) {
      const c = data.cycles[a.id];
      if (c && typeof c === "object") {
        const p = Number(c.progress);
        cycles[a.id] = {
          progress: Number.isFinite(p) && p > 0 ? Math.min(p, getEffectiveTick(a)) : 0,
          paid: c.paid === true,
        };
      }
    }
  }
  state.cycles = cycles;
  // "Run past the cap" overrides ({ actionId: true }). Missing on old
  // saves (none set); only true flags on known actions load. Stale flags
  // (outputs since dropped under cap) clear on first render.
  state.fullOverride = {};
  if (data.fullOverride && typeof data.fullOverride === "object") {
    for (const a of ACTIONS) if (data.fullOverride[a.id] === true) state.fullOverride[a.id] = true;
  }
  state.currentActionId = data.currentActionId && getAction(data.currentActionId) ? data.currentActionId : null;
  // Timed upgrade builds ({ id: { progress, paid } }) + the running one.
  // Old saves have none - start fresh. The active build only resumes when
  // it is still paid for and unbought; anything else stays paused.
  const builds = {};
  if (data.builds && typeof data.builds === "object") {
    for (const u of UPGRADES) {
      if (!u.buildTime) continue;
      const b = data.builds[u.id];
      if (b && typeof b === "object") {
        const p = Number(b.progress);
        builds[u.id] = {
          progress: Number.isFinite(p) && p > 0 ? Math.min(p, u.buildTime) : 0,
          paid: b.paid === true,
        };
      }
    }
  }
  state.builds = builds;
  state.activeBuildId = (typeof data.activeBuildId === "string" && getUpgrade(data.activeBuildId)) ? data.activeBuildId : null;
  if (state.activeBuildId) {
    const u = getUpgrade(state.activeBuildId);
    const b = state.builds[u.id];
    if (!u.buildTime || !b || !b.paid || (state.upgrades[u.id] ?? 0) >= getEffectiveUpgradeCap(u)) state.activeBuildId = null;
  }
  // Improvement-cap baselines for the non-retroactive extra levels (saved
  // per action; old saves predate the system and simply start without).
  const impBase = {};
  if (data.impBase && typeof data.impBase === "object") {
    for (const a of ACTIONS) {
      const n = Math.floor(Number(data.impBase[a.id]));
      if (Number.isFinite(n) && n > 0) impBase[a.id] = n;
    }
  }
  state.impBase = impBase;
  // World position (missing on old saves - start fresh at the tier's
  // start tile). Coordinates clamp to the tier's size; an unknown tier
  // falls back to the first one. A saved trip resumes only when its
  // target is still in range with positive time left.
  state.world = (typeof defaultWorldState === "function") ? defaultWorldState() : { tier: null, x: 3, y: 3, travel: null };
  if (data.world && typeof data.world === "object") {
    const tiers = (typeof WORLD_TIERS !== "undefined") ? WORLD_TIERS : [];
    const tier = tiers.some(t => t.id === data.world.tier) ? data.world.tier : (tiers[0] ? tiers[0].id : null);
    const size = (() => {
      const t = tiers.find(t => t.id === tier);
      return (t && Number.isInteger(t.size) && t.size > 0) ? t.size : 6;
    })();
    const cx = Math.floor(Number(data.world.x)), cy = Math.floor(Number(data.world.y));
    state.world.tier = tier;
    state.world.x = (Number.isFinite(cx) && cx >= 0 && cx < size) ? cx : Math.floor(size / 2);
    state.world.y = (Number.isFinite(cy) && cy >= 0 && cy < size) ? cy : Math.floor(size / 2);
    const tr = data.world.travel;
    if (tr && typeof tr === "object") {
      const tx = Math.floor(Number(tr.tx)), ty = Math.floor(Number(tr.ty));
      const total = Number(tr.total), rem = Number(tr.remaining);
      if (Number.isInteger(tx) && Number.isInteger(ty) && tx >= 0 && ty >= 0 && tx < size && ty < size
        && Number.isFinite(total) && total > 0 && Number.isFinite(rem) && rem > 0) {
        // Pre-fractional saves accrued drain separately (drainAcc): fold
        // any leftover into Stamina once, so nothing vanishes on upgrade.
        const drain = Number(tr.drainAcc);
        state.world.travel = { tx, ty, total, remaining: Math.min(rem, total), paused: tr.paused === true };
        if (Number.isFinite(drain) && drain > 0) state.amounts.stamina = Math.max(0, (state.amounts.stamina ?? 0) - drain);
      }
    }
  }
  // Cycles clamped before the saved world position loaded (which sets the
  // tile for biome/tag tick overrides) - re-clamp now that the tile is
  // known, so a cross-biome load can't leave progress past one cycle.
  for (const a of ACTIONS) {
    const c = state.cycles[a.id];
    if (c) c.progress = Math.min(c.progress, getEffectiveTick(a));
  }
  // Crafting progress (missing on old saves - start fresh). Unknown
  // plan, item and recipe ids are dropped; slot counts floor to integers
  // and vanish at zero; item slots clamp to the plan's slot count (old
  // single-`item` saves migrate into slot 0); the burn remainder and
  // progress clamp to sane ranges, so a tampered save can only pause a
  // plan, never break it.
  state.crafting = (typeof defaultCraftState === "function") ? defaultCraftState() : { sel: {}, plans: {}, discovered: {} };
  if (data.crafting && typeof data.crafting === "object") {
    const dc = data.crafting;
    const validSlot = (s) => {
      if (!s || typeof s !== "object" || typeof s.id !== "string" || !getResource(s.id)) return null;
      const n = Math.floor(Number(s.n));
      return (Number.isFinite(n) && n > 0) ? { id: s.id, n } : null;
    };
    const groups = (typeof CRAFTING !== "undefined") ? CRAFTING : [];
    for (const g of groups) {
      for (const p of g.plans ?? []) {
        const saved = dc.plans && dc.plans[p.id];
        if (!saved || typeof saved !== "object") continue;
        const st = state.crafting.plans[p.id];
        if (!st) continue;
        st.unlocked = saved.unlocked === true;
        // Item slots (array); very old saves hold a single `item` field.
        const rawItems = Array.isArray(saved.items) ? saved.items : (saved.item ? [saved.item] : []);
        st.items = rawItems.map(validSlot);
        while (st.items.length < planItemSlots(p)) st.items.push(null);
        if (st.items.length > planItemSlots(p)) st.items.length = planItemSlots(p);
        st.fuel = planNeedsFuel(p) ? validSlot(saved.fuel) : null;
        st.selRecipe = (typeof saved.selRecipe === "string" && p.recipes.some(r => r.id === saved.selRecipe)) ? saved.selRecipe : null;
        const fl = Number(saved.fuelLeft), fm = Number(saved.fuelMax), pr = Number(saved.progress);
        st.fuelLeft = (Number.isFinite(fl) && fl > 0) ? fl : 0;
        st.fuelMax = (Number.isFinite(fm) && fm > 0) ? fm : 1;
        st.progress = (Number.isFinite(pr) && pr > 0) ? Math.min(pr, 1) : 0;
        if (dc.discovered && Array.isArray(dc.discovered[p.id])) {
          state.crafting.discovered[p.id] = [...new Set(dc.discovered[p.id])].filter(rid => p.recipes.some(r => r.id === rid));
        }
      }
    }
    if (dc.sel && typeof dc.sel === "object") {
      if (groups.some(g => g.id === dc.sel.group)) state.crafting.sel.group = dc.sel.group;
      if (groups.some(g => (g.plans ?? []).some(p => p.id === dc.sel.plan))) state.crafting.sel.plan = dc.sel.plan;
    }
  }
  // Hiding mode is a live, in-progress gesture (armed Hide button, struck
  // rows revealed) - never part of a save. Importing must disarm it, or a
  // mode armed before the import would linger over the fresh state.
  // Previously hidden items STAY hidden (state.options.hidden is saved);
  // only the armed mode itself is forced off.
  for (const k of Object.keys(hidingMode)) hidingMode[k] = false;
  if (typeof syncHideButtons === "function") syncHideButtons();
  // Selling mode is the same kind of live gesture (armed Sell button) -
  // never saved, so importing disarms it like hiding mode. The next
  // renderInventory syncs the button/row/grid.
  if (typeof invSelling !== "undefined" && invSelling) invSelling = false;
  // Timer + merge-chain runtimes never persist: the timer restarts from
  // zero and stale line refs (detached by the import's clearLog) must not
  // be rewritten by the next eat/sell/XP/craft.
  if (typeof autosaveAcc !== "undefined") autosaveAcc = 0;
  if (typeof consumeAcc !== "undefined") consumeAcc = null;
  if (typeof sellAcc !== "undefined") sellAcc = null;
  if (typeof skillXpAcc !== "undefined") skillXpAcc = null;
  if (typeof craftAcc !== "undefined") craftAcc = null;
  // Heal float-dust XP (e.g. Sleeping 7.999999999999991/8): snaps stored
  // values and fires any suppressed level-ups with the normal log +
  // balloon. Import paths clearLog() afterwards (state still correct);
  // the boot path keeps the announcement in the log.
  if (typeof settleSkillLevels === "function") settleSkillLevels();
  lastTime = performance.now();
}

// Opaque save format: base64(zlib(JSON)) wrapped with a prefix, version,
// and suffix (like Antimatter Dimensions saves). decodeSaveText reverses
// it; legacy plaintext JSON passes straight through.
function bytesToB64(bytes) {
  const b = new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}

function b64ToBytes(s) {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return b;
}

async function deflateBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflateBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function encodeSaveText(data) {
  if (!window.CompressionStream) throw new Error("no compression");
  const raw = new TextEncoder().encode(JSON.stringify(data ?? serializeSave()));
  return SAVE_PREFIX + SAVE_VERSION + "$" + bytesToB64(await deflateBytes(raw)) + SAVE_SUFFIX;
}

async function decodeSaveText(text) {
  const t = (text || "").trim();
  if (t.startsWith(SAVE_PREFIX) && t.endsWith(SAVE_SUFFIX)) {
    if (!window.DecompressionStream) throw new Error("no decompression");
    const m = t.slice(SAVE_PREFIX.length, -SAVE_SUFFIX.length).match(/^(\d+)\$([A-Za-z0-9+/=]+)$/);
    if (!m) throw new Error("bad file");
    if (Number(m[1]) > SAVE_VERSION) throw new Error("save is from a newer version");
    try {
      const plain = await inflateBytes(b64ToBytes(m[2]));
      return JSON.parse(new TextDecoder().decode(plain));
    } catch (e) {
      throw new Error("bad file");
    }
  }
  return JSON.parse(t);
}

async function exportSave() {
  let text;
  try {
    text = await encodeSaveText();
  } catch (e) {
    log("Export failed: compression is unavailable in this browser.");
    return;
  }
  const blob = new Blob([text], { type: "text/plain" });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = SAVE_GAME_ID + "-save-" + stamp + ".txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  log("Save exported.");
}

function importSaveFile(file) {  const reader = new FileReader();
  reader.onload = async () => {
    try {
      applySaveData(await decodeSaveText(reader.result));
      buildUI();
      render();
      clearLog();
      log("Save imported.");
    } catch (e) {
      log("Could not import save: " + ((e && e.message) || "bad file") + ".");
    }
    importInput.value = "";
  };
  reader.onerror = () => {
    log("Could not import save: read failed.");
    importInput.value = "";
  };
  reader.readAsText(file);
}

function showClipBox(mode, text) {
  clipMode = mode;
  clipArea.value = text || "";
  clipArea.readOnly = mode === "export";
  clipLoadBtn.hidden = mode !== "import";
  clipBox.hidden = false;
  clipArea.focus();
  if (mode === "export") clipArea.select();
}

async function exportSaveToClipboard() {
  let text;
  try {
    text = await encodeSaveText();
  } catch (e) {
    log("Export failed: compression is unavailable in this browser.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    log("Save copied to clipboard.");
  } catch (e) {
    showClipBox("export", text);
    log("Clipboard blocked. Copy the text manually.");
  }
}

async function loadClipArea() {
  try {
    applySaveData(await decodeSaveText(clipArea.value));
    buildUI();
    render();
    clearLog();
    log("Save imported.");
    clipBox.hidden = true;
    clipMode = null;
    clipArea.value = "";
  } catch (e) {
    log("Could not import save: " + ((e && e.message) || "bad text") + ".");
  }
}
