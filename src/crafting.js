// Labor Game crafting: timed background plans (Cooking/Roasting first).
// Load ingredients into a plan's Item Slots (plus fuel into its Fuel
// Slot) and the plan works on its own clock (no Stamina cost, keeps
// running while you do other things). One craft at a time per plan;
// finished outputs land in the Inventory with Cooking XP. Finishing a
// recipe at least once discovers it (listed under Discovered Recipes).
// Crafting numbers show one less decimal than the shared formatNum (two
// decimals max instead of three - "1.25", "4.95s" - so the tab's fuel,
// countdown, and count displays stay compact. Same trimming otherwise:
// integers show bare, finite fractions round and drop trailing noise.
function formatCraftNum(n) {
  if (n === Infinity) return "∞";
  if (n === -Infinity) return "-∞";
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

// Fixed-width numbers for per-tick displays (countdown, fuel left): two
// decimals always, so the text never changes length mid-burn and the
// centered lines stop jittering (tabular-nums alone can't fix "4.5s" vs
// "4.66s" - the extra digit re-centers the line).
function formatCraftFixed(n) {
  return Math.max(0, n).toFixed(2);
}

function craftGroups() {
  return (typeof CRAFTING !== "undefined") ? CRAFTING : [];
}

function getCraftGroup(id) {
  return craftGroups().find(g => g.id === id);
}

function getCraftPlan(pid) {
  for (const g of craftGroups()) {
    const p = (g.plans ?? []).find(p => p.id === pid);
    if (p) return p;
  }
  return undefined;
}

function craftGroupOfPlan(pid) {
  for (const g of craftGroups()) {
    if ((g.plans ?? []).some(p => p.id === pid)) return g;
  }
  return undefined;
}

// Selection with fallbacks (survives config edits and old saves).
function selCraftGroup() {
  const groups = craftGroups();
  if (!groups.length) return undefined;
  const id = state.crafting && state.crafting.sel && state.crafting.sel.group;
  return groups.find(g => g.id === id) ?? groups[0];
}

function selCraftPlan() {
  const g = selCraftGroup();
  if (!g) return undefined;
  const plans = g.plans ?? [];
  if (!plans.length) return undefined;
  const id = state.crafting && state.crafting.sel && state.crafting.sel.plan;
  const pick = plans.find(p => p.id === id) ?? plans[0];
  return pick;
}

function planState(pid) {
  return state.crafting && state.crafting.plans ? state.crafting.plans[pid] : undefined;
}

// Event-unlock gate (see plan `unlock` in config/craftingConfig.js):
// every seen id must be discovered plus every skill gate met (AND).
function planUnlockMet(p) {
  const u = p ? p.unlock : null;
  if (!u || typeof u !== "object") return false;
  const seen = u.seen === undefined ? [] : (Array.isArray(u.seen) ? u.seen : [u.seen]);
  for (const id of seen) if (typeof id !== "string" || !(state.seen && state.seen[id])) return false;
  const need = {};
  if (typeof u.skill === "string" && u.skill) need[u.skill] = Math.max(need[u.skill] ?? 0, u.skillLevel ?? 1);
  if (u.skills && typeof u.skills === "object") for (const [sid, sl] of Object.entries(u.skills)) need[sid] = Math.max(need[sid] ?? 0, sl);
  if (typeof skillLevel === "function") for (const [sid, sl] of Object.entries(need)) if (skillLevel(sid) < sl) return false;
  return true;
}

// Hide-mode keys: plans hide whole ("p:<planId>"), recipes hide per plan
// ("c:<planId>:<recipeId>"). Display-only like every other hiding kind:
// hidden plans keep ticking and hidden recipes still match - only the
// buttons are skipped (struck-through while their mode is armed).
function craftPlanHideKey(pid) {
  return "p:" + pid;
}
function craftRecipeHideKey(pid, rid) {
  return "c:" + pid + ":" + rid;
}

// Group-switch default: first unlocked, unhidden plan (a hidden plan stays
// selectable but doesn't grab focus); falls back to the first plan so a
// fully-hidden rail still leaves a workbench target.
function firstVisibleCraftPlan(g) {
  const plans = g.plans ?? [];
  const vis = plans.find(pl => { const st = planState(pl.id); return st && st.unlocked && !itemHidden(craftPlanHideKey(pl.id)); });
  return ((vis ?? plans[0]) ? (vis ?? plans[0]).id : null);
}

// Per-group plan memory: switching sub-tabs returns to the plan you were
// on instead of the first plan. Recorded on every plan selection
// (rememberCraftPlan); a remembered plan that is locked, gone, or hidden
// falls back to firstVisibleCraftPlan like a fresh selection.
function rememberedCraftPlan(g) {
  const mem = state.crafting && state.crafting.selPlans;
  const id = (mem && typeof mem === "object") ? mem[g.id] : null;
  if (!id) return null;
  if (!(g.plans ?? []).some(p => p.id === id)) return null;
  const st = planState(id);
  if (!(st && st.unlocked)) return null;
  if (typeof itemHidden === "function" && itemHidden(craftPlanHideKey(id))) return null;
  return id;
}
function rememberCraftPlan(g, pid) {
  if (!state.crafting || !g || !pid) return;
  if (!state.crafting.selPlans || typeof state.crafting.selPlans !== "object") state.crafting.selPlans = {};
  state.crafting.selPlans[g.id] = pid;
}

function craftingUnlocked() {
  return !!(state.unlocked && state.unlocked["tab:crafting"]);
}

// Per-group crafting access: a group is "open" once any of its plans is
// unlocked (or its skill reaches Level 1). Drives the sub-tab rail
// (unopened groups hide until their station is bought), the Player-tab
// speed stats (each stat shows only for its own open group), and the
// legacy cookingUnlocked gate (any group open).
function craftGroupOpen(gid) {
  const g = (typeof getCraftGroup === "function") ? getCraftGroup(gid) : undefined;
  if (!g) return false;
  for (const p of g.plans ?? []) {
    const st = planState(p.id);
    if (st && st.unlocked) return true;
  }
  if (g.skill && typeof skillLevel === "function" && skillLevel(g.skill) >= 1) return true;
  return false;
}

// A sub-tab shows once its station is owned (its starter plans then
// unlock) or any of its plans is already unlocked (e.g. a sold station's
// progress keeps the tab). Skill levels alone never open the rail - XP
// needs a station to earn, so a skill without plans is forged weight.
function craftGroupVisible(g) {
  if (!g) return false;
  if (typeof ownsCraftingStation === "function" && ownsCraftingStation(g)) return true;
  return (g.plans ?? []).some(p => { const st = (typeof planState === "function") ? planState(p.id) : null; return !!(st && st.unlocked); });
}

// One speed stat's visibility: the group that reads it must be open.
// Stats no group reads (legacy/manual) stay visible under the header.
function craftStatOpen(statId) {
  const g = craftGroups().find(x => x.speedStat === statId);
  if (!g) return true;
  return craftGroupOpen(g.id);
}

// Cooking is "unlocked" once any crafting group opens: gates the Crafting
// Stats section of the Player tab. Kept under its old name
// (cookingUnlocked) so the Player tab keeps working; now generic across
// groups so Woodworking alone opens it.
function cookingUnlocked() {
  for (const g of craftGroups()) if (craftGroupOpen(g.id)) return true;
  return false;
}

// A station is live ownership (selling every station pauses its plans).
function ownsCraftingStation(group) {
  if (!group) return false;
  return FURNITURE.some(f => getTags(f).includes(group.stationTag) && (state.furniture[f.id] ?? 0) > 0);
}

// Effective seconds per craft: base time minus 0.01s per Speed-stat
// point, floored so huge stats can't zero or invert the timer.
function craftEffTime(plan, group) {
  const sp = (group && group.speedStat && typeof getEffectiveStat === "function") ? Math.max(0, getEffectiveStat(group.speedStat)) : 0;
  return Math.max(0.5, (plan.time ?? 5) - 0.01 * sp);
}

// One recipe's own base seconds: its `time` override, else the plan time.
function recipeBaseTime(recipe, plan) {
  const t = (recipe && recipe.time !== undefined) ? recipe.time : (plan ? plan.time : undefined);
  return (typeof t === "number" && Number.isFinite(t) && t > 0) ? t : 5;
}

// Effective seconds per craft for one recipe: its own base (plan time
// unless overridden) minus 0.01s per Speed-stat point, floored.
function recipeEffTime(recipe, plan, group) {
  const sp = (group && group.speedStat && typeof getEffectiveStat === "function") ? Math.max(0, getEffectiveStat(group.speedStat)) : 0;
  return Math.max(0.5, recipeBaseTime(recipe, plan) - 0.01 * sp);
}

// Fuel-id list, cached: craftMatIdList runs every tick for the materials
// sig, and the fuel test scans all of ITEMS. Fuel flags are static
// config; the length guard rebuilds on push/pop probe edits (in-place
// fuel edits need bustCraftCaches(), like the other static caches).
let __fuelIds = { n: -1, ids: [] };
function bustCraftCaches() {
  __fuelIds = { n: -1, ids: [] };
}
function fuelItemIds() {
  if (typeof ITEMS === "undefined") return [];
  if (__fuelIds.n !== ITEMS.length) {
    const ids = [];
    for (const it of ITEMS) {
      const v = it && it.fuel;
      if (typeof v === "number" && Number.isFinite(v) && v > 0
        && getTags(it).some(t => String(t).toLowerCase() === "fuel")
        && !ids.includes(it.id)) ids.push(it.id);
    }
    __fuelIds = { n: ITEMS.length, ids };
  }
  return __fuelIds.ids;
}
function fuelValueOf(id) {
  const it = (typeof getItem === "function") ? getItem(id) : undefined;
  const v = it && it.fuel;
  return (typeof v === "number" && Number.isFinite(v) && v > 0) ? v : 0;
}

function isFuelItem(id) {
  if (!(fuelValueOf(id) > 0)) return false;
  const it = getItem(id);
  return getTags(it).some(t => String(t).toLowerCase() === "fuel");
}

function planAcceptsItem(plan, id) {
  return (plan.recipes ?? []).some(r => r.inputs && Object.keys(r.inputs).some(k => (typeof recipeInputMatches === "function") ? recipeInputMatches(k, id) : k === id));
}

// While a material button is being dragged, slots it can land in glow
// green (dragOver). HTML5 hides the payload during dragover, so the
// dragged id rides on craftDragId (set by the materials buttons).
let craftDragId = null;

// Whether dropping `id` into `dest` ("fuel" or an item-slot index) of
// the plan would actually load it (right kind AND a free or matching
// slot) - so Twigs aimed at an Item Slot never glow, only the Fuel Slot.
function craftSlotWillTake(planId, dest, id) {
  const p = getCraftPlan(planId);
  const st = planState(planId);
  if (!p || !st || !id) return false;
  if (dest === "fuel") {
    if (!planNeedsFuel(p) || !isFuelItem(id)) return false;
    return !st.fuel || st.fuel.id === id;
  }
  if (typeof dest !== "number") return false;
  if (dest < 0 || dest >= planItemSlots(p)) return false;
  if (!planAcceptsItem(p, id)) return false;
  const cur = (st.items ?? [])[dest];
  return !cur || cur.id === id;
}

// Highlight every slot a dragged material can land in (green border until
// it is inserted): called once on dragstart so compatible Item + Fuel
// slots glow together for recipe discovery - including multi-unit same-item
// recipes (a slot holding the same item still takes more, so it glows).
function craftClearSlotGlow() {
  document.querySelectorAll(".craftSlot.dragOver").forEach(s => s.classList.remove("dragOver"));
}
function craftHighlightCompatible(planId, id) {
  if (!craftUI || !craftUI.itemSlots) return;
  craftClearSlotGlow();
  if (!planId || !id) return;
  craftUI.itemSlots.forEach((s, i) => {
    if (craftSlotWillTake(planId, i, id)) s.slot.classList.add("dragOver");
  });
  if (craftUI.fuelSlot && craftSlotWillTake(planId, "fuel", id)) craftUI.fuelSlot.classList.add("dragOver");
}

// A plan runs one Item Slot per recipe input (the most-input recipe
// sets the count, raised by an explicit `slots` plan field) plus a Fuel
// Slot - unless fuelPerSec is 0, in which case it runs on ingredients
// alone with no fuel UI at all.
function planItemSlots(p) {
  let n = 1;
  for (const r of p.recipes ?? []) n = Math.max(n, Object.keys(r.inputs ?? {}).length);
  // Fixed slot counts only ever raise the derived count, so every input
  // always has a slot (Make Salad's 3 slots fit its 2-input recipes).
  if (Number.isInteger(p.slots) && p.slots > n) n = p.slots;
  return n;
}

function planNeedsFuel(p) {
  return (p.fuelPerSec ?? 0) > 0;
}

// The plan's ensured item-slot array (grows/shrinks with the config and
// migrates the old single `item` field), so edits never strand it.
function craftItemSlots(st, p) {
  const n = planItemSlots(p);
  if (!Array.isArray(st.items)) {
    st.items = [st.item ?? null];
    delete st.item;
  }
  while (st.items.length < n) st.items.push(null);
  if (st.items.length > n) st.items.length = n;
  return st.items;
}

// Slot indexes covering every input of a recipe with enough units (one
// slot per input, never shared), or null when it can't run right now.
// A "tag:" input matches any slot holding a tagged item (one slot per
// input still - the same slot can never cover two inputs). Input-less
// recipes never match (config validation strips them, but the engine
// refuses them too - otherwise they would free-run).
function slotsForRecipe(recipe, items) {
  const ids = Object.keys(recipe.inputs ?? {});
  if (!ids.length) return null;
  const used = new Set();
  const map = [];
  for (const id of ids) {
    const need = recipe.inputs[id] ?? 1;
    const match = (typeof recipeInputMatches === "function")
      ? (s) => recipeInputMatches(id, s.id)
      : (s) => s.id === id;
    const i = items.findIndex((s, idx) => !used.has(idx) && s && match(s) && s.n >= need);
    if (i < 0) return null;
    used.add(i);
    map.push(i);
  }
  return map;
}

// Any recipe whose every input TYPE is loaded (units maybe short) -
// distinguishes "waiting for more" (keep progress) from "wrong load"
// (reset progress). Input-less recipes never count.
function recipeTypeMatch(p, items) {
  return (p.recipes ?? []).find(r => {
    const ids = Object.keys(r.inputs ?? {});
    return ids.length && ids.every(id => items.some(s => s && ((typeof recipeInputMatches === "function") ? recipeInputMatches(id, s.id) : s.id === id)));
  });
}

// The recipe a plan is actually cooking: the clicked (selected) recipe
// whenever its slots satisfy it, else the first satisfiable recipe.
// Manual slot edits clear the selection, restoring legacy first-match.
function activeCraftRecipe(p, st, items) {
  const sel = (p.recipes ?? []).find(r => r.id === st.selRecipe);
  if (sel && slotsForRecipe(sel, items)) return sel;
  return (p.recipes ?? []).find(r => slotsForRecipe(r, items));
}

function recipeForInput(plan, id) {
  return (plan.recipes ?? []).find(r => r.inputs && (r.inputs[id] ?? 0) > 0);
}

function discoveredRecipes(pid) {
  const ids = (state.crafting && state.crafting.discovered && state.crafting.discovered[pid]) ?? [];
  const plan = getCraftPlan(pid);
  if (!plan) return [];
  return (plan.recipes ?? []).filter(r => ids.includes(r.id));
}

// Starter plans unlock when station furniture is bought (first buy in
// practice - later buys find them already unlocked and no-op).
function unlockStarterPlans(f) {
  const tags = getTags(f);
  for (const g of craftGroups()) {
    if (!tags.includes(g.stationTag)) continue;
    for (const p of g.plans ?? []) {
      if (!p.starter) continue;
      const st = planState(p.id);
      if (!st || st.unlocked) continue;
      st.unlocked = true;
      log("Unlocked " + g.name + " Plan: " + p.name + ".", "unlock");
    }
  }
}

// Loading deducts from the Inventory into a slot (shift-click loads
// everything held). `dest` is "fuel", an item-slot index (drop target)
// or null (auto: same-item slot, else first empty slot). Manual loads
// clear the recipe selection; the autofill below sets it afterwards.
function loadCraftMaterial(planId, itemId, n, dest) {
  const g = craftGroupOfPlan(planId), p = getCraftPlan(planId);
  const st = planState(planId);
  if (!g || !p || !st || !st.unlocked) return;
  const have = Math.floor(state.amounts[itemId] ?? 0);
  if (have <= 0) return;
  const items = craftItemSlots(st, p);
  const def = getItem(itemId);
  const label = def ? def.name : itemId;
  const accepts = planAcceptsItem(p, itemId);
  const burnable = isFuelItem(itemId);
  if (typeof dest === "number") {
    if (!accepts || dest < 0 || dest >= items.length) {
      // Fuel belongs in the Fuel Slot, not an Item Slot: refuse silently
      // (no "isn't an ingredient" spam) when the item only burns and the
      // plan burns fuel. On fuelless plans there is no Fuel Slot, so a
      // burnable item aimed at an Item Slot gets the normal message.
      if (!accepts && burnable && planNeedsFuel(p)) return;
      log(label + " isn't an ingredient for " + p.name + ".");
      return;
    }
    const cur = items[dest];
    if (cur && cur.id !== itemId) {
      const curDef = getItem(cur.id);
      log("That slot is holding " + (curDef ? curDef.name : cur.id) + " - unload it first.");
      return;
    }
    const take = Math.min(Math.max(1, Math.floor(n) || 1), have);
    state.amounts[itemId] = have - take;
    if (cur) cur.n += take;
    else items[dest] = { id: itemId, n: take };
    st.selRecipe = null;
  } else if (dest === "fuel" || (!accepts && burnable)) {
    if (!planNeedsFuel(p)) {
      log(label + " doesn't belong in " + p.name + ".");
      return;
    }
    if (!burnable) {
      log(label + " can't be burned as fuel.");
      return;
    }
    const cur = st.fuel;
    if (cur && cur.id !== itemId) {
      const curDef = getItem(cur.id);
      log("That slot is holding " + (curDef ? curDef.name : cur.id) + " - unload it first.");
      return;
    }
    const take = Math.min(Math.max(1, Math.floor(n) || 1), have);
    state.amounts[itemId] = have - take;
    if (cur) cur.n += take;
    else st.fuel = { id: itemId, n: take };
    // The bar's denominator follows the loaded fuel: swapping fuel types
    // over a banked remainder (twigs banked, charcoal loaded) must
    // re-anchor to the new fuel's value, or the bar reads stale. Fuel is
    // shared by every recipe, so loading it never disturbs the selected
    // recipe (topping up mid-burn must not silently switch the plan to
    // first-match).
    st.fuelMax = Math.max(st.fuelLeft || 0, fuelValueOf(itemId));
  } else if (accepts) {
    const idx = items.findIndex(s => s && s.id === itemId);
    const empty = idx >= 0 ? idx : items.findIndex(s => !s);
    if (empty < 0) {
      log(p.name + "'s item slots are full - unload one first.");
      return;
    }
    const take = Math.min(Math.max(1, Math.floor(n) || 1), have);
    state.amounts[itemId] = have - take;
    if (items[empty]) items[empty].n += take;
    else items[empty] = { id: itemId, n: take };
    st.selRecipe = null;
  } else {
    log(label + " doesn't belong in " + p.name + ".");
    return;
  }
  if (typeof render === "function") render();
}

// Finishing a recipe discovers it (first finish only - loading the
// ingredients reveals nothing, so the Recipes list only ever shows
// what has actually been cooked at least once).
function discoverCraftRecipe(planId, recipe) {
  if (!recipe) return;
  const known = state.crafting.discovered[planId] ?? (state.crafting.discovered[planId] = []);
  if (known.includes(recipe.id)) return;
  known.push(recipe.id);
  log("Discovered recipe: " + recipe.name + "!", "discovery");
}

function unloadCraftSlot(planId, which, all) {
  const st = planState(planId);
  if (!st) return;
  const p = getCraftPlan(planId);
  const cur = which === "fuel" ? st.fuel : (p ? craftItemSlots(st, p)[which] : null);
  if (!cur || !(cur.n > 0)) return;
  const n = all ? cur.n : 1;
  state.amounts[cur.id] = (state.amounts[cur.id] ?? 0) + n;
  cur.n -= n;
  if (cur.n <= 0) {
    if (which === "fuel") st.fuel = null;
    else {
      craftItemSlots(st, p)[which] = null;
      // Emptying a slot only restarts the burn when nothing loaded
      // matches a recipe anymore (same rule as the background tick) -
      // unloading an uninvolved slot keeps the current run going.
      if (!recipeTypeMatch(p, craftItemSlots(st, p))) st.progress = 0;
    }
  }
  // Ingredient edits clear the selected recipe (first-match takes over,
  // like a manual load). Fuel is shared by every recipe, so touching the
  // Fuel Slot never disturbs the selection.
  if (which !== "fuel") st.selRecipe = null;
  if (typeof render === "function") render();
}

// Clicking a discovered recipe fills the plan from the Inventory: every
// input loads whole (whatever is held), plus the richest fuel stack when
// the plan burns fuel. Anything already slotted goes back first, so one
// click always leaves the plan exactly matching the recipe. Missing
// holdings are named instead of filled.
function autofillCraftRecipe(planId, recipeId) {
  const g = craftGroupOfPlan(planId), p = getCraftPlan(planId);
  const st = planState(planId);
  if (!g || !p || !st || !st.unlocked) return;
  const recipe = (p.recipes ?? []).find(r => r.id === recipeId);
  if (!recipe) return;
  if (!(state.crafting.discovered[planId] ?? []).includes(recipeId)) return;
  const items = craftItemSlots(st, p);
  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    if (s && s.n > 0) state.amounts[s.id] = (state.amounts[s.id] ?? 0) + s.n;
    items[i] = null;
  }
  if (st.fuel && st.fuel.n > 0) state.amounts[st.fuel.id] = (state.amounts[st.fuel.id] ?? 0) + st.fuel.n;
  st.fuel = null;
  st.progress = 0;
  // Rich-log entries (id, count, optional suffix) plus the plain-text
  // fallback the dedup merge keys on; missing holdings stay names.
  const entries = [], missing = [];
  const plainParts = [];
  let loadedInputs = 0;
  {
    let i = 0;
    for (const [id, need] of Object.entries(recipe.inputs ?? {})) {
      // A "tag:" input loads the most-held matching item whole (one slot
      // holds one item id, so the richest stack stands in for the tag);
      // missing stays the tag's own name.
      if ((typeof isTagInputKey === "function") && isTagInputKey(id)) {
        let best = null, bestN = 0;
        for (const tid of tagInputItems(id)) {
          const held = Math.floor(state.amounts[tid] ?? 0);
          if (held > bestN) { bestN = held; best = tid; }
        }
        if (!best || bestN <= 0) { missing.push(tagInputTag(id).charAt(0).toUpperCase() + tagInputTag(id).slice(1)); i++; continue; }
        const def = getItem(best);
        const label = def ? displayName(def, bestN) : best;
        state.amounts[best] = 0;
        items[i] = { id: best, n: bestN };
        entries.push({ id: best, n: bestN, suffix: null });
        plainParts.push(formatCraftNum(bestN) + " " + label);
        loadedInputs++;
        i++;
        continue;
      }
      const have = Math.floor(state.amounts[id] ?? 0);
      const def = getItem(id);
      const label = def ? displayName(def, have) : id;
      if (have <= 0) { missing.push(label); i++; continue; }
      state.amounts[id] = 0;
      items[i] = { id, n: have };
      entries.push({ id, n: have, suffix: null });
      plainParts.push(formatCraftNum(have) + " " + label);
      loadedInputs++;
      i++;
    }
  }
  // No ingredients held at all: no point loading fuel either - say so
  // and leave the plan empty (slotted stacks were returned above). The
  // selection is cleared: highlighting the recipe would promise a run
  // the empty slots can't deliver.
  if (!loadedInputs) {
    st.selRecipe = null;
    log("You don't have the materials for " + recipe.name + ".", "craft");
    if (typeof render === "function") render();
    return;
  }
  if (planNeedsFuel(p)) {
    let best = null, bestVal = 0;
    if (typeof ITEMS !== "undefined") for (const it of ITEMS) {
      const held = Math.floor(state.amounts[it.id] ?? 0);
      if (held <= 0 || !isFuelItem(it.id)) continue;
      const v = held * fuelValueOf(it.id);
      if (v > bestVal) { bestVal = v; best = it.id; }
    }
    if (best) {
      const held = Math.floor(state.amounts[best] ?? 0);
      state.amounts[best] = 0;
      st.fuel = { id: best, n: held };
      // Same re-anchor as manual loads (see loadCraftMaterial): the
      // banked remainder keeps its value, but the bar measures against
      // the newly loaded fuel.
      st.fuelMax = Math.max(st.fuelLeft || 0, fuelValueOf(best));
      const def = getItem(best);
      entries.push({ id: best, n: held, suffix: "(fuel)" });
      plainParts.push(formatCraftNum(held) + " " + (def ? displayName(def, held) : best) + " (fuel)");
    } else {
      missing.push("fuel");
    }
  }
  st.selRecipe = recipe.id;
  // Loads log gather-style: header plus one bullet per loaded stack,
  // missing holdings named after the bullets.
  if (entries.length) {
    const header = "Loaded " + recipe.name + ":";
    logRich(header + " " + plainParts.join(", ") + "." + (missing.length ? " (missing " + missing.join(", ") + ")" : ""), "craft", (line) => {
      line.appendChild(document.createTextNode(header));
      for (const e of entries) craftBullet(line, e.id, e.n, false, e.suffix);
      if (missing.length) line.appendChild(document.createTextNode(" (missing: " + missing.join(", ") + ")"));
    });
  }
  else log("You don't have the materials for " + recipe.name + ".", "craft");
  if (typeof render === "function") render();
}

// One rarity-colored "• +N Item" bullet under a rich log line, the
// same look as gather results (renderGatherBullets). `gain` prefixes
// the + (outputs); loads list plain counts; `suffix` tags fuel stacks.
function craftBullet(line, id, n, gain, suffix) {
  const row = document.createElement("div");
  row.className = "gather-bullet";
  row.appendChild(document.createTextNode("• "));
  const name = document.createElement("span");
  const def = getItem(id);
  name.textContent = (gain ? "+" : "") + formatCraftNum(n) + " " + (def ? displayName(def, n) : id) + (suffix ? " " + suffix : "");
  if (def && typeof itemRarityClass === "function") name.classList.add(itemRarityClass(def));
  row.appendChild(name);
  line.appendChild(row);
}

function completeCraft(g, p, st, recipe) {
  const ids = Object.keys(recipe.inputs ?? {});
  const slots = slotsForRecipe(recipe, craftItemSlots(st, p));
  // Actual items consumed per slot: a "tag:" input burns whatever tagged
  // item was loaded, so the finish log names real items, never "tag:*".
  const actualIns = {};
  if (slots) {
    slots.forEach((si, k) => {
      const need = recipe.inputs[ids[k]] ?? 1;
      const s = st.items[si];
      actualIns[s.id] = (actualIns[s.id] ?? 0) + need;
      s.n -= need;
      if (s.n <= 0) st.items[si] = null;
    });
  }
  for (const [id, n] of Object.entries(recipe.outputs ?? {})) {
    state.amounts[id] = (state.amounts[id] ?? 0) + n;
    if (getItem(id)) {
      if (!state.seen) state.seen = {};
      state.seen[id] = true;
    }
  }
  // Finished crafts log gather-style: header plus rarity-colored
  // output bullets (custom completeLog lines stay plain system text).
  // Repeat finishes of one recipe accumulate into ONE rewritten line -
  // "Finished Roast Apple (5 Apples): • +5 Cooked Apples" - via the log
  // mergeKey chain, exactly like repeat eats/sells. Any other log line
  // breaks the chain (lastLogMergeKey changes), starting fresh totals.
  // Runtime-only, never saved.
  if (recipe.completeLog) {
    log(recipe.completeLog);
  } else {
    logCraftFinish(p, recipe, actualIns);
  }
  // Finishing discovers the recipe (first finish only).
  discoverCraftRecipe(p.id, recipe);
  if (g.skill && typeof gainSkillXp === "function") {
    const amt = (p.xp && p.xp[g.skill]) || 0;
    if (amt > 0) gainSkillXp(g.skill, amt * (typeof xpMultFor === "function" ? xpMultFor(g.skill) : 1));
  }
}

// Repeat finish accumulator (see logCraftFinish): runtime-only, never saved.
let craftAcc = null; // { key, pid, rid, name, ins: {id: n}, gains: {id: n}, seq, lines }
function craftChainAlive() {
  if (!craftAcc) return false;
  if (lastLogMergeKey === craftAcc.key) return (typeof logLinesAlive !== "function" || logLinesAlive(craftAcc.lines));
  if (typeof logWritesSince === "function" && typeof logLinesAlive === "function") {
    return !logWritesSince(craftAcc.seq, ["craft", "skillxp", "unlock", "skillup", "discovery"]) && logLinesAlive(craftAcc.lines);
  }
  return false;
}

// One rarity-colored "• +N Item" bullet row shared by fresh and rewritten
// finish lines (logRich's fill runs once per visible copy).
function fillCraftLine(line, header, outs) {
  line.appendChild(document.createTextNode(header));
  for (const [id, n] of outs) craftBullet(line, id, n, true);
}

// Standard finish receipt (custom completeLog lines bypass this and stay
// plain). Totals grow per finish of the same recipe, so five roasts
// rewrite one line - "Finished Roast Wood Berries (5 Wood Berries):
// • +5 Cooked Wood Berries" - with plurals following the running totals.
// `actualIns` names the items really burned (a "tag:" input burns whatever
// tagged item was loaded), defaulting to the recipe's inputs.
// The chain tolerates skill XP receipts, recipe discoveries, and skill
// level-ups (and XP chains tolerate these back), so unlocks and level-ups
// stack side by side with the finishes instead of splitting them.
// Anything else - system text, stops, other recipes - starts fresh totals.
function logCraftFinish(p, recipe, actualIns) {
  const rid = recipe.id ?? recipe.name;
  const key = "craft:" + p.id + ":" + rid;
  const insSrc = (actualIns && Object.keys(actualIns).length) ? actualIns : (recipe.inputs ?? {});
  const alive = !!craftAcc && craftAcc.pid === p.id && craftAcc.rid === rid && craftChainAlive();
  if (alive) {
    for (const [id, n] of Object.entries(insSrc)) craftAcc.ins[id] = (craftAcc.ins[id] ?? 0) + (n ?? 1);
    for (const [id, n] of Object.entries(recipe.outputs ?? {})) craftAcc.gains[id] = (craftAcc.gains[id] ?? 0) + (n ?? 0);
  } else {
    const ins = {}, gains = {};
    for (const [id, n] of Object.entries(insSrc)) ins[id] = n ?? 1;
    for (const [id, n] of Object.entries(recipe.outputs ?? {})) gains[id] = n ?? 0;
    craftAcc = { key, pid: p.id, rid, name: recipe.name, ins, gains, seq: 0, lines: [] };
  }
  const ins = Object.entries(craftAcc.ins).map(([id, n]) => {
    const d = getResource(id);
    return formatCraftNum(n) + " " + (d ? displayName(d, n) : id);
  }).join(" + ");
  const header = "Finished " + craftAcc.name + " (" + ins + "):";
  const outs = Object.entries(craftAcc.gains);
  const plain = header + " " + outs.map(([id, n]) => {
    const d = getResource(id);
    return "+" + formatCraftNum(n) + " " + (d ? displayName(d, n) : id);
  }).join(", ") + ".";
  if (alive) {
    for (const line of craftAcc.lines) {
      line.innerHTML = "";
      fillCraftLine(line, header, outs);
    }
    lastLogMsg = plain;
    lastLogCount = 1;
    lastLogMergeKey = key;
    craftAcc.seq = stampLogWrite("craft");
  } else if (typeof logRich === "function") {
    logRich(plain, "craft", (line) => fillCraftLine(line, header, outs), key);
    craftAcc.seq = (typeof logSeq !== "undefined" ? logSeq : 0);
    craftAcc.lines = (typeof captureLogLines === "function" ? captureLogLines() : []);
  } else {
    log(plain, "craft", key);
    craftAcc.seq = (typeof logSeq !== "undefined" ? logSeq : 0);
    craftAcc.lines = (typeof captureLogLines === "function" ? captureLogLines() : []);
  }
}

// Background tick (called from the main loop): every unlocked plan with
// loaded, recipe-matching ingredients advances - burning fuel too when
// the plan needs it, running on ingredients alone when it doesn't.
// Fuel burns per base-time second (0.25 x 5s = 1.25 value per Roast),
// so faster Speed stats drain the bar quicker in real time while the
// per-craft total stays the same. Multi-input recipes draw one input
// from each of their slots. No Stamina cost - plans run alongside
// (and independently of) actions, travel and other plans.
function craftTick(dt) {
  if (!state.crafting || typeof CRAFTING === "undefined" || !(dt > 0)) return;
  for (const g of craftGroups()) {
    if (!ownsCraftingStation(g)) continue;
    for (const p of g.plans ?? []) {
      const st = planState(p.id);
      if (!st || !st.unlocked) continue;
      const items = craftItemSlots(st, p);
      const recipe = activeCraftRecipe(p, st, items);
      if (!recipe) {
        if (!recipeTypeMatch(p, items)) st.progress = 0;
        continue;
      }
      const eff = recipeEffTime(recipe, p, g);
      if (planNeedsFuel(p)) {
        const craftCost = (p.fuelPerSec ?? 0) * recipeBaseTime(recipe, p);
        const need = craftCost / eff * dt;
        let guard = 0;
        while (st.fuelLeft < need && st.fuel && st.fuel.n > 0 && guard++ < MAX_FUEL_UNITS_PER_TICK) {
          const v = fuelValueOf(st.fuel.id);
          if (!(v > 0)) break;
          const wasEmpty = st.fuelLeft <= 0;
          st.fuel.n--;
          if (st.fuel.n <= 0) st.fuel = null;
          st.fuelLeft += v;
          if (wasEmpty) st.fuelMax = v;
        }
        // Banked float dust (an exactly-fueled craft leaves ~1e-16 behind)
        // would read as fuel and earn a phantom micro-tick: snap it away
        // once the slot runs dry. Threshold is far below any real fuel
        // value, so genuine remainders are untouched.
        if ((!st.fuel || !(st.fuel.n > 0)) && st.fuelLeft < 1e-9) st.fuelLeft = 0;
        // Exact per-craft fuel: this tick earns at most what the banked
        // fuel covers. Draining the raw dt-share overcharges up to a full
        // tick per craft (progress carries its remainder across completions
        // but the old drain never gave any back) - so exactly one twig
        // (1.25 value) stalled just short of one Roast (1.25 per craft).
        // Capped progress keeps every craft at exactly its fuel value; the
        // dust-scale snap finishes an exactly-fueled craft instead of
        // stalling on float noise. Unspent fuel stays banked when slots run
        // out mid-tick (progress resets, fuel doesn't drain for it).
        let progGain = dt / eff;
        if (craftCost > 0) {
          progGain = Math.min(progGain, st.fuelLeft / craftCost);
          if (1 - st.progress - progGain < 1e-9) progGain = Math.max(0, 1 - st.progress);
        }
        if (!(progGain > 0)) continue;
        st.fuelLeft = Math.max(0, st.fuelLeft - craftCost * progGain);
        st.progress += progGain;
      } else {
        st.progress += dt / eff;
      }
      let done = 0;
      while (st.progress >= 1 && done++ < MAX_CYCLES_PER_TICK) {
        st.progress -= 1;
        completeCraft(g, p, st, recipe);
        if (!slotsForRecipe(recipe, craftItemSlots(st, p))) { st.progress = 0; break; }
      }
    }
  }
}

// ---- UI ----
let craftUI = null;

function craftMatIdList(plan) {
  // Every recipe input plus every burnable fuel (fuels only when the
  // plan actually burns them), first-use order. Fuels come from the
  // cached fuelItemIds() (same predicate as isFuelItem, same ITEMS
  // order) instead of re-scanning ITEMS here - and it runs every tick
  // for the materials sig. "tag:" inputs expand to every item carrying
  // the tag (same predicate as the slot match, same ITEMS order).
  const ids = [];
  for (const r of plan.recipes ?? []) for (const id of Object.keys(r.inputs ?? {})) {
    if ((typeof isTagInputKey === "function") && isTagInputKey(id)) {
      for (const tid of tagInputItems(id)) if (!ids.includes(tid)) ids.push(tid);
    }
    else if (!ids.includes(id)) ids.push(id);
  }
  if (planNeedsFuel(plan) && typeof ITEMS !== "undefined") for (const id of fuelItemIds()) {
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

function buildCraftingTab() {
  craftUI = null;
  const groupRow = document.getElementById("craftGroupRow");
  const plansCtn = document.getElementById("craftPlansCtn");
  const matsCtn = document.getElementById("craftMatsCtn");
  const planCtn = document.getElementById("craftPlanCtn");
  const recipesCtn = document.getElementById("craftRecipesCtn");
  if (!groupRow || !plansCtn || !matsCtn || !planCtn || !recipesCtn) return;
  groupRow.innerHTML = "";
  plansCtn.innerHTML = "";
  matsCtn.innerHTML = "";
  planCtn.innerHTML = "";
  recipesCtn.innerHTML = "";
  craftUI = { groupRow, plansCtn, matsCtn, planCtn, recipesCtn, matsSig: null, plansSig: null, planSig: null, recipesSig: null, groupsSig: null };
  buildCraftSlots();
  buildCraftRailScroll();
}

// Plans-rail custom scrollbar: native scrollbars are overlay (invisible
// until mid-scroll) in the user's browser, so a flooded rail gave no
// persistent affordance that it scrolls. This thin track+thumb (same
// palette as the native thin thumbs) is always visible while the rail
// overflows, and hides with it when everything fits. The native bar is
// suppressed on this container (see index.html) so exactly one bar shows
// on every platform; wheel/touch/keyboard scrolling is untouched.
function buildCraftRailScroll() {
  const side = document.getElementById("craftSideCol");
  const rail = craftUI && craftUI.plansCtn;
  if (!side || !rail) return;
  let track = side.querySelector(":scope > .craftRailTrack");
  if (!track) {
    track = document.createElement("div");
    track.className = "craftRailTrack";
    const thumb = document.createElement("div");
    thumb.className = "craftRailThumb";
    track.appendChild(thumb);
    side.appendChild(track);
    rail.addEventListener("scroll", () => syncCraftRailScroll(), { passive: true });
    let drag = null; // { startY, startTop } while a thumb/track drag runs
    const maxTop = () => Math.max(0, rail.scrollHeight - rail.clientHeight);
    track.addEventListener("pointerdown", (e) => {
      if (!track.classList.contains("show")) return;
      const th = track.firstChild.getBoundingClientRect();
      // Clicking the track outside the thumb jumps there first (native
      // behavior), then the same gesture drags.
      if (e.clientY < th.top || e.clientY > th.bottom) {
        const r = track.getBoundingClientRect();
        const frac = Math.min(1, Math.max(0, (e.clientY - r.top - th.height / 2) / Math.max(1, r.height - th.height)));
        rail.scrollTop = frac * maxTop();
        syncCraftRailScroll();
      }
      drag = { startY: e.clientY, startTop: rail.scrollTop };
      try { track.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    track.addEventListener("pointermove", (e) => {
      if (!drag) return;
      rail.scrollTop = drag.startTop + (e.clientY - drag.startY) / Math.max(1, track.clientHeight) * rail.scrollHeight;
    });
    const endDrag = () => { drag = null; };
    track.addEventListener("pointerup", endDrag);
    track.addEventListener("pointercancel", endDrag);
    window.addEventListener("resize", () => syncCraftRailScroll());
  }
  craftUI.railTrack = track;
  craftUI.railThumb = track.firstChild;
  syncCraftRailScroll();
}

function syncCraftRailScroll() {
  const rail = craftUI && craftUI.plansCtn;
  const track = craftUI && craftUI.railTrack;
  const thumb = craftUI && craftUI.railThumb;
  if (!rail || !track || !thumb || !rail.isConnected || !track.isConnected) return;
  const over = rail.scrollHeight > rail.clientHeight + 1;
  if (track.classList.contains("show") !== over) track.classList.toggle("show", over);
  if (!over) return;
  const trackH = Math.max(1, track.clientHeight);
  const thumbH = Math.max(20, Math.round(rail.clientHeight / rail.scrollHeight * trackH));
  const maxTop = Math.max(0, rail.scrollHeight - rail.clientHeight);
  const top = maxTop > 0 ? Math.round(rail.scrollTop / maxTop * (trackH - thumbH)) : 0;
  const hPx = thumbH + "px", tPx = top + "px";
  if (thumb.style.height !== hPx) thumb.style.height = hPx;
  if (thumb.style.top !== tPx) thumb.style.top = tPx;
}

function buildCraftSlots() {
  const planCtn = craftUI.planCtn;
  // Slots row (rebuilt when the plan's slot layout changes - item-slot
  // count or fuel need - but otherwise persistent, so a mid-drag render
  // never cancels the drag).
  const row = document.createElement("div");
  row.className = "craftSlotsRow";
  planCtn.appendChild(row);
  // Divider between the item slots and the progress bar.
  const div = document.createElement("div");
  div.className = "craftDiv";
  planCtn.appendChild(div);
  craftUI.craftDiv = div;
  const progBar = document.createElement("div");
  progBar.className = "craftBar craftProgBar";
  const progFill = document.createElement("div");
  progFill.className = "craftFill";
  progBar.appendChild(progFill);
  // Live status lives INSIDE the time bar (World-trip style): recipe +
  // seconds left while running, guidance when idle. No separate line.
  const progText = document.createElement("span");
  progText.className = "craftProgText";
  progBar.appendChild(progText);
  planCtn.appendChild(progBar);
  const station = document.createElement("div");
  station.className = "craftStatus";
  station.hidden = true;
  planCtn.appendChild(station);
  craftUI.slotRow = row;
  craftUI.slotSig = null;
  craftUI.itemSlots = [];
  craftUI.fuelBox = null;
  craftUI.fuelSlot = null;
  craftUI.fuelTxt = null;
  craftUI.fuelFill = null;
  craftUI.fuelLab = null;
  craftUI.progFill = progFill;
  craftUI.progText = progText;
  craftUI.stationMsg = station;
  craftUI.slotKids = row;
}

// (Re)builds the slot boxes for the selected plan: one Item Slot per
// recipe input plus a Fuel Slot when the plan burns fuel. Runs only
// when the layout sig changes, so per-frame renders just rewrite text.
function ensureCraftSlots(p) {
  const n = planItemSlots(p);
  const fuel = planNeedsFuel(p);
  const sig = p.id + "|" + n + "|" + (fuel ? 1 : 0);
  if (craftUI.slotSig === sig) return;
  craftUI.slotSig = sig;
  craftUI.slotRow.innerHTML = "";
  craftUI.itemSlots = [];
  const mkSlot = (which, label) => {
    const box = document.createElement("div");
    box.className = "craftSlotBox";
    const lab = document.createElement("div");
    lab.className = "craftSlotLabel";
    lab.textContent = label;
    const slot = document.createElement("div");
    slot.className = "craftSlot";
    slot.tabIndex = 0;
    slot.title = "Click to unload one (shift-click unloads all).";
    const txt = document.createElement("span");
    txt.className = "craftSlotText";
    txt.textContent = "Empty";
    slot.appendChild(txt);
    slot.addEventListener("click", (e) => {
      const sel = selCraftPlan();
      if (sel) unloadCraftSlot(sel.id, which, e.shiftKey);
    });
    slot.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const sel = selCraftPlan();
      if (sel) unloadCraftSlot(sel.id, which, e.shiftKey);
    });
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      const sel = (typeof selCraftPlan === "function") ? selCraftPlan() : null;
      // Only glow when the dragged material would actually load here
      // (right kind AND a free or matching slot). Compatible slots are
      // already glowing from dragstart (see craftHighlightCompatible) so
      // discovery shows every target at once; this keeps the hovered one
      // lit without ever lighting an incompatible slot.
      if (sel && craftDragId && craftSlotWillTake(sel.id, which, craftDragId)) slot.classList.add("dragOver");
      else slot.classList.remove("dragOver");
    });
    slot.addEventListener("dragleave", () => {
      // Keep the dragstart highlight until the item is inserted: leaving
      // a compatible slot must not dim it mid-drag.
      const sel = (typeof selCraftPlan === "function") ? selCraftPlan() : null;
      if (sel && craftDragId && craftSlotWillTake(sel.id, which, craftDragId)) return;
      slot.classList.remove("dragOver");
    });
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      craftClearSlotGlow();
      const id = e.dataTransfer && e.dataTransfer.getData("text/plain");
      const sel = selCraftPlan();
      if (id && sel) loadCraftMaterial(sel.id, id, 1, which);
    });
    box.appendChild(lab);
    box.appendChild(slot);
    return { box, slot, txt };
  };
  for (let i = 0; i < n; i++) {
    const s = mkSlot(i, n > 1 ? "Item Slot " + (i + 1) : "Item Slot");
    craftUI.slotRow.appendChild(s.box);
    craftUI.itemSlots.push(s);
  }
  craftUI.fuelBox = null;
  craftUI.fuelSlot = null;
  craftUI.fuelTxt = null;
  craftUI.fuelFill = null;
  craftUI.fuelLab = null;
  if (fuel) {
    const f = mkSlot("fuel", "Fuel Slot");
    // The fuel bar lives INSIDE the Fuel Slot (a background fill behind
    // the slot text) instead of as a separate bar below it.
    const fuelFill = document.createElement("div");
    fuelFill.className = "craftFill craftFuelFill";
    f.slot.classList.add("craftFuelSlot");
    f.slot.insertBefore(fuelFill, f.txt);
    const fuelLab = document.createElement("div");
    fuelLab.className = "craftSlotSub";
    f.box.appendChild(fuelLab);
    craftUI.slotRow.appendChild(f.box);
    craftUI.fuelBox = f.box;
    craftUI.fuelSlot = f.slot;
    craftUI.fuelTxt = f.txt;
    craftUI.fuelFill = fuelFill;
    craftUI.fuelLab = fuelLab;
  }
}

function renderCrafting() {
  if (typeof tabCraftingBtn !== "undefined" && tabCraftingBtn) {
    // Catch-ups: owning station/Crafting furniture also unlocks (imports
    // and saves that predate the flags land here like action unlocks do).
    if (typeof FURNITURE !== "undefined") {
      if (FURNITURE.some(f => getTags(f).includes(CRAFTING_TAG) && (state.furniture[f.id] ?? 0) > 0)) state.unlocked["tab:crafting"] = true;
    }
    for (const g of craftGroups()) {
      if (ownsCraftingStation(g)) {
        for (const p of g.plans ?? []) {
          const st = planState(p.id);
          if (p.starter && st && !st.unlocked) {
            st.unlocked = true;
            log("Unlocked " + g.name + " Plan: " + p.name + ".", "unlock");
          }
        }
      }
    }
    // Event unlocks (see plan `unlock` in config/craftingConfig.js):
    // checked here every render like the starter catch-up - imports
    // that already qualify land them on sight. Gated behind the
    // Crafting tab like the starters: the tab opens first (same frame),
    // so a forged skill+seen pair can't unlock a plan before the tab.
    if (craftingUnlocked()) for (const gg of craftGroups()) for (const pl of gg.plans ?? []) {
      if (!pl.unlock) continue;
      const st = (typeof planState === "function") ? planState(pl.id) : null;
      if (st && !st.unlocked && planUnlockMet(pl)) {
        st.unlocked = true;
        log("Unlocked " + gg.name + " Plan: " + (pl.name ?? pl.id) + ".", "unlock");
      }
    }
    tabCraftingBtn.hidden = !craftingUnlocked();
  }
  if (!craftingUnlocked() || !craftUI) return;
  let g = selCraftGroup();
  // A selected-but-unopened group (e.g. Woodworking before its station)
  // falls back to the first runnable group instead of a dead pane.
  if (g && typeof craftGroupVisible === "function" && !craftGroupVisible(g)) {
    const first = craftGroups().find(x => craftGroupVisible(x));
    if (first) {
      state.crafting.sel.group = first.id;
      state.crafting.sel.plan = rememberedCraftPlan(first) ?? firstVisibleCraftPlan(first);
      rememberCraftPlan(first, state.crafting.sel.plan);
      g = first;
    } else return;
  }
  if (!g) return;
  let p = selCraftPlan();
  if (!p || craftGroupOfPlan(p.id) !== g) {
    state.crafting.sel.plan = rememberedCraftPlan(g) ?? firstVisibleCraftPlan(g);
    rememberCraftPlan(g, state.crafting.sel.plan);
    p = selCraftPlan();
  }
  renderCraftGroups(g);
  renderCraftPlans(g, p);
  renderCraftMats(g, p);
  renderCraftPlan(g, p);
  renderCraftRecipes(g, p);
  // Station-missing workbench: the orange message stands alone - the plan
  // header, section labels, materials strip and recipes hide with the
  // slots/progress bars.
  {
    const pst = p ? planState(p.id) : null;
    const missing = !!(p && pst && pst.unlocked && !ownsCraftingStation(g));
    const title = document.getElementById("craftPlanTitle");
    const titleWrap = title ? title.parentElement : null;
    if (titleWrap && titleWrap.hidden !== missing) titleWrap.hidden = missing;
    if (craftUI.matsCtn) {
      if (craftUI.matsCtn.hidden !== missing) craftUI.matsCtn.hidden = missing;
      const matsLabel = craftUI.matsCtn.previousElementSibling;
      if (matsLabel && matsLabel.classList && matsLabel.classList.contains("craftSecLabel") && matsLabel.hidden !== missing) matsLabel.hidden = missing;
    }
    if (craftUI.recipesCtn) {
      if (craftUI.recipesCtn.hidden !== missing) craftUI.recipesCtn.hidden = missing;
      const recipesLabel = craftUI.recipesCtn.previousElementSibling;
      if (recipesLabel && recipesLabel.classList && recipesLabel.classList.contains("craftSecLabel") && recipesLabel.hidden !== missing) recipesLabel.hidden = missing;
    }
  }
  // Live per-recipe craft time: Speed stats shorten it mid-session, so
  // the open recipe tip's Time row refreshes every frame (same pattern as
  // the cost tint below).
  if (typeof activeCraftPlanTip !== "undefined" && activeCraftPlanTip && activeCraftPlanTip.btn && activeCraftPlanTip.btn.isConnected && activeCraftPlanTip.btn._recipeTime) {
    const rt = activeCraftPlanTip.btn._recipeTime;
    if (rt.el && rt.el.isConnected) {
      const txt = "Time: " + formatCraftFixed(recipeEffTime(rt.recipe, rt.plan, rt.group)) + " per craft";
      if (rt.el.textContent !== txt) rt.el.textContent = txt;
    }
  }
  // Live affordability: red names on short recipes without rebuilding.
  syncCraftRecipeAfford();
  // Live station-missing: red plan names without rebuilding.
  syncCraftPlanStation();
  // Live row tints for the open recipe tip (amounts tick in the
  // background while it hovers): same red-short treatment as the
  // per-frame action/upgrade tint in render().
  if (typeof tintTip === "function" && typeof activeCraftPlanTip !== "undefined" && activeCraftPlanTip && activeCraftPlanTip.btn && activeCraftPlanTip.btn.isConnected && activeCraftPlanTip.btn._tipCosts) {
    // Recipe tips tint slot-aware (see tintCraftTip) so their rows agree
    // with the button; every other craft tip uses the shared amounts-only
    // tint.
    if (activeCraftPlanTip.btn._recipePlan) tintCraftTip(activeCraftPlanTip.btn);
    else tintTip({ costs: activeCraftPlanTip.btn._tipCosts }, activeCraftPlanTip.btn._tipCostMap ?? {});
  }
}

// Slot-aware red-short tint for the open recipe tip: mirrors tintTip's
// cost rows but counts the plan's slotted materials too (see
// craftHeldFor), so a loaded recipe's rows agree with its button.
function tintCraftTip(btn) {
  const planId = btn._recipePlan;
  for (const { id, el } of btn._tipCosts ?? []) {
    const need = (btn._tipCostMap ?? {})[id] ?? 0;
    if (el && el.parentElement) el.parentElement.classList.toggle("short", craftHeldFor(planId, id) < need);
  }
}

function renderCraftGroups(sel) {
  // Unopened groups hide until their station is bought (or a plan opens):
  // the rail only ever lists groups that can actually run.
  const groups = craftGroups().filter(g => (typeof craftGroupVisible === "function") ? craftGroupVisible(g) : true);
  const sig = groups.map(x => x.id).join(",") + "|" + (sel ? sel.id : "-");
  if (craftUI.groupsSig === sig) return;
  craftUI.groupsSig = sig;
  craftUI.groupRow.innerHTML = "";
  for (const x of groups) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = x.name;
    b.classList.toggle("on", x.id === sel.id);
    b.addEventListener("click", () => {
      state.crafting.sel.group = x.id;
      state.crafting.sel.plan = rememberedCraftPlan(x) ?? firstVisibleCraftPlan(x);
      render();
    });
    craftUI.groupRow.appendChild(b);
  }
}

function renderCraftPlans(g, sel) {
  // Hiding joins the sig so arming the mode (or striking a plan) rebuilds
  // the rail: hidden plans show struck-through while armed, hide after.
  const hideBits = (g.plans ?? []).map(p => itemHidden(craftPlanHideKey(p.id)) ? "0" : "1").join("");
  const sig = g.id + "|" + (g.plans ?? []).map(p => {
    const st = planState(p.id) || {};
    // XP-skill unlock bits join the sig so the rail (and its static plan
    // tips) rebuilds when an XP skill unlocks mid-session.
    const xpBits = Object.keys(p.xp ?? {}).map(s => (typeof skillUnlocked === "function" && skillUnlocked(s)) ? 1 : 0).join("");
    return p.id + (st.unlocked ? 1 : 0) + ":" + ((state.crafting.discovered[p.id] ?? []).length) + ":" + xpBits;
  }).join(",") + "|" + (sel ? sel.id : "-") + "|" + (hidingMode.plans ? 1 : 0) + "|" + hideBits;
  if (craftUI.plansSig === sig) return;
  craftUI.plansSig = sig;
  craftUI.plansCtn.innerHTML = "";
  craftUI.plansCtn._planBtns = null; // cached nodes (see syncCraftPlanStation) die with the rebuild
  // Locked plans stay invisible (no ??? rows): the rail only ever
  // lists what can actually run.
  let shown = 0;
  let unlocked = 0;
  for (const x of g.plans ?? []) {
    const st = planState(x.id);
    if (!(st && st.unlocked)) continue;
    unlocked++;
    const pHidden = itemHidden(craftPlanHideKey(x.id));
    if (pHidden && !hidingMode.plans) continue;
    shown++;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "craftPlanRow" + (x.id === (sel && sel.id) ? " on" : "") + (pHidden ? " userHidden" : "");
    const lab = document.createElement("span");
    lab.className = "craftPlanLabel";
    lab.textContent = x.name;
    b.appendChild(lab);
    // Station-missing red (see syncCraftPlanStation): the group has no
    // live station, so the name paints red until one is bought.
    b._plan = x;
    b._planLabel = lab;
    b._planGroup = g;
    if (!ownsCraftingStation(g)) lab.style.color = "red";
    b.addEventListener("click", () => {
        // Hiding mode: clicking strikes the plan hidden instead of
        // selecting it (click again to unhide).
        if (hidingMode.plans) { toggleItemHidden(craftPlanHideKey(x.id)); return; }
        state.crafting.sel.plan = x.id;
        rememberCraftPlan(g, x.id);
        render();
      });
      // Plan tooltip: description plus fuel burned per craft (same
      // fixed-detach pattern as skill/inventory tips, so it opens
      // full-size instead of clipping inside the Plans rail).
      const tip = buildCraftPlanTip(g, x);
      b.appendChild(tip);
      const fitPlan = () => {
        if (typeof placeCraftPlanTip === "function") placeCraftPlanTip(tip, b);
        else if (typeof fitTip === "function") { fitTip(tip, b, "down"); if (typeof syncTipPointer === "function") syncTipPointer(b, true); }
        activeCraftPlanTip = { btn: b, tip };
      };
      const unfitPlan = () => {
        if (activeCraftPlanTip && activeCraftPlanTip.btn === b) activeCraftPlanTip = null;
        if (typeof clearCraftPlanTip === "function") clearCraftPlanTip(tip);
      };
      b.addEventListener("mouseenter", fitPlan);
      b.addEventListener("focus", fitPlan);
      b.addEventListener("mouseleave", unfitPlan);
      b.addEventListener("blur", unfitPlan);
      craftUI.plansCtn.appendChild(b);
  }
  if (!shown) {
    const d = document.createElement("div");
    d.className = "emptyNote";
    d.textContent = unlocked ? "Plans hidden." : "No plans yet.";
    craftUI.plansCtn.appendChild(d);
  }
  if (typeof syncCraftRailScroll === "function") syncCraftRailScroll();
}

// Plan tooltip body: header, description, the fuel value one craft burns
// (a range when recipes run different times - e.g. 6s vs 7s charcoal),
// and the Skill XP each finished craft pays (all static config math -
// no live refresh needed).
function buildCraftPlanTip(g, p) {
  const tip = document.createElement("span");
  tip.className = "tip";
  const head = document.createElement("div");
  head.className = "tip-head";
  const title = document.createElement("span");
  title.textContent = p.name ?? p.id;
  head.appendChild(title);
  tip.appendChild(head);
  if (p.description) {
    const desc = document.createElement("div");
    desc.className = "tip-desc";
    desc.textContent = p.description;
    tip.appendChild(desc);
  }
  // Unlock requirements sit before the Fuel/Recipes block (plans have no
  // Cost section): the station gate plus any unlock gates on the plan.
  appendUnlockSection(tip, p, g ? g.stationTag : null);
  // Per-craft fuel follows each recipe's own time (a 7s charcoal burn
  // costs more than a 6s one): a single value when all agree, else the
  // range across the plan's recipes.
  const perCraftFuels = (p.recipes ?? []).map(r => (p.fuelPerSec ?? 0) * recipeBaseTime(r, p));
  const loFuel = perCraftFuels.length ? Math.min(...perCraftFuels) : (p.fuelPerSec ?? 0) * (p.time ?? 0);
  const hiFuel = perCraftFuels.length ? Math.max(...perCraftFuels) : loFuel;
  const fuelText = "Fuel value: " + (loFuel !== hiFuel ? formatCraftNum(loFuel) + "-" + formatCraftNum(hiFuel) : formatCraftNum(loFuel)) + " per craft";
  const knownN = discoveredRecipes(p.id).length;
  const totalN = (p.recipes ?? []).length;
  const allKnown = totalN > 0 && knownN >= totalN;
  const { sec, body } = makeTipSection(planNeedsFuel(p) ? "Fuel" : "Recipes");
  if (planNeedsFuel(p)) {
    const row = document.createElement("div");
    row.className = "tip-row";
    const s = document.createElement("span");
    s.textContent = fuelText;
    row.appendChild(s);
    body.appendChild(row);
    tip.appendChild(sec);
    const { sec: rsec, body: rbody } = makeTipSection("Recipes");
    const rrow = document.createElement("div");
    rrow.className = "tip-row" + (allKnown ? " known-all" : "");
    const rk = document.createElement("span");
    rk.textContent = "Known:";
    const rv = document.createElement("span");
    rv.textContent = knownN + " of " + totalN;
    rrow.appendChild(rk);
    rrow.appendChild(rv);
    rbody.appendChild(rrow);
    tip.appendChild(rsec);
  } else {
    const row = document.createElement("div");
    row.className = "tip-row" + (allKnown ? " known-all" : "");
    const rk = document.createElement("span");
    rk.textContent = "Known:";
    const rv = document.createElement("span");
    rv.textContent = knownN + " of " + totalN;
    row.appendChild(rk);
    row.appendChild(rv);
    body.appendChild(row);
    tip.appendChild(sec);
  }
  // Skill XP the plan pays per finished craft (same section style and
  // static base amounts as action tips).
  if (typeof appendTipXpSection === "function") appendTipXpSection(tip, p.xp);
  return tip;
}

// Plan tip placement: viewport-roomed fixed detach (same pattern as
// skill/inventory/world tips). The Plans rail scrolls internally, so an
// in-rail tip clips at the rail's edges; detached, it opens full-size
// over neighboring panels instead.
let activeCraftPlanTip = null; // { btn, tip } of the open plan tip
function placeCraftPlanTip(tip, anchor) {
  return fitDetachedTip(tip, anchor, { prefer: "down", forceShow: true });
}

function clearCraftPlanTip(tip) {
  return clearDetachedTip(tip);
}

// While a plan tip is open, scrolling or resizing would strand its fixed
// pixels away from the anchor: re-place instead.
if (typeof window !== "undefined" && !window.__craftPlanTipTrack) {
  window.__craftPlanTipTrack = true;
  const retrackCraftPlanTip = () => {
    if (activeCraftPlanTip && activeCraftPlanTip.btn && activeCraftPlanTip.btn.isConnected) {
      const tip = activeCraftPlanTip.tip;
      if (tip && tip.isConnected && getComputedStyle(tip).display !== "none" && typeof placeCraftPlanTip === "function") placeCraftPlanTip(tip, activeCraftPlanTip.btn);
    }
  };
  window.addEventListener("scroll", retrackCraftPlanTip, true);
  window.addEventListener("resize", retrackCraftPlanTip);
}

function renderCraftMats(g, p) {
  if (!p) { craftUI.matsCtn.innerHTML = ""; craftUI.matsSig = "none"; return; }
  const ids = craftMatIdList(p).filter(id => (state.amounts[id] ?? 0) > 0);
  const sig = p.id + "|" + ids.map(id => id + ":" + state.amounts[id]).join(",");
  if (craftUI.matsSig === sig) return;
  craftUI.matsSig = sig;
  craftUI.matsCtn.innerHTML = "";
  if (!ids.length) {
    const d = document.createElement("div");
    d.className = "emptyNote";
    d.textContent = "No relevant materials held.";
    craftUI.matsCtn.appendChild(d);
    return;
  }
  for (const id of ids) {
    const def = getItem(id);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "craftMat";
    b.draggable = true;
    const nm = def ? (def.name + " ×" + formatCraftNum(state.amounts[id])) : (id + " ×" + formatCraftNum(state.amounts[id]));
    b.textContent = nm;
    b.title = "Drag onto a slot, or click to load (shift-click loads all).";
    b.addEventListener("click", (e) => loadCraftMaterial(p.id, id, e.shiftKey ? state.amounts[id] : 1, null));
    b.addEventListener("dragstart", (e) => {
      // Track the payload for slot glow: e.dataTransfer payloads are
      // unreadable during dragover, so slots check this instead.
      craftDragId = id;
      // Light every compatible slot at once (green border until insert)
      // so players can see what a material fits before hovering.
      if (typeof craftHighlightCompatible === "function") craftHighlightCompatible(p.id, id);
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "copy";
      }
    });
    b.addEventListener("dragend", () => {
      craftDragId = null;
      if (typeof craftClearSlotGlow === "function") craftClearSlotGlow();
      else document.querySelectorAll(".craftSlot.dragOver").forEach(s => s.classList.remove("dragOver"));
    });
    craftUI.matsCtn.appendChild(b);
  }
}

function craftSlotLabel(st, itemIdx) {
  const cur = itemIdx === "fuel" ? st.fuel : (st.items ?? [])[itemIdx];
  if (!cur) return "Empty";
  const def = getItem(cur.id);
  return (def ? def.name : cur.id) + " ×" + formatCraftNum(cur.n);
}

// Custom green-bar text per recipe: r.progressText with {input}/{output}
// placeholders resolved to item display names. A "tag:" input resolves to
// the actually-loaded slot item, so future woods name themselves. Falls
// back to the recipe name when no custom text is set.
function craftProgressLabel(p, r, items) {
  const raw = (r && typeof r.progressText === "string" && r.progressText) ? r.progressText : (r && r.name) || "";
  if (!raw || raw.indexOf("{") < 0) return raw;
  const inKeys = Object.keys((r && r.inputs) || {});
  const outKeys = Object.keys((r && r.outputs) || {});
  const disp = (id) => {
    const d = (typeof getItem === "function") ? getItem(id) : null;
    return (d && d.name) || id;
  };
  let inName = inKeys.length ? inKeys[0] : "";
  if (inName && typeof isTagInputKey === "function" && isTagInputKey(inName)) {
    const hit = (items || []).find(s => s && typeof recipeInputMatches === "function" && recipeInputMatches(inName, s.id));
    inName = hit ? disp(hit.id) : (typeof tagInputTag === "function" ? tagInputTag(inName) : inName);
  } else if (inName) inName = disp(inName);
  const outName = outKeys.length ? disp(outKeys[0]) : "";
  return raw.split("{input}").join(inName).split("{output}").join(outName);
}

function renderCraftPlan(g, p) {
  const title = document.getElementById("craftPlanTitle");
  if (title && p && title.textContent !== p.name) title.textContent = p.name;
  if (!p) return;
  const st = planState(p.id);
  const open = !!(st && st.unlocked);
  const hasStation = ownsCraftingStation(g);
  // Locked plan or missing station: message instead of the workbench.
  craftUI.slotKids.hidden = !open || !hasStation;
  craftUI.progFill.parentElement.hidden = !open || !hasStation;
  // The slots/progress divider belongs to the workbench, not the message.
  if (craftUI.craftDiv) craftUI.craftDiv.hidden = !open || !hasStation;
  craftUI.stationMsg.hidden = open && hasStation;
  if (!open || !hasStation) {
    // Without its station a plan shows ONLY this line (mats/recipes hide
    // in renderCrafting): the group's noStationMsg line (generic fallback),
    // in orange. A locked plan whose station is already owned can only be
    // event-gated (starters unlock with the station), so it names the
    // requirements instead of a station the player already has.
    craftUI.stationMsg.textContent = !open
      ? (hasStation ? "Unlock this plan by meeting its unlock requirements." : "Unlock this plan by buying a " + g.stationTag + ".")
      : (g.noStationMsg ?? "You need a Crafting Station to Craft.");
    craftUI.stationMsg.classList.toggle("stationMissing", open && !hasStation);
    return;
  }
  craftUI.stationMsg.classList.remove("stationMissing");
  ensureCraftSlots(p);
  const items = craftItemSlots(st, p);
  craftUI.itemSlots.forEach((s, i) => {
    const t = craftSlotLabel(st, i);
    if (s.txt.textContent !== t) s.txt.textContent = t;
  });
  const needsFuel = planNeedsFuel(p);
  // Slotted fuel only counts when it can actually burn: a worthless item
  // stranded in the slot (tampered save, retired fuel def) reads as out
  // of fuel, not as a countdown that never advances.
  const fuelOnHand = needsFuel && st.fuel && st.fuel.n > 0 && fuelValueOf(st.fuel.id) > 0;
  if (craftUI.fuelBox) craftUI.fuelBox.hidden = !needsFuel;
  if (needsFuel && craftUI.fuelTxt) {
    craftUI.fuelTxt.textContent = craftSlotLabel(st, "fuel");
    const frac = Math.max(0, Math.min(1, (st.fuelMax > 0 ? st.fuelLeft / st.fuelMax : 0)));
    craftUI.fuelFill.style.width = (frac * 100).toFixed(1) + "%";
    craftUI.fuelLab.textContent = (fuelOnHand || st.fuelLeft > 0)
      ? "Fuel: " + formatCraftFixed(st.fuelLeft) + " left"
      : "No fuel loaded";
  }
  craftUI.progFill.style.width = (Math.max(0, Math.min(1, st.progress)) * 100).toFixed(1) + "%";
  const recipe = activeCraftRecipe(p, st, items);
  // Countdown runs at the active recipe's own pace (a 7s charcoal burn
  // counts down slower than a 6s one).
  const eff = recipeEffTime(recipe, p, g);
  let overlay;
  if (!items.some(s => s && s.n > 0)) {
    overlay = "Load to begin";
  } else if (!recipe) {
    overlay = "Waiting…";
  } else if (needsFuel && st.fuelLeft <= 0 && !fuelOnHand) {
    overlay = "Out of fuel!";
  } else {
    // Custom per-recipe green-bar text: the cook loaded these ingredients
    // themselves, so this is feedback, not a spoiler. The Recipes list
    // still only shows discovered recipes. The live countdown is appended
    // automatically; without custom text the bar keeps the legacy
    // "<Recipe name>… <time> left" shape.
    let text = craftProgressLabel(p, recipe, items);
    if (!recipe.progressText) text += "…";
    overlay = text + " " + formatCraftFixed((1 - st.progress) * eff) + "s left";
  }
  if (craftUI.progText.textContent !== overlay) craftUI.progText.textContent = overlay;
}

// A recipe is affordable when every input material is held in full -
// counting what the plan already holds in its slots, not just the
// Inventory. A "tag:" input counts every held item carrying the tag.
// Autofill moves everything held into the slots, so a loaded,
// running recipe must not glow red: only a truly exhausted stock (held +
// slotted together still short) goes red. Counts the given plan's item
// and fuel slots - slotted stacks unload back, so nothing there is lost.
// Input-less recipes are never affordable (the engine refuses to run
// them, and load-validation strips them) so the button and the tick agree.
function craftHeldFor(planId, key) {
  const ids = ((typeof isTagInputKey === "function") && isTagInputKey(key)) ? tagInputItems(key) : [key];
  let n = 0;
  for (const id of ids) n += state.amounts[id] ?? 0;
  const st = planId && state.crafting && state.crafting.plans ? state.crafting.plans[planId] : null;
  if (st) {
    for (const s of st.items ?? []) if (s && ids.includes(s.id)) n += s.n;
    if (st.fuel && ids.includes(st.fuel.id)) n += st.fuel.n;
  }
  return n;
}
function recipeAffordable(r, planId) {
  const inputs = Object.entries(r.inputs ?? {});
  if (!inputs.length) return false;
  for (const [id, n] of inputs) if (craftHeldFor(planId, id) < n) return false;
  return true;
}

function renderCraftRecipes(g, p) {
  if (!p) { craftUI.recipesCtn.innerHTML = ""; craftUI.recipesSig = "none"; return; }
  const st = planState(p.id);
  const known = discoveredRecipes(p.id);
  const total = (p.recipes ?? []).length;
  // Hiding joins the sig so arming the mode (or striking a recipe)
  // rebuilds: hidden recipes show struck-through while armed, hide after.
  const hideBits = (p.recipes ?? []).map(r => itemHidden(craftRecipeHideKey(p.id, r.id)) ? "0" : "1").join("");
  const sig = p.id + "|" + known.map(r => r.id).join(",") + "|" + (st ? st.selRecipe : "-") + "|" + (hidingMode.recipes ? 1 : 0) + "|" + hideBits;
  if (craftUI.recipesSig === sig) return;
  craftUI.recipesSig = sig;
  craftUI.recipesCtn.innerHTML = "";
  craftUI.recipesCtn._affordBtns = null; // cached nodes (see syncCraftRecipeAfford) die with the rebuild
  let shown = 0;
  for (const r of known) {
    const rHidden = itemHidden(craftRecipeHideKey(p.id, r.id));
    if (rHidden && !hidingMode.recipes) continue;
    shown++;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "craftRecipeBtn" + (st && st.selRecipe === r.id ? " on" : "") + (rHidden ? " userHidden" : "");
    const lab = document.createElement("span");
    lab.className = "craftRecipeLabel";
    lab.textContent = r.name;
    b.appendChild(lab);
    // Recipe tooltip: ingredients and results, item-tip style (same
    // fixed-detach pattern, so it opens full-size over the panel). The
    // Ingredients rows register live refs so the open tip re-tints every
    // frame, exactly like action/upgrade cost rows.
    const costRefs = [];
    const tip = buildCraftRecipeTip(p, g, r, costRefs);
    b.appendChild(tip);
    b._recipe = r;
    b._recipeLabel = lab;
    b._recipePlan = p.id;
    b._tipCosts = costRefs;
    b._tipCostMap = r.inputs ?? {};
    b._recipeTime = tip._timeRef ?? null;
    const fitRecipe = () => {
      if (typeof placeCraftPlanTip === "function") placeCraftPlanTip(tip, b);
      else if (typeof fitTip === "function") { fitTip(tip, b, "up"); if (typeof syncTipPointer === "function") syncTipPointer(b, true); }
      activeCraftPlanTip = { btn: b, tip };
    };
    const unfitRecipe = () => {
      if (activeCraftPlanTip && activeCraftPlanTip.btn === b) activeCraftPlanTip = null;
      if (typeof clearCraftPlanTip === "function") clearCraftPlanTip(tip);
    };
    b.addEventListener("mouseenter", fitRecipe);
    b.addEventListener("focus", fitRecipe);
    b.addEventListener("mouseleave", unfitRecipe);
    b.addEventListener("blur", unfitRecipe);
    // Clicking a recipe selects it: the plan fills from the Inventory
    // (ingredients plus fuel when it burns any). In hiding mode the
    // click strikes it hidden instead (click again to unhide).
    b.addEventListener("click", () => {
      if (hidingMode.recipes) { toggleItemHidden(craftRecipeHideKey(p.id, r.id)); return; }
      autofillCraftRecipe(p.id, r.id);
    });
    craftUI.recipesCtn.appendChild(b);
  }
  if (!shown && known.length) {
    const d = document.createElement("div");
    d.className = "emptyNote";
    const hidden = known.length - shown;
    d.textContent = hidden === 1 ? "1 recipe hidden." : hidden + " recipes hidden.";
    craftUI.recipesCtn.appendChild(d);
  }
  if (known.length < total) {
    const d = document.createElement("div");
    d.className = "emptyNote";
    d.textContent = (total - known.length) + " undiscovered " + ((total - known.length) === 1 ? "recipe" : "recipes") + ".";
    craftUI.recipesCtn.appendChild(d);
  }
  if (!total) {
    const d = document.createElement("div");
    d.className = "emptyNote";
    d.textContent = "No recipes yet.";
    craftUI.recipesCtn.appendChild(d);
  }
}

// Recipe tooltip body: header, the recipe's own craft time (live: Speed
// stats shorten it - refreshed every frame while open, see
// renderCrafting), plus Ingredients and Results sections.
// The Ingredients rows take live refs so the open tip re-tints short
// rows red every frame (same as action/upgrade cost rows).
function buildCraftRecipeTip(p, g, r, costRefs) {
  const tip = document.createElement("span");
  tip.className = "tip";
  const head = document.createElement("div");
  head.className = "tip-head";
  const title = document.createElement("span");
  title.textContent = r.name ?? r.id;
  head.appendChild(title);
  tip.appendChild(head);
  {
    const { sec, body } = makeTipSection("Time");
    const row = document.createElement("div");
    row.className = "tip-row";
    const v = document.createElement("span");
    v.textContent = "Time: " + formatCraftFixed(recipeEffTime(r, p, g)) + " per craft";
    row.appendChild(v);
    body.appendChild(row);
    tip.appendChild(sec);
    tip._timeRef = { el: v, recipe: r, plan: p, group: g };
  }
  appendTipSection(tip, "Ingredients", r.inputs ?? {}, costRefs);
  appendTipSection(tip, "Results", r.outputs ?? {});
  return tip;
}

// Red "Name*" on recipes short of materials (same as actions/upgrades).
// Runs every frame outside the rebuild sig so gathering/consuming updates
// the buttons live without recreating them (a rebuild would kill the
// hovered/focused button mid-tip). Writes only on change.
function syncCraftRecipeAfford() {
  if (!craftUI || !craftUI.recipesCtn) return;
  // Recipe buttons only change on rebuild (see renderCraftRecipes): cache
  // the node list instead of re-querying every frame.
  const btns = craftUI.recipesCtn._affordBtns ?? (craftUI.recipesCtn._affordBtns = [...craftUI.recipesCtn.querySelectorAll(":scope > .craftRecipeBtn")]);
  for (const b of btns) {
    const r = b._recipe;
    if (!r || !b._recipeLabel) continue;
    const short = !recipeAffordable(r, b._recipePlan);
    const sig = (short ? 1 : 0) + "|" + r.name;
    if (b._affordSig === sig) continue;
    b._affordSig = sig;
    b._recipeLabel.textContent = r.name + (short ? "*" : "");
    b._recipeLabel.style.color = short ? "red" : "";
  }
}

// Red plan names when the group's station is gone (same red treatment as
// short recipes, minus the star). Runs every frame outside the rebuild sig
// so selling/buying the station repaints the rail live without recreating
// it (a rebuild would kill the hovered/focused button mid-tip). Writes
// only on change.
function syncCraftPlanStation() {
  if (!craftUI || !craftUI.plansCtn) return;
  // Plan buttons only change on rebuild (see renderCraftPlans): cache
  // the node list instead of re-querying every frame.
  const btns = craftUI.plansCtn._planBtns ?? (craftUI.plansCtn._planBtns = [...craftUI.plansCtn.querySelectorAll(":scope > .craftPlanRow")]);
  for (const b of btns) {
    if (!b._plan || !b._planLabel) continue;
    const missing = !ownsCraftingStation(b._planGroup);
    const sig = (missing ? 1 : 0) + "|" + b._plan.id;
    if (b._planSig === sig) continue;
    b._planSig = sig;
    b._planLabel.style.color = missing ? "red" : "";
  }
}
