// Labor Game world: tiles, travel, shopping gate, World tab UI.
// The World tab unlocks by performing Explore Outskirts once, and lets the
// player walk a tile map. Travel runs on its own clock (see worldTick,
// called from main.js): starting an action pauses a moving trip first,
// and heading out stops any running action, so actions never run
// mid-travel (see setAction/startWorldTravel/toggleWorldTravelPause).

let worldHover = null; // { x, y } moused-over/focused tile (runtime only)
let worldTileBtns = []; // [{ x, y, btn, _sig }] rebuilt by buildWorldMap
let worldTileInfoSig = null;

function worldTierDef(id) {
  const arr = (typeof WORLD_TIERS !== "undefined") ? WORLD_TIERS : [];
  if (id === undefined || id === null) return arr[0] ?? null;
  return arr.find(t => t.id === id) ?? null;
}

function worldBiomeDef(id) {
  const arr = (typeof WORLD_BIOMES !== "undefined") ? WORLD_BIOMES : [];
  if (id === undefined) return arr[0] ?? null;
  return arr.find(b => b.id === id) ?? null;
}

function worldModifierDef(id) {
  const arr = (typeof WORLD_MODIFIERS !== "undefined") ? WORLD_MODIFIERS : [];
  return arr.find(m => m.id === id) ?? null;
}

// World tab unlock: performing Explore Outskirts once (owning 1+).
function worldUnlocked() {
  return (state.upgrades && state.upgrades.exploreTown >= 1);
}

function worldMapSize(tierId) {
  const t = worldTierDef(tierId ?? (state.world && state.world.tier));
  return (t && Number.isInteger(t.size) && t.size > 0) ? t.size : 6;
}

// Tile caches (see bustWorldCaches): tile makeup is static per tier, and
// the player's tag set only changes on move/tier/site edits. All callers
// only read, so sharing is safe; guards rebuild on push/pop probe edits.
let __tileCache = { n: -1, map: new Map() };
let __playerTags = { key: '', tags: [] };
let __forageTable = { key: '', table: null };
function bustWorldCaches() {
  __tileCache = { n: -1, map: new Map() };
  __playerTags = { key: '', tags: [] };
  __forageTable = { key: '', table: null };
}

// One tile's makeup: its biome (tier default, overridable per tile by a
// WORLD_SITES entry) plus any modifier site on it.
function worldTileAt(x, y, tierId) {
  const tier = worldTierDef(tierId ?? (state.world && state.world.tier));
  const tierId2 = tier ? tier.id : null;
  const nSites = (typeof WORLD_SITES !== "undefined") ? WORLD_SITES.length : 0;
  if (__tileCache.n !== nSites) __tileCache = { n: nSites, map: new Map() };
  const key = (tierId2 ?? "?") + "|" + x + "," + y;
  let hit = __tileCache.map.get(key);
  if (hit === undefined) {
    let biome = (tier && tier.biome) ? worldBiomeDef(tier.biome) : worldBiomeDef();
    let modifier = null;
    if (typeof WORLD_SITES !== "undefined" && tier) {
      const site = WORLD_SITES.find(s => s.tier === tier.id && s.x === x && s.y === y);
      if (site) {
        if (site.modifier) modifier = worldModifierDef(site.modifier);
        if (site.biome) biome = worldBiomeDef(site.biome) || biome;
      }
    }
    hit = { x, y, tier: tierId2, biome, modifier };
    __tileCache.map.set(key, hit);
  }
  return hit;
}

function worldTileName(t) {
  if (t.modifier) return t.modifier.name + " (" + (t.biome ? t.biome.name : "?") + ")";
  return t.biome ? t.biome.name : "Unknown";
}

function worldTileTags(t) {
  return [...((t.biome && t.biome.tags) || []), ...((t.modifier && t.modifier.tags) || [])];
}

// Tags are matched case-insensitively, so config may write "Shopping" or
// "shopping" and tiles "General Store" or "general store" alike.
// Current-tile tag set, memoized: tileRequirementMet, worldTileHasTag and
// findForageTable all read the player's tile every tick, but its tags
// only change on move/tier/site edits (the guards below). Same content
// as worldTileTags(worldTileAt(...)), shared read-only.
function worldPlayerTileTags() {
  const key = (state.world ? state.world.x + "," + state.world.y + "|" + state.world.tier : "?")
    + "|" + ((typeof WORLD_SITES !== "undefined") ? WORLD_SITES.length : 0);
  if (__playerTags.key !== key) {
    __playerTags = { key, tags: (!state.world ? [] : worldTileTags(worldTileAt(state.world.x, state.world.y))) };
  }
  return __playerTags.tags;
}

function worldTileHasTag(tag) {
  if (!state.world) return false;
  const want = String(tag).toLowerCase();
  return worldPlayerTileTags().some(t => String(t).toLowerCase() === want);
}

function shoppingGated(item) {
  return getTags(item).some(t => String(t).toLowerCase() === "shopping");
}

// Current-tile forage table: first FORAGE_TABLES entry matching the tier
// plus the tile's biome id (or one of its tags, case-insensitive). Shared
// by the loot roll and the tooltip odds display, so both always agree.
// Memoized on the player tile + table count (see bustWorldCaches).
function findForageTable() {
  if (!state.world || typeof FORAGE_TABLES === "undefined") return null;
  const t = worldTileAt(state.world.x, state.world.y);
  const tags = worldPlayerTileTags();
  const tableKey = state.world.tier + "|" + (t.biome ? t.biome.id : "?") + "|" + tags.join(",") + "|" + FORAGE_TABLES.length;
  if (__forageTable.key !== tableKey) {
    const ltags = tags.map(s => String(s).toLowerCase());
    const tier = state.world.tier;
    const found = FORAGE_TABLES.find(e => e && e.tier === tier &&
      ((!e.biome && !e.tag) ||
        (e.biome && t.biome && e.biome === t.biome.id) ||
        (e.tag && ltags.includes(String(e.tag).toLowerCase())))) ?? null;
    __forageTable = { key: tableKey, table: found };
  }
  return __forageTable.table;
}

// Gathering loot: run the FORAGE_TABLES roll for a gather action (e.g.
// Forage) at the player's current tile and tier. First table matching the
// tier plus the tile's biome id (or one of its tags, case-insensitive)
// wins; tiles with no match yield nothing. Grants one unit of the rolled
// item (uncapped, marks it seen for the Inventory) and returns [{id, n}]
// for the session bulletin (possibly empty).
function grantGatherLoot(action) {
  if (!action) return [];
  const table = (typeof findForageTable === "function") ? findForageTable() : null;
  if (!table || !table.items) return [];
  let total = 0;
  for (const e of table.items) total += e.weight;
  if (!(total > 0)) return [];
  let r = Math.random() * total;
  let pick = table.items[table.items.length - 1].item;
  for (const e of table.items) {
    r -= e.weight;
    if (r < 0) { pick = e.item; break; }
  }
  state.amounts[pick] = (state.amounts[pick] ?? 0) + 1;
  if (!state.seen) state.seen = {};
  state.seen[pick] = true;
  return [{ id: pick, n: 1 }];
}

// Tile requirements, the modular gate for tile-locked purchases and runs.
// An item lists tags with `requiresTile` (string or array, ANY match
// satisfies, matched case-insensitively against the tile's tags):
//   requiresTile: "General Store"
//   requiresTile: ["General Store", "Market"]
// The legacy "shopping" tag still implies ["General Store"], so existing
// config keeps working. Before the World unlocks (no position yet) the
// player is implicitly in town, so every requirement counts as met.
// Memoized per item object (requiresTile/tags are static config): the
// dedupe + shopping-gate scan runs once, not on every gate check.
const __reqTagsCache = new WeakMap();
function tileRequirementTags(item) {
  if (!item || typeof item !== "object") return tileRequirementTagsFresh(item);
  let cached = __reqTagsCache.get(item);
  if (cached === undefined) {
    cached = tileRequirementTagsFresh(item);
    __reqTagsCache.set(item, cached);
  }
  return cached;
}
function tileRequirementTagsFresh(item) {
  const out = [];
  const push = (t) => {
    const s = String(t).trim();
    if (s && !out.some(x => x.toLowerCase() === s.toLowerCase())) out.push(s);
  };
  const rt = item ? item.requiresTile : undefined;
  if (typeof rt === "string") push(rt);
  else if (Array.isArray(rt)) for (const t of rt) push(t);
  if (shoppingGated(item) && !out.some(x => x.toLowerCase() === STORE_TAG.toLowerCase())) push(STORE_TAG);
  return out;
}

function tileRequirementMet(item) {
  const req = tileRequirementTags(item);
  if (!req.length) return true;
  if (!worldUnlocked() || !state.world) return true;
  const tags = worldPlayerTileTags();
  return req.some(r => tags.some(t => String(t).toLowerCase() === r.toLowerCase()));
}

// Tooltip + log wording for a requirement list: "General Store tile" or
// "General Store or Market tile" (ANY match satisfies).
function tileRequirementLabel(item) {
  const req = tileRequirementTags(item);
  return req.length > 1 ? req.join(" or ") + " tile" : req.join("") + " tile";
}

function tileBlockedMessage(item, verb) {
  const req = tileRequirementTags(item);
  const where = req.length > 1 ? req.join(" or ") : req.join("");
  return "You can only " + verb + " " + item.name + " at " + (req.length ? "a " + where + "." : "a tile.");
}

// Tile-modifier locks: a modifier can ban actions on its tile outright
// (Hamlet locks Forage and Explore Plains - walk to another tile to
// run them). Unlike requiresTile (ANY tag satisfies), a lock is
// per-action and absolute. Locks are positional, so every gate treats
// them exactly like an unmet tile requirement (unpaid starts and cycles
// stop, paid-cycle resume still finishes anywhere, red star, tooltip).
function worldTileLocks(x, y) {
  const t = worldTileAt(x, y);
  const locks = (t.modifier && t.modifier.locks) || [];
  return (Array.isArray(locks) ? locks : [locks]).filter(l => typeof l === "string" && l);
}

// True while the given action is banned at (x, y) - defaulting to the
// player's tile. Before the World unlocks (implicitly in town) nothing
// is locked, exactly like tile requirements.
function worldActionLocked(action, x, y) {
  const id = typeof action === "string" ? action : action && action.id;
  if (!id) return false;
  if (!worldUnlocked() || !state.world) return false;
  const px = (x === undefined || x === null) ? state.world.x : x;
  const py = (y === undefined || y === null) ? state.world.y : y;
  return worldTileLocks(px, py).some(l => l.toLowerCase() === String(id).toLowerCase());
}

function worldLockMessage(action) {
  const t = (worldUnlocked() && state.world) ? worldTileAt(state.world.x, state.world.y) : null;
  const where = (t && t.modifier) ? t.modifier.name : "this tile";
  return "You can't perform " + action.name + " at " + where + ".";
}

// Shopping rule: tile-gated items only run/buy on a matching tile (free
// while the World is still locked). Kept under its old name - upgrades,
// furniture, actions, and the World mirror all gate through here.
function worldShopBlocked(item) {
  if (typeof tileRequirementMet !== "function") return false;
  return !tileRequirementMet(item);
}

// Travel stat readers: biome base + modifier shift, minus every owned
// "travelTime" / "terrainDifficulty" effect (upgrades, homes, furniture,
// skill milestones with perLevel support). Floors keep trips meaningful.
function worldEffectReduction(type, biomeId) {
  let cut = 0;
  if (typeof activeItemEffects === "function") {
    for (const { effect: e, mult } of activeItemEffects()) {
      if (e.type === type && (e.biome === undefined || e.biome === biomeId)) cut += e.amount * mult;
    }
  }
  if (typeof attainedSkillMilestoneEffects === "function" && typeof skillLevel === "function") {
    for (const x of attainedSkillMilestoneEffects()) {
      const e = x.effect;
      if (e.type === type && (e.biome === undefined || e.biome === biomeId)) cut += e.amount * skillEffectLevels(x.source, e);
    }
  }
  return cut;
}

function getEffectiveTravelTime(x, y) {
  const t = worldTileAt(x, y);
  const base = (t.biome ? t.biome.travelTime : 5) + (t.modifier && t.modifier.travelTime ? t.modifier.travelTime : 0);
  // Floored at 0s (never below): a 0s tile teleports instantly (see
  // startWorldTravel) but still charges one second of its terrain drain.
  return Math.max(0, base - worldEffectReduction("travelTime", t.biome && t.biome.id));
}

function getEffectiveTerrainDifficulty(x, y) {
  const t = worldTileAt(x, y);
  const base = (t.biome ? t.biome.terrainDifficulty : 1) + (t.modifier && t.modifier.terrainDifficulty ? t.modifier.terrainDifficulty : 0);
  return Math.max(0, base - worldEffectReduction("terrainDifficulty", t.biome && t.biome.id));
}

function worldInBounds(x, y) {
  const size = worldMapSize();
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;
}

// Tile paint: the modifier's color wins over the biome's (e.g. brown
// Hamlet on green Plains), optionally covering only part of the tile:
// a modifier `size` below 1 paints its color as a centered inset that is
// size*100% of the tile's width/height, leaving the biome's color showing
// as a rim around it. Dark paint gets light text via a quick luminance
// check, so colored tiles stay readable with no per-tile text-color
// config. The text sits on the modifier color when one is present, so fg
// is computed from the modifier color even for partial coverage.
function worldTileColors(t) {
  const biomeBg = (t.biome && t.biome.color) || null;
  const modColor = (t.modifier && t.modifier.color) || null;
  const size = (t.modifier && typeof t.modifier.size === "number" && Number.isFinite(t.modifier.size) && t.modifier.size > 0 && t.modifier.size < 1)
    ? t.modifier.size : 1;
  const bg = modColor || biomeBg || null;
  if (!bg) return {};
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(bg).trim());
  if (!m) return { bg };
  let hex = m[1];
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const fg = lum < 0.5 ? FOG_TEXT_ON_DARK : FOG_TEXT_ON_LIGHT;
  // Partial coverage: the tile's base is the biome color with the
  // modifier color as a centered inset on top of it.
  if (modColor && size < 1) return { bg: biomeBg, fg, mod: modColor, size };
  return { bg, fg };
}

// Apply a worldTileColors paint to a tile button: full coverage is a
// flat background, partial coverage layers the modifier color over the
// biome color via a centered non-repeating gradient (no extra DOM).
function paintWorldTile(btn, t) {
  const paint = worldTileColors(t);
  if (paint.mod && paint.size < 1) {
    if (paint.bg) btn.style.background = paint.bg;
    else btn.style.background = "";
    btn.style.backgroundImage = "linear-gradient(" + paint.mod + ", " + paint.mod + ")";
    const pct = (paint.size * 100) + "%";
    btn.style.backgroundSize = pct + " " + pct;
    btn.style.backgroundRepeat = "no-repeat";
    btn.style.backgroundPosition = "center";
  } else {
    if (paint.bg) btn.style.background = paint.bg;
    else btn.style.background = "";
    btn.style.backgroundImage = "";
    btn.style.backgroundSize = "";
    btn.style.backgroundRepeat = "";
    btn.style.backgroundPosition = "";
  }
  if (paint.fg) btn.style.color = paint.fg;
  else btn.style.color = "";
}

// Vision: the full map renders, but only an 8x8 window of tiles around
// the player is lit - anything beyond it is invisible (disabled) until
// the player gets closer. The window slides with the player and clamps
// to the map edge, so small maps show fully lit.
const WORLD_VISION = 8;
function worldVisionOrigin() {
  const size = worldMapSize();
  if (!state.world || size <= WORLD_VISION) return { x: 0, y: 0 };
  // Player sits 4th in the window (offsets 3 behind, 4 ahead).
  const half = WORLD_VISION / 2 - 1;
  return {
    x: Math.min(Math.max(state.world.x - half, 0), size - WORLD_VISION),
    y: Math.min(Math.max(state.world.y - half, 0), size - WORLD_VISION),
  };
}
function worldTileVisible(x, y) {
  if (!state.world || !worldInBounds(x, y)) return false;
  const o = worldVisionOrigin();
  return x >= o.x && x < o.x + WORLD_VISION && y >= o.y && y < o.y + WORLD_VISION;
}

// Omnidirectional steps: any of the 8 neighbors counts as near.
function worldTileAdjacent(x, y) {
  if (!state.world) return false;
  const dx = Math.abs(x - state.world.x), dy = Math.abs(y - state.world.y);
  return dx <= 1 && dy <= 1 && (dx + dy) > 0;
}

// Sticky biome visits: every arrival records the tile's biome (forest
// visits unlock the Stone Axe). Checked by hasVisitedBiome for unlock
// gates; saved with the world so it survives reloads.
function markBiomeVisited(biomeId) {
  if (!biomeId || !state.world) return;
  if (!state.world.visitedBiomes || typeof state.world.visitedBiomes !== "object") state.world.visitedBiomes = {};
  state.world.visitedBiomes[biomeId] = true;
}

// Arrival footfall XP: biomes carrying `entryXp` (see WORLD_BIOMES) teach
// their skill a little on every arrival - walking the land itself is
// practice, on top of the Explore actions' per-cycle XP. Silent unless it
// levels the skill (gainSkillXp logs that); locked or maxed skills earn
// nothing, exactly like action XP. Called from both arrival paths (trip
// + teleport).
function grantTileEntryXp(x, y) {
  if (typeof worldInBounds === "function" && !worldInBounds(x, y)) return;
  const t = (typeof worldTileAt === "function") ? worldTileAt(x, y) : null;
  if (!t || !t.biome || !t.biome.id) return;
  markBiomeVisited(t.biome.id);
  const ex = t.biome.entryXp;
  if (ex && typeof gainSkillXp === "function") {
    // Milestone multipliers apply here too, so the footfall trickle
    // grows exactly like every other source of the same skill.
    const m = (typeof xpMultFor === "function") ? xpMultFor(ex.skill) : 1;
    gainSkillXp(ex.skill, ex.amount * m);
  }
}

// Click a tile to walk there: destination's travelTime is the trip length.
// Clicking the destination again while the trip is stopped resumes it;
// clicking another tile replaces the stopped trip. A moving trip must be
// stopped first (the Stop button below the map).
function startWorldTravel(tx, ty) {
  if (!worldUnlocked()) return;
  // Range first: a far click while stopped keeps the old trip with a
  // single "too far" line (not "heading somewhere new" plus "too far").
  if (!worldInBounds(tx, ty)) return;
  // Clicking the tile you're standing on: not "too far", just nowhere to go.
  if (state.world && tx === state.world.x && ty === state.world.y) {
    log("You are already on that tile.");
    return;
  }
  // A moving trip must be stopped first (the Stop button below the map):
  // any other click while it runs says so, before range or Stamina -
  // otherwise a far click reports "too far" and a 0-Stamina destination
  // click reports "too tired" for a trip that is already underway.
  if (state.world.travel && !state.world.travel.paused) {
    log("You are already traveling.");
    return;
  }
  // No traveling on empty: a NEW trip started at 0 Stamina would stall
  // on its first tick (worldTick waits for Rest), so refuse up front
  // instead. Resuming a paused trip is still allowed (same-destination
  // branch below) - it just waits for Stamina.
  if ((state.amounts.stamina ?? 0) <= 0 && !(state.world.travel && state.world.travel.paused && state.world.travel.tx === tx && state.world.travel.ty === ty)) {
    log("You're too tired to go anywhere without resting.", "full");
    return;
  }
  if (!worldTileAdjacent(tx, ty)) {
    log("That tile is too far away - stay close.");
    return;
  }
  if (state.world.travel) {
    // Unpaused trips returned above; only a stopped trip reaches here:
    // same destination resumes it, another tile replaces it.
    const tr = state.world.travel;
    if (tr.tx === tx && tr.ty === ty) {
      // Walking again ends any running action first (no actions run
      // while a trip is moving).
      if (state.currentActionId) setAction(null);
      tr.paused = false;
      lastTime = performance.now();
      render();
      return;
    }
    log("You head to a new tile instead.");
  }
  const total = getEffectiveTravelTime(tx, ty);
  // A 0s tile teleports: no trip, no bar - but the terrain still charges
  // one second of its drain (never below 0). Kept exact (no rounding):
  // the Vitals panel formats for display, so rounding here would only
  // undercharge.
  if (total <= 0) {
    const diff = getEffectiveTerrainDifficulty(tx, ty);
    if (diff > 0) state.amounts.stamina = Math.max(0, (state.amounts.stamina ?? 0) - diff);
    state.world.travel = null;
    state.world.x = tx;
    state.world.y = ty;
    grantTileEntryXp(tx, ty);
    lastTime = performance.now();
    render();
    return;
  }
  // Heading out ends any running action first (no actions run while a
  // trip is moving). Progress is kept, so nothing is lost.
  if (state.currentActionId) setAction(null);
  state.world.travel = { tx, ty, total, remaining: total, paused: false };
  lastTime = performance.now();
  render();
}

// Stopping mid-trip freezes the journey (progress kept): Rest can refill
// Stamina, or anything else can run, then the trip resumes from the Stop
// button or by clicking the destination tile again.
function toggleWorldTravelPause() {
  const w = state.world;
  if (!w || !w.travel) return;
  // Resuming the walk ends any running action first (no actions run
  // while a trip is moving); pausing mid-trip to act is always fine.
  if (w.travel.paused && state.currentActionId) setAction(null);
  w.travel.paused = !w.travel.paused;
  lastTime = performance.now();
  render();
}

// Per-frame travel: drains Stamina for the destination's terrain, then
// advances the trip. At 0 Stamina the trip stalls until Stamina returns
// (pause it and Rest, then resume). A manually stopped trip (paused)
// (pause it and act, then resume). A manually stopped trip (paused)
// waits the same way. No action runs while a trip is moving (see
// setAction/startWorldTravel/toggleWorldTravelPause).
// Arrival lands the player on the tile.
// Stamina drains exactly (no per-tick rounding): rounding to 2dp biased
// every 0.025-step down to 0.02, undercharging ~10% per trip. The Vitals
// panel formats for display, so float dust never shows.
function worldTick(dt) {
  const w = state.world;
  if (!w || !w.travel || w.travel.paused) return;
  if (!worldUnlocked()) {
    w.travel = null;
    return;
  }
  const { tx, ty } = w.travel;
  if (!worldInBounds(tx, ty)) {
    w.travel = null;
    return;
  }
  const cur = state.amounts.stamina ?? 0;
  if (cur <= 0) return;
  const drain = getEffectiveTerrainDifficulty(tx, ty);
  if (drain > 0) {
    state.amounts.stamina = Math.max(0, cur - drain * dt);
  }
  w.travel.remaining -= dt;
  if (w.travel.remaining <= 0) {
    w.x = tx;
    w.y = ty;
    w.travel = null;
    grantTileEntryXp(tx, ty);
  }
}

// World Action tip placement: the strip is too short to contain a tip, so
// the tip detaches via position:fixed (viewport pixels, like furniture
// tips) and opens upward over the Tile panel - it may intersect the Tile
// window, but never anything above it: room is measured up to the Tile
// panel's top edge. The node stays in place, so :hover show rules and the
// press-swallow guard keep working; closeTip clears the inline positioning.
function placeWorldTip(btn) {
  const tip = btn ? btn.querySelector(":scope > .tip") : null;
  if (!tip || !btn) return;
  let ceil = (typeof TIP_EDGE !== "undefined") ? TIP_EDGE : 8;
  const leftCol = document.getElementById("worldLeftCol");
  const tilePanel = leftCol ? leftCol.querySelector(":scope > .panel") : null;
  if (tilePanel) {
    const r = tilePanel.getBoundingClientRect();
    if (r.bottom > r.top) ceil = Math.max(ceil, Math.round(r.top) + ceil);
  }
  return fitDetachedTip(tip, btn, { prefer: "up", ceilTop: ceil, forceShow: true });
}

function clearWorldTip(tip) {
  return clearDetachedTip(tip);
}

// While a World Action tip is open, scrolling or resizing would strand its
// fixed pixels away from the anchor: re-place instead. Scroll events don't
// bubble, so the window listener uses capture.
if (typeof window !== "undefined" && !window.__worldTipTrack) {
  window.__worldTipTrack = true;
  const retrackWorldTip = () => {
    if (hoverTip && typeof hoverTip.key === "string" && hoverTip.key.startsWith("w:") && hoverTip.ref && hoverTip.ref.root && hoverTip.ref.root.isConnected) {
      const btn = hoverTip.ref.root;
      const tip = btn.querySelector(":scope > .tip");
      if (tip && btn && getComputedStyle(tip).display !== "none" && typeof placeWorldTip === "function") placeWorldTip(btn);
    }
  };
  window.addEventListener("scroll", retrackWorldTip, true);
  window.addEventListener("resize", retrackWorldTip);
}

// World Actions mirror: a second button driving a Work action (Rest), so
// Stamina can be recovered without leaving the tab. Same toggle behavior
// as the original; its own uiRefs key ("w:<id>") keeps both copies synced.
function buildWorldActionBtn(a) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "actionBtn";
  btn.id = "world-action-" + a.id;
  const label = document.createElement("span");
  label.className = "action-label";
  label.textContent = a.name;
  btn.appendChild(label);
  // Same tip tree as the Work button (shared builder, so both agree).
  const built = (typeof buildActionTipBody === "function") ? buildActionTipBody(a) : null;
  if (built) btn.appendChild(built.tip);
  const progress = document.createElement("div");
  progress.className = "action-progress";
  progress.setAttribute("aria-hidden", "true");
  const fill = document.createElement("div");
  fill.className = "action-fill";
  progress.appendChild(fill);
  const time = document.createElement("span");
  time.className = "action-time";
  progress.appendChild(time);
  btn.appendChild(progress);
  btn.addEventListener("click", () => {
    if (state.currentActionId === a.id) setAction(null);
    else setAction(a.id);
  });
  const refs = built ? built.refs : {};
  uiRefs.set("w:" + a.id, { root: btn, label, fill, prog: progress, time, ...refs });
  // Tooltips work exactly like the Work button's (same open/close path;
  // placeActionTip falls back to anchor-relative fitting outside the
  // Actions column).
  if (built && typeof openTip === "function") {
    const hi = (on) => hiResources(a, on);
    const effForTip = () => (typeof effectiveCosts === "function") ? effectiveCosts(a) : (a.costs ?? {});
    btn.addEventListener("mouseenter", () => openTip("w:" + a.id, btn, hi, effForTip()));
    btn.addEventListener("mouseleave", () => closeTip("w:" + a.id, hi));
    btn.addEventListener("focus", () => openTip("w:" + a.id, btn, hi, effForTip()));
    btn.addEventListener("blur", () => closeTip("w:" + a.id, hi));
  }
  return btn;
}

// Map: the whole tier renders at once; tiles past the vision window show
// invisible (disabled) until the player gets closer. Rebuilt by
// buildWorldTab and by renderWorld whenever the tier changes; the vision
// slides update in place every frame (no rebuild, so a focused tile never
// loses focus when the player moves).
let worldBuiltOrigin = null; // { tier }
let worldMapSig = null; // whole-grid paint signature (see renderWorld)
let worldFollow = { x: -1, y: -1, w: -1, h: -1 }; // last viewport-centering mark (see renderWorld)
function buildWorldMap() {
  const mapCtn = document.getElementById("worldMapCtn");
  if (!mapCtn) return;
  const tier = state.world ? state.world.tier : null;
  const size = worldMapSize();
  mapCtn.innerHTML = "";
  worldTileBtns = [];
  // Tiles stay full-size on every map: the panel scrolls (see #worldMapCtn).
  // Fixed square tracks (see --wt): auto rows size from content, which
  // ignores aspect-ratio - fixed tracks keep every tile truly square.
  mapCtn.style.gridTemplateColumns = "repeat(" + size + ", var(--wt))";
  mapCtn.style.gridAutoRows = "var(--wt)";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = worldTileAt(x, y);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "worldTile";
      paintWorldTile(b, t);
      b.addEventListener("click", () => startWorldTravel(x, y));
      b.addEventListener("mouseenter", () => { worldHover = { x, y }; renderWorldTileInfo(); });
      b.addEventListener("mouseleave", () => { if (worldHover && worldHover.x === x && worldHover.y === y) worldHover = null; renderWorldTileInfo(); });
      b.addEventListener("focus", () => { worldHover = { x, y }; renderWorldTileInfo(); });
      b.addEventListener("blur", () => { if (worldHover && worldHover.x === x && worldHover.y === y) worldHover = null; renderWorldTileInfo(); });
      mapCtn.appendChild(b);
      worldTileBtns.push({ x, y, btn: b, _sig: null });
    }
  }
  // The traveling player marker: an overlay sliding from the origin tile
  // to the destination as the trip progresses (positioned by renderWorld).
  const marker = document.createElement("div");
  marker.id = "worldPlayerMarker";
  marker.textContent = "O";
  marker.setAttribute("aria-hidden", "true");
  marker.hidden = true;
  mapCtn.appendChild(marker);
  worldBuiltOrigin = { tier };
  worldMapSig = null;
  worldFollow = { x: -1, y: -1, w: -1, h: -1 };
  worldHover = null;
}
function buildWorldTab() {
  const tierSel = document.getElementById("worldTierSelect");
  const mapCtn = document.getElementById("worldMapCtn");
  const infoCtn = document.getElementById("worldTileCtn");
  const actCtn = document.getElementById("worldActionsCtn");
  if (!tierSel || !mapCtn || !infoCtn || !actCtn) return;
  worldHover = null;
  worldTileInfoSig = null;
  const tiers = (typeof WORLD_TIERS !== "undefined") ? WORLD_TIERS : [];
  tierSel.innerHTML = "";
  for (const t of tiers) {
    const o = document.createElement("option");
    o.value = t.id;
    o.textContent = t.name;
    tierSel.appendChild(o);
  }
  if (!tierSel._worldWired) {
    tierSel._worldWired = true;
    tierSel.addEventListener("change", () => {
      const nt = worldTierDef(tierSel.value);
      if (!nt || !state.world || nt.id === state.world.tier) return;
      const w = state.world;
      // Each tier remembers where the player stood: stash the old tile,
      // then return to the new tier's last tile (or its start on a first
      // visit, clamped to the tier like the save loader). The trip never
      // survives a switch.
      if (!w.posByTier || typeof w.posByTier !== "object") w.posByTier = {};
      w.posByTier[w.tier] = { x: w.x, y: w.y };
      w.tier = nt.id;
      w.travel = null;
      const size = worldMapSize(nt.id);
      const st = w.posByTier[nt.id];
      const inTier = (v) => Number.isInteger(v) && v >= 0 && v < size;
      const sx = nt.start ? nt.start.x : Math.floor(size / 2), sy = nt.start ? nt.start.y : Math.floor(size / 2);
      const fx = (inTier(sx)) ? sx : Math.floor(size / 2), fy = (inTier(sy)) ? sy : Math.floor(size / 2);
      w.x = (st && inTier(Math.floor(Number(st.x)))) ? Math.floor(Number(st.x)) : fx;
      w.y = (st && inTier(Math.floor(Number(st.y)))) ? Math.floor(Number(st.y)) : fy;
      buildWorldTab();
      render();
    });
  }
  if (state.world) tierSel.value = state.world.tier;
  mapCtn.innerHTML = "";
  buildWorldMap();
  // Stop/Resume button for the trip below the map.
  const travelBtn = document.getElementById("worldTravelBtn");
  if (travelBtn && !travelBtn._worldWired) {
    travelBtn._worldWired = true;
    travelBtn.addEventListener("click", () => toggleWorldTravelPause());
  }
  actCtn.innerHTML = "";
  const acts = (typeof WORLD_ACTIONS !== "undefined") ? WORLD_ACTIONS : [];
  if (!acts.length) {
    const d = document.createElement("div");
    d.className = "emptyNote";
    d.textContent = "None yet.";
    actCtn.appendChild(d);
  }
  for (const id of acts) {
    const a = getAction(id);
    if (a) actCtn.appendChild(buildWorldActionBtn(a));
  }
  renderWorld();
}

function renderWorldTileInfo() {
  const infoCtn = document.getElementById("worldTileCtn");
  if (!infoCtn || !state.world) return;
  let hx = state.world.x, hy = state.world.y;
  if (worldHover && worldInBounds(worldHover.x, worldHover.y)) {
    hx = worldHover.x;
    hy = worldHover.y;
  }
  const t = worldTileAt(hx, hy);
  const sig = hx + "," + hy + "," + worldEffectReduction("travelTime", t.biome && t.biome.id) + "," + worldEffectReduction("terrainDifficulty", t.biome && t.biome.id);
  if (worldTileInfoSig === sig) return;
  worldTileInfoSig = sig;
  infoCtn.innerHTML = "";
  const head = document.createElement("div");
  head.className = "worldTileHead";
  head.textContent = worldTileName(t);
  infoCtn.appendChild(head);
  const coords = document.createElement("div");
  coords.className = "worldTileCoords";
  coords.textContent = "Tile (" + hx + ", " + hy + ")";
  infoCtn.appendChild(coords);
  const tags = worldTileTags(t);
  if (tags.length) {
    const row = document.createElement("div");
    row.className = "tip-tags";
    for (const tag of tags) {
      const chip = document.createElement("span");
      chip.className = "tip-tag";
      chip.textContent = tag;
      row.appendChild(chip);
    }
    infoCtn.appendChild(row);
  }
  const stats = document.createElement("div");
  stats.className = "worldTileStats";
  const tt = document.createElement("div");
  tt.textContent = "Travel time: " + formatNum(getEffectiveTravelTime(hx, hy)) + "s";
  const td = document.createElement("div");
  td.textContent = "Terrain drain: " + formatNum(getEffectiveTerrainDifficulty(hx, hy)) + " Stamina/s";
  stats.appendChild(tt);
  stats.appendChild(td);
  infoCtn.appendChild(stats);
  // Modifier bans on the displayed tile (e.g. Hamlet locking Forage
  // and Explore Plains): names the locked groups so the tile itself says
  // why they won't run here. Individual action names would flood the
  // window, so bans collapse to their action groups ("Locked: Gathering,
  // Exploration"). Lock ids are static config validated against ACTIONS,
  // so hx,hy in the sig already covers tile changes.
  const lockIds = worldTileLocks(hx, hy);
  if (lockIds.length) {
    const groups = [];
    for (const id of lockIds) {
      const a = (typeof getAction === "function") ? getAction(id) : null;
      const label = (a && a.group) ? a.group : (a ? a.name : id);
      if (!groups.includes(label)) groups.push(label);
    }
    const locks = document.createElement("div");
    locks.className = "worldTileLocks";
    locks.textContent = "Locked: " + groups.join(", ");
    infoCtn.appendChild(locks);
  }
  const desc = (t.modifier && t.modifier.description) || (t.biome && t.biome.description);
  if (desc) {
    const d = document.createElement("div");
    d.className = "worldTileDesc";
    d.textContent = desc;
    infoCtn.appendChild(d);
  }
}

function renderWorld() {
  const open = worldUnlocked();
  if (typeof tabWorldBtn !== "undefined" && tabWorldBtn) tabWorldBtn.hidden = !open;
  if (!open) {
    if (typeof tabWorld !== "undefined" && tabWorld && !tabWorld.hidden) showTab("work");
    return;
  }
  const tierSel = document.getElementById("worldTierSelect");
  if (tierSel && state.world && tierSel.value !== state.world.tier) tierSel.value = state.world.tier;
  // The vision slides with the player: rebuild the map grid only when
  // its tier changes - lit/invisible tiles update in place below. The
  // whole tile loop is skipped while the vision sits still (same origin,
  // player, destination and sites): every per-tile input is covered by
  // the signature, so huge worlds cost ~0 per tick while idle. The
  // marker and travel bar below still update every frame.
  const vtier = state.world ? state.world.tier : null;
  if (!worldBuiltOrigin || worldBuiltOrigin.tier !== vtier) buildWorldMap();
  const traveling = !!(state.world && state.world.travel);
  const vo = worldVisionOrigin();
  // Viewport centering happens after the marker block below (it reuses the
  // same tile-center reads): the map box scrolls so the player sits dead
  // center, clamped by the browser at the land edges.
  const mapSig = vtier + "|" + vo.x + "," + vo.y + "|" + state.world.x + "," + state.world.y + "|" + (traveling ? state.world.travel.tx + "," + state.world.travel.ty : "-") + "|" + ((typeof WORLD_SITES !== "undefined") ? WORLD_SITES.length : 0);
  if (mapSig !== worldMapSig) {
    worldMapSig = mapSig;
    for (const e of worldTileBtns) {
      if (!e.btn.isConnected) continue;
      // The player marker badge ("O") is always visible (sliding mid-trip,
      // parked on the player tile when idle), so tiles never print their
      // own "O" - only the modifier short (e.g. "ST").
      const isPlayer = !traveling && state.world && e.x === state.world.x && e.y === state.world.y;
      const isTarget = traveling && e.x === state.world.travel.tx && e.y === state.world.travel.ty;
      const adj = !traveling && worldTileAdjacent(e.x, e.y);
      const vis = worldTileVisible(e.x, e.y);
      const t = worldTileAt(e.x, e.y);
      const short = (t.modifier && t.modifier.short) ? t.modifier.short : "";
      const text = short;
      const sig = (isPlayer ? 1 : 0) + "|" + (isTarget ? 1 : 0) + "|" + (adj ? 1 : 0) + "|" + (vis ? 1 : 0) + "|" + text;
      if (e._sig === sig) continue;
      e._sig = sig;
      if (vis) {
        paintWorldTile(e.btn, t);
        e.btn.textContent = text;
        e.btn.style.visibility = "";
        e.btn.disabled = false;
        e.btn.setAttribute("aria-label", worldTileName(t) + " (" + e.x + ", " + e.y + ")" + (isPlayer ? ", you are here" : ""));
      } else {
        // Far tiles are completely invisible (not even a "?" box): the
        // slot stays so the land keeps its shape, but nothing shows and
        // the tile is unclickable and out of the tab order until the
        // player gets closer. Adjacent tiles are always lit (the window
        // holds the player), so this never gates legal travel - only the
        // "too far" kind.
        e.btn.style.visibility = "hidden";
        e.btn.textContent = "";
        e.btn.disabled = true;
        e.btn.setAttribute("aria-label", "Unknown tile (" + e.x + ", " + e.y + ")");
      }
      e.btn.classList.toggle("is-player", !!isPlayer);
      e.btn.classList.toggle("is-target", !!isTarget);
      e.btn.classList.toggle("is-adj", !!adj);
    }
  }
  const wrap = document.getElementById("worldTravelWrap");
  if (wrap) {
    wrap.hidden = !traveling;
    if (traveling) {
      const tr = state.world.travel;
      const fill = document.getElementById("worldTravelFill");
      const time = document.getElementById("worldTravelTime");
      if (fill) fill.style.width = Math.min(100, Math.max(0, (1 - tr.remaining / tr.total) * 100)) + "%";
      if (time) time.textContent = tr.paused ? "Paused" : formatDuration(Math.max(0, tr.remaining), (s) => s.toFixed(1) + "s");
      const tbtn = document.getElementById("worldTravelBtn");
      if (tbtn && tbtn.textContent !== (tr.paused ? "Resume" : "Stop")) tbtn.textContent = tr.paused ? "Resume" : "Stop";
    }
  }
  // Player marker: the bordered "O" badge. It slides from the origin tile
  // toward the destination as the trip progresses, so speed visibly follows
  // the terrain's travel time (slow ground = slow marker); frozen while the
  // trip is stopped. When idle it parks on the player tile, so the marker
  // is always visible. Positions write only when changed (the offset reads
  // force layout, so don't pay for them every tick while parked).
  const marker = document.getElementById("worldPlayerMarker");
  if (marker) {
    const oBtn = (state.world ? (worldTileBtns.find(e => e.x === state.world.x && e.y === state.world.y) || {}).btn : null);
    const dBtn = traveling ? (worldTileBtns.find(e => e.x === state.world.travel.tx && e.y === state.world.travel.ty) || {}).btn : null;
    let mHide = true, mLeft = "", mTop = "", mcx = 0, mcy = 0;
    if (oBtn && oBtn.isConnected && (!traveling || (dBtn && dBtn.isConnected))) {
      mHide = false;
      if (!traveling) {
        mcx = oBtn.offsetLeft + oBtn.offsetWidth / 2;
        mcy = oBtn.offsetTop + oBtn.offsetHeight / 2;
        mLeft = mcx + "px";
        mTop = mcy + "px";
      } else {
        const tr = state.world.travel;
        const frac = Math.min(1, Math.max(0, 1 - tr.remaining / tr.total));
        const ox = oBtn.offsetLeft + oBtn.offsetWidth / 2, oy = oBtn.offsetTop + oBtn.offsetHeight / 2;
        const dx = dBtn.offsetLeft + dBtn.offsetWidth / 2, dy = dBtn.offsetTop + dBtn.offsetHeight / 2;
        mcx = ox + (dx - ox) * frac;
        mcy = oy + (dy - oy) * frac;
        mLeft = mcx + "px";
        mTop = mcy + "px";
      }
    }
    const mSig = (mHide ? 1 : 0) + "|" + mLeft + "|" + mTop;
    if (marker._posSig !== mSig) {
      marker._posSig = mSig;
      marker.hidden = mHide;
      if (!mHide) { marker.style.left = mLeft; marker.style.top = mTop; }
    }
    // The World window is always centered around the player: the map box
    // scrolls so the marker's center sits in the middle of the visible
    // box - parked on the player tile when idle, following the sliding
    // marker mid-trip. The browser clamps at the land edges, and small
    // maps that fit need no scroll (safe-center CSS keeps them centered).
    // Gated on origin + player + box size + trip progress, so parked
    // frames cost only compares; skipped while the tab is hidden
    // (zero-size tiles) with a retry on a later tick.
    const mapBox = document.getElementById("worldMapCtn");
    if (!mHide && mapBox && oBtn.offsetWidth > 0) {
      const mw = mapBox.clientWidth, mh = mapBox.clientHeight;
      if (mw > 0 && mh > 0) {
        const cFrac = traveling ? Math.min(1, Math.max(0, 1 - state.world.travel.remaining / state.world.travel.total)) : -1;
        const cSig = vo.x + "," + vo.y + "|" + state.world.x + "," + state.world.y + "|" + mw + "x" + mh + "|" + (traveling ? cFrac.toFixed(3) : "i");
        if (cSig !== worldFollow._sig) {
          worldFollow = { x: vo.x, y: vo.y, w: mw, h: mh, _sig: cSig };
          const wantL = mcx - mw / 2, wantT = mcy - mh / 2;
          if (Math.abs(mapBox.scrollLeft - wantL) >= 1) mapBox.scrollLeft = wantL;
          if (Math.abs(mapBox.scrollTop - wantT) >= 1) mapBox.scrollTop = wantT;
        }
      }
    }
  }
  // A hovered tile that slid out of vision stops describing itself.
  if (worldHover && !worldTileVisible(worldHover.x, worldHover.y)) worldHover = null;
  renderWorldTileInfo();
  // World Actions mirrors stay in lockstep with their Work originals.
  const acts = (typeof WORLD_ACTIONS !== "undefined") ? WORLD_ACTIONS : [];
  for (const id of acts) {
    const a = getAction(id);
    const ref = uiRefs.get("w:" + id);
    if (!a || !ref) continue;
    const isActive = state.currentActionId === a.id;
    const cyc = state.cycles[a.id];
    const paidResume = !isActive && !!cyc && cyc.paid === true;
    const effCost = (typeof effectiveCosts === "function") ? effectiveCosts(a) : { ...(a.costs ?? {}) };
    const vitalsFull = gainsAreFull(effectiveGains(a));
    // Tile-modifier locks (e.g. Hamlet banning Forage) hide the mirror
    // outright; unmet tile requirements hide it only for hideWhenOffTile
    // actions (Work-tab parity - other actions show disabled with a red
    // star). Locked (un-unlocked) and user-hidden actions hide exactly
    // like their Work buttons. A running action stays visible until the
    // next tick stops it.
    const shopBlock = worldShopBlocked(a);
    const lockBlock = ((typeof worldActionLocked === "function") && worldActionLocked(a));
    const unlockOK = (typeof unlockMet === "function") ? unlockMet(a, "a") : true;
    const hideHidden = !(typeof hidingMode !== "undefined" && hidingMode.actions) && (typeof itemHidden === "function") && itemHidden("a:" + a.id);
    const blocked = shopBlock || lockBlock;
    // Paid-cycle resume stays visible on its tile (same rule as the Work
    // button): a stopped-but-paid mirror can finish anywhere instead of
    // stranding progress behind a hidden button - except hideWhenOffTile
    // actions (Explores, Chop Trees), which stay hidden off-tile while
    // paid. Unlocks and user-hiding still hide (re-unlock/unhide first).
    const tilePaidOk = paidResume && !a.hideWhenOffTile;
    const mirrorHide = (!unlockOK || hideHidden || (lockBlock && !tilePaidOk) || (!!a.hideWhenOffTile && shopBlock && !tilePaidOk)) && !isActive;
    // Blocked (locked/off-tile) still disables a fresh start, but a paid
    // resume stays clickable (Work-tab parity) - except hideWhenOffTile
    // actions, which stay disabled off-tile while paid.
    const disabled = isActive ? false : ((!canAfford(effCost) && !paidResume) || vitalsFull || (blocked && !tilePaidOk));
    const overMax = (typeof costExceedsMax === "function") ? costExceedsMax(effCost) : false;
    const prog = cyc ? cyc.progress : 0;
    const tick = getEffectiveTick(a);
    const pkey = isActive ? prog.toFixed(3) : "";
    // Tip-live bits mirror the Work button's sig, so the mirror tooltip
    // (counts, payouts, XP unlocks, requirement visibility) refreshes too.
    const xpSig = (typeof skillUnlocked === "function" && ref.xpRows) ? ref.xpRows.map(x => skillUnlocked(x.sid) ? "1" : "0").join(",") : "";
    const costSig = Object.keys(effCost).sort().map(id => id + ":" + effCost[id]).join(",");
    const impCap = a.improvements ? ((typeof getEffectiveImpMax === "function") ? getEffectiveImpMax(a) : a.improvements.maxLevel) : "";
    const count = state.stats.actions[a.id] ?? 0;
    const gatherSig = (typeof gatherTipSig === "function") ? gatherTipSig(a) : "";
    const sig = (isActive ? 1 : 0) + "|" + (disabled ? 1 : 0) + "|" + pkey + "|" + (blocked ? 1 : 0) + "|" + (mirrorHide ? 1 : 0) + "|" + (overMax ? 1 : 0) + "|" + count + "|" + impCap + "|" + xpSig + "|" + costSig + "|" + gatherSig + "|" + tick.toFixed(3);
    if (ref._sig === sig) continue;
    ref._sig = sig;
    ref.root.classList.toggle("active", isActive);
    // Hides exactly like its Work button (locks, hideWhenOffTile,
    // unlocks, hiding); a running one stays visible until the next tick
    // stops it.
    ref.root.hidden = mirrorHide && !isActive;
    if (ref.label) {
      // Same red "Name*" as the Work button: over-cap price or unmet
      // tile requirement (off-tile) - or banned by this tile's modifier.
      const reqStar = overMax || blocked;
      if (ref.label.textContent !== a.name + (reqStar ? "*" : "")) ref.label.textContent = a.name + (reqStar ? "*" : "");
      if ((ref.label.style.color || "") !== (reqStar ? "red" : "")) ref.label.style.color = reqStar ? "red" : "";
    }
    ref.root.setAttribute("aria-pressed", isActive ? "true" : "false");
    ref.root.disabled = disabled;
    // Very fast cycles (4+ fills/sec) flow instead of filling (see .flowing).
    const wFlowing = isActive && tick <= FAST_BAR_TICK_SECONDS;
    if (ref.prog) ref.prog.classList.toggle("flowing", wFlowing);
    if (ref.fill) ref.fill.style.width = !isActive ? "0%" : (wFlowing ? "100%" : Math.min(100, (prog / tick) * 100) + "%");
    if (ref.prog) ref.prog.hidden = !isActive;
    if (ref.time) ref.time.textContent = isActive ? formatDuration(tick - prog, (s) => s.toFixed(2) + "s") : "";
    if (typeof renderActionTipLive === "function") renderActionTipLive(a, ref);
  }
}
