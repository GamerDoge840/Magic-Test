// Labor Game saves: file/clipboard import-export plus the browser Manual Save.
// Save files look like:
// { game: "labor-game", version: 4, savedAt: "2026-...", amounts: { stamina: 7, coin: 3 }, upgrades: { pockets: 1 }, unlocked: { "u:pockets": true }, options: { showMaxedUpgrades: false, logActions: true, logUpgrades: true, logUnlocks: true, logImprovements: true }, stats: { actions: { oddJobs: 12 } }, currentActionId: null, cycles: {} }
// Only ids listed in RESOURCES/ACTIONS/UPGRADES are loaded; missing ones use defaults.
// Exports use an opaque wrapper (like Antimatter Dimensions saves):
// LaborGameSavefileFormat4$<base64-zlib-json>EndOfSavefile
// Old plaintext JSON saves still import as-is.

const SAVE_GAME_ID = "labor-game";
const SAVE_VERSION = 4;
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
    upgrades: { ...state.upgrades },
    unlocked: { ...state.unlocked },
    options: { ...state.options },
    stats: { actions: { ...state.stats.actions } },
    currentActionId: state.currentActionId,
    cycles: Object.fromEntries(Object.entries(state.cycles).map(([k, v]) => [k, { progress: v.progress, paid: v.paid }])),
  };
}

function applySaveData(data) {
  if (!data || typeof data !== "object") throw new Error("bad file");
  if (data.game !== SAVE_GAME_ID) throw new Error("not a Labor Game save");
  if (data.version !== undefined && data.version > SAVE_VERSION) throw new Error("save is from a newer version");
  if (typeof data.amounts !== "object" || data.amounts === null) throw new Error("bad file");

  // Upgrades first: amounts clamp to the *effective* cap (base + effects).
  const upgrades = {};
  const savedUpgrades = (data.upgrades && typeof data.upgrades === "object") ? data.upgrades : {};
  for (const u of UPGRADES) {
    const n = Math.floor(Number(savedUpgrades[u.id]));
    upgrades[u.id] = !Number.isFinite(n) || n < 0 ? 0 : Math.min(u.maxPurchases ?? 1, n);
  }
  state.upgrades = upgrades;
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
  state.options = {
    showMaxedUpgrades: !!(data.options && data.options.showMaxedUpgrades),
    logActions: !data.options || data.options.logActions !== false,
    logUpgrades: !data.options || data.options.logUpgrades !== false,
    logUnlocks: !data.options || data.options.logUnlocks !== false,
    logImprovements: !data.options || data.options.logImprovements !== false,
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
          progress: Number.isFinite(p) && p > 0 ? Math.min(p, a.tickSeconds) : 0,
          paid: c.paid === true,
        };
      }
    }
  }
  state.cycles = cycles;
  state.currentActionId = data.currentActionId && getAction(data.currentActionId) ? data.currentActionId : null;
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

