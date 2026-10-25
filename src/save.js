// Labor Game saves: file/clipboard import-export plus the browser Manual Save.
// Save files look like:
// { game: "labor-game", version: 10, savedAt: "2026-...", amounts: { stamina: 7, coin: 3 }, seen: { coin: true }, upgrades: { pockets: 1 }, unlocked: { "u:pockets": true }, options: { showMaxedUpgrades: false, logActionBegin: true, logActionStop: true, logUpgrades: true, logUnlocks: true, logImprovements: true, logLimit: 200, hidden: { "u:pockets": true }, showMaxedSkills: false, furnFilters: { maxed: true, owned: true, unowned: true, blocked: true }, furnTypes: {}, furnSort: { key: "name", dir: 1 } }, playerName: "Placeholder", playerStats: { str: 1 }, homes: { tent: true }, currentHome: "tent", furniture: { coinPiles: 1 }, milestones: { makeshiftBed: true }, skills: { basicKnowledge: { xp: 0, level: 1 } }, stats: { actions: { oddJobs: 12 } }, currentActionId: null, cycles: {}, impBase: { oddJobs: 100 } }
// Only ids listed in RESOURCES/ACTIONS/UPGRADES are loaded; missing ones use defaults.
// Exports use an opaque wrapper (like Antimatter Dimensions saves):
// LaborGameSavefileFormat4$<base64-zlib-json>EndOfSavefile
// Old plaintext JSON saves still import as-is.

const SAVE_GAME_ID = "labor-game";
const SAVE_VERSION = 10;
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
    return false;
  }
}

async function loadManualGame() {
  if (await loadManualSave()) {
    buildUI();
    render();
    clearLog();
    log("Save loaded.");
  } else {
    log("No saved game found.");
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
    options: { ...state.options },
    playerName: state.playerName,
    playerStats: { ...state.playerStats },
    homes: { ...state.homes },
    currentHome: state.currentHome,
    furniture: { ...state.furniture },
    milestones: { ...state.milestones },
    skills: Object.fromEntries(Object.entries(state.skills).map(([k, v]) => [k, { xp: v.xp, level: v.level }])),
    stats: { actions: { ...state.stats.actions } },
    currentActionId: state.currentActionId,
    cycles: Object.fromEntries(Object.entries(state.cycles).map(([k, v]) => [k, { progress: v.progress, paid: v.paid }])),
    // Non-retroactive improvement-cap baselines ({ actionId: run count
    // when the cap-raising milestone fired }). Missing on old saves.
    impBase: { ...(state.impBase ?? {}) },
  };
}

function applySaveData(data) {
  if (!data || typeof data !== "object") throw new Error("bad file");
  if (data.game !== SAVE_GAME_ID) throw new Error("not a Labor Game save");
  if (data.version !== undefined && data.version > SAVE_VERSION) throw new Error("save is from a newer version");
  if (typeof data.amounts !== "object" || data.amounts === null) throw new Error("bad file");

  // Upgrades first (furniture caps read them), then homes + current home,
  // then furniture (its cap reads upgrades + home), and only then amounts:
  // clamping to the *effective* cap needs all three already loaded, or a
  // save whose cap comes from furniture/a home (e.g. 15 Coin with Coin
  // Piles) would be wrongly clamped to the smaller pre-load cap on import.
  const upgrades = {};
  const savedUpgrades = (data.upgrades && typeof data.upgrades === "object") ? data.upgrades : {};
  for (const u of UPGRADES) {
    const n = Math.floor(Number(savedUpgrades[u.id]));
    upgrades[u.id] = !Number.isFinite(n) || n < 0 ? 0 : Math.min(u.maxPurchases ?? 1, n);
  }
  state.upgrades = upgrades;
  // Homes owned (permanent flags) + current home. Unknown ids are dropped.
  const savedHomes = (data.homes && typeof data.homes === "object") ? data.homes : {};
  const homes = {};
  for (const h of HOMES) if (savedHomes[h.id]) homes[h.id] = true;
  state.homes = homes;
  state.currentHome = (typeof data.currentHome === "string" && getHome(data.currentHome) && homes[data.currentHome]) ? data.currentHome : null;
  if (!state.currentHome && homes[HOMES[0]?.id]) state.currentHome = HOMES[0].id;
  const savedFurniture = (data.furniture && typeof data.furniture === "object") ? data.furniture : {};
  const furniture = {};
  for (const f of FURNITURE) {
    const n = Math.floor(Number(savedFurniture[f.id]));
    furniture[f.id] = !Number.isFinite(n) || n < 0 ? 0 : Math.min(getEffectiveFurnCap(f), n);
  }
  state.furniture = furniture;
  // Fired one-time milestone flags. Unknown ids are dropped; old saves
  // (and fresh states) simply haven't fired them yet.
  const savedMilestones = (data.milestones && typeof data.milestones === "object") ? data.milestones : {};
  const milestones = {};
  for (const m of MILESTONES) if (savedMilestones[m.id]) milestones[m.id] = true;
  state.milestones = milestones;
  // Skill XP/levels. Unknown ids dropped; counts clamp to 0..maxLevel and
  // XP stays a finite non-negative number.
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
  const amounts = {};
  for (const r of RESOURCES) {
    const n = Number(data.amounts[r.id]);
    if (!Number.isFinite(n) || n < 0) {
      amounts[r.id] = r.start ?? 0;
    } else {
      amounts[r.id] = Math.min(getEffectiveMax(r.id), n);
    }
  }
  state.amounts = amounts;
  const savedUnlocked = (data.unlocked && typeof data.unlocked === "object") ? data.unlocked : {};
  const unlocked = {};
  for (const a of ACTIONS) if (savedUnlocked["a:" + a.id]) unlocked["a:" + a.id] = true;
  for (const u of UPGRADES) if (savedUnlocked["u:" + u.id]) unlocked["u:" + u.id] = true;
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
  const savedSeen = (data.seen && typeof data.seen === "object") ? data.seen : null;
  const seen = {};
  if (savedSeen) {
    for (const r of RESOURCES) if (savedSeen[r.id]) seen[r.id] = true;
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
  }
  state.seen = seen;
  state.playerName = normalizePlayerName(data.playerName);
  const savedPlayerStats = (data.playerStats && typeof data.playerStats === "object") ? data.playerStats : {};
  const playerStats = {};
  for (const s of PLAYER_STATS) {
    const n = Math.floor(Number(savedPlayerStats[s.id]));
    playerStats[s.id] = Number.isFinite(n) ? n : (s.start ?? 1);
  }
  state.playerStats = playerStats;
  state.options = {
    showMaxedUpgrades: !!(data.options && data.options.showMaxedUpgrades),
    // The old single "logActions" toggle maps onto both halves.
    logActionBegin: !data.options || (data.options.logActionBegin ?? data.options.logActions) !== false,
    logActionStop: !data.options || (data.options.logActionStop ?? data.options.logActions) !== false,
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
    logImprovements: !data.options || data.options.logImprovements !== false,
    logLimit: normalizeLogLimit(data.options && data.options.logLimit),
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
  state.currentActionId = data.currentActionId && getAction(data.currentActionId) ? data.currentActionId : null;
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

async function encodeSaveText() {
  if (!window.CompressionStream) throw new Error("no compression");
  const raw = new TextEncoder().encode(JSON.stringify(serializeSave()));
  return SAVE_PREFIX + SAVE_VERSION + "$" + bytesToB64(await deflateBytes(raw)) + SAVE_SUFFIX;
}

async function decodeSaveText(text) {
  const t = (text || "").trim();
  if (t.startsWith(SAVE_PREFIX) && t.endsWith(SAVE_SUFFIX)) {
    if (!window.DecompressionStream) throw new Error("no decompression");
    const m = t.slice(SAVE_PREFIX.length, -SAVE_SUFFIX.length).match(/^(\d+)\$([A-Za-z0-9+/=]+)$/);
    if (!m) throw new Error("bad file");
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

