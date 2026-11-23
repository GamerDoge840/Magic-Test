// Labor Game inventory: item grid, rarity filters, consuming.
// Rarity colors live in CSS (.rar-* in both index.html copies, dark + light
// variants) - JS only picks the class (see itemRarityClass), never a hex,
// so light mode stays readable without a JS-side palette to drift.

// Rarity class for an item's name (inventory cells, item tooltips, gather
// log bullets). Classes - not inline styles - so the light-mode CSS block
// can re-tone them for white backgrounds (common is near-white in dark
// mode). Unknown rarities fall back to common, matching validation.
function itemRarityClass(def) {
  const r = (def && def.rarity) || "common";
  const order = (typeof RARITY_ORDER !== "undefined" && RARITY_ORDER.length) ? RARITY_ORDER : ["common"];
  return "rar-" + (order.includes(r) ? r : "common");
}

function itemRarityName(rid) {
  return rid ? rid.charAt(0).toUpperCase() + rid.slice(1) : rid;
}

// Rarity-chip counts cover displayable cells: seen items passing the
// OTHER dimension's filter and the empty rule, so every chip number
// matches the cells its click would show. Type chips instead sum the
// units held across those same cells (see invTypeCountFor). Counts
// refresh every render (see renderInventory), so gathering/consuming
// updates them live.
function invCountBase(except, preTags) {
  const r = invRarity(), t = invType(preTags);
  return ITEMS.filter(it => {
    if (!(state.seen && state.seen[it.id])) return false;
    if (!invEmptyVisible(it)) return false;
    if (except !== "rarity" && !(r === "all" || (it.rarity ?? "common") === r)) return false;
    if (except !== "type" && !invTypeMatch(it, t)) return false;
    return true;
  });
}

function invCountFor(r) {
  const base = invCountBase("rarity");
  if (r === "all") return base.length;
  return base.filter(it => (it.rarity ?? "common") === r).length;
}

// Type chips count UNITS held (per-quantity), not distinct items: with 6
// Twigs and nothing else held, "Materials (6)". Rarity chips still count
// displayable cells. The sums follow the other dimension's filter + the
// empty rule via invCountBase, so they always match the shown holdings.
function invTypeCountFor(t) {
  const base = invCountBase("type");
  const inType = t === "all" ? base : base.filter(it => invTypeMatch(it, t));
  return inType.reduce((n, it) => n + Math.max(0, Math.floor(state.amounts[it.id] ?? 0)), 0);
}

function invChipLabel(name, n) {
  return name + " (" + n + ")";
}

// Single-pass chip math for the per-tick repaint: one walk over ITEMS
// yields every rarity-cell count and every type-unit sum, instead of one
// full scan per chip (~20 scans/tick). Same gates as invCountBase, so
// the numbers match the cells exactly:
// - rarity chips (incl. "All") count displayable cells over the base
//   that ignores the rarity dimension;
// - type chips (incl. "All") sum held units over the base that ignores
//   the type dimension (tags exact-match, consumable skipped).
// Like invCountBase, the search query is NOT a chip gate (chips stay
// stable while typing; the grid cells apply the query).
function invChipTotals(preTags) {
  const r = invRarity(), t = invType(preTags);
  const hideEmpty = hideEmptyInv();
  const rar = new Map();
  let rarTotal = 0;
  const typ = new Map();
  let typTotal = 0;
  const cat = new Map();
  for (const catName of Object.keys(INV_TYPE_CATEGORIES)) cat.set(catName, 0);
  for (const it of ITEMS) {
    if (!(state.seen && state.seen[it.id])) continue;
    const owned = Math.max(0, Math.floor(state.amounts[it.id] ?? 0));
    if (!(owned > 0 || !hideEmpty)) continue;
    if (invTypeMatch(it, t)) {
      rarTotal++;
      const rid = it.rarity ?? "common";
      rar.set(rid, (rar.get(rid) ?? 0) + 1);
    }
    if (r === "all" || (it.rarity ?? "common") === r) {
      typTotal += owned;
      for (const tag of new Set(getTags(it))) {
        if (String(tag).toLowerCase() === "consumable") continue;
        typ.set(tag, (typ.get(tag) ?? 0) + owned);
      }
      // Category totals: OR across the category tag + its sub-types, so
      // an item with two sub-types of one category still counts once.
      for (const [catName, subs] of Object.entries(INV_TYPE_CATEGORIES)) {
        const tags = getTags(it);
        if (tags.includes(catName) || subs.some(s => tags.includes(s))) {
          cat.set(catName, (cat.get(catName) ?? 0) + owned);
        }
      }
    }
  }
  // Category chips read the OR totals above, not the raw-tag sums (e.g.
  // "Food" counts greenleaf's Foraged even though it lacks the Food tag).
  for (const [catName, n] of cat) typ.set(catName, n);
  return { rar, rarTotal, typ, typTotal };
}

function invRarityChipLabel(r, n) {
  return invChipLabel(r === "all" ? "All" : itemRarityName(r), n);
}

// Display plurals for type-filter chips ("Herb" -> "Herbs"). Uncountable
// tags like "Food" are intentionally absent and render as-is.
const INV_TYPE_PLURALS = { Herb: "Herbs", Plank: "Planks" };

// Inventory type categories: top-level chips grouping sub-type tags, so a
// handful of categories replaces the flat per-tag clutter. Food holds the
// edible sub-types (Fruit, Roasted, Meal), Materials holds the wild-found
// ones (Foraged, Fuel) plus Wood and Plank, and Reagents holds Herbs (raw tag "Herb", displayed
// "Herbs"). A category chip filters to items carrying the category tag OR
// any of its sub-types; a sub-type chip filters to that exact tag. Any seen
// tag outside the map (future content) falls back to a plain top-level chip
// (see orphans).
const INV_TYPE_CATEGORIES = {
  Food: ["Fruit", "Roasted", "Meal"],
  Materials: ["Foraged", "Fuel", "Wood", "Plank"],
  Reagents: ["Herb"],
};

const INV_SUBTYPE_PARENT = {};
for (const [cat, subs] of Object.entries(INV_TYPE_CATEGORIES)) {
  for (const s of subs) INV_SUBTYPE_PARENT[s] = cat;
}

function invIsCategory(v) {
  return Object.prototype.hasOwnProperty.call(INV_TYPE_CATEGORIES, v);
}

function invCategoryOfSubtype(s) {
  return INV_SUBTYPE_PARENT[s] ?? null;
}

function invActiveCategory(type) {
  if (invIsCategory(type)) return type;
  return invCategoryOfSubtype(type);
}

function invTypeChipLabel(t, n) {
  if (t === "all") return invChipLabel("All", n);
  // Category names read as plurals ("Herbs"); uncountables ("Food") and
  // anything unmapped keep the raw tag. Tooltips still show the raw tag.
  return invChipLabel(INV_TYPE_PLURALS[t] ?? t, n);
}

// Type filter (by category + sub-type): single-select inline row under the
// header - "All" plus one chip per owned category, plus the active
// category's seen sub-types (and any orphan tags outside the map). A
// category shows only while at least one held item carries any of its
// sub-types; sub-types show only while their parent category is the active
// filter (or holds the active sub-type). An item matches a category when it
// carries the category tag or any of its sub-types, and a sub-type when one
// of its tags is exactly it.
// Lowercase-tag memo: tag strings are static config, so lowercasing is a
// pure function of the tag - computed once per distinct tag instead of
// once per item per tick.
const __tagLowerMemo = new Map();
function lowerTag(t) {
  let lc = __tagLowerMemo.get(t);
  if (lc === undefined) {
    lc = String(t).toLowerCase();
    __tagLowerMemo.set(t, lc);
  }
  return lc;
}
function invVisibleCategories() {
  const out = [];
  for (const cat of Object.keys(INV_TYPE_CATEGORIES)) {
    const subs = INV_TYPE_CATEGORIES[cat];
    let vis = false;
    for (const it of ITEMS) {
      const owned = Math.max(0, Math.floor(state.amounts[it.id] ?? 0));
      if (!(owned > 0)) continue;
      if (!(state.seen && state.seen[it.id])) continue;
      const tags = getTags(it);
      if (subs.some(s => tags.includes(s))) { vis = true; break; }
    }
    if (vis) out.push(cat);
  }
  return out;
}
function invVisibleSubtypes(cat) {
  const subs = INV_TYPE_CATEGORIES[cat] ?? [];
  return subs.filter(s => ITEMS.some(it => (state.seen && state.seen[it.id]) && getTags(it).includes(s)));
}
function invOrphanTypeTags() {
  // Seen tags outside the category map (future content): same coverage +
  // seen gates as the old flat row, so nothing new ever hides silently.
  const total = new Map(); // tag -> { n, seen }
  for (const it of ITEMS) {
    const seen = !!(state.seen && state.seen[it.id]);
    for (const t of new Set(getTags(it))) {
      if (lowerTag(t) === "consumable") continue;
      if (invIsCategory(t) || invCategoryOfSubtype(t)) continue;
      let e = total.get(t);
      if (!e) { e = { n: 0, seen: false }; total.set(t, e); }
      e.n++;
      if (seen) e.seen = true;
    }
  }
  const n = ITEMS.length;
  const out = [];
  for (const [t, e] of total) {
    if (e.n >= n) continue;
    if (e.seen) out.push(t);
  }
  return out.sort();
}
function invTypeTags() {
  // Visible UI values in row order: owned categories (config order), then
  // the active category's seen sub-types (config order), then orphans.
  // Read from the raw option (not invType()) to avoid a cycle: the active
  // category is whatever is selected, even while its chip is hidden.
  const raw = state.options.invType;
  const cats = invVisibleCategories();
  const active = invActiveCategory(raw);
  const subs = (active && cats.includes(active)) ? invVisibleSubtypes(active)
    : (active && invIsCategory(active)) ? [] : [];
  // A selected-but-currently-hidden sub-type must stay in the list (and the
  // filter must stay valid) until the player picks something else.
  if (raw !== "all" && !invIsCategory(raw) && !subs.includes(raw) && invCategoryOfSubtype(raw)) subs.push(raw);
  return [...cats, ...subs, ...invOrphanTypeTags()];
}

function invType(preTags) {
  const t = state.options.invType;
  if (t === "all" || (preTags ?? invTypeTags()).includes(t)) return t;
  return "all";
}

function setInvType(t) {
  state.options.invType = t;
  render();
}

function invTypeMatch(it, t) {
  if (t === "all") return true;
  if (invIsCategory(t)) {
    const tags = getTags(it);
    if (tags.includes(t)) return true;
    const subs = INV_TYPE_CATEGORIES[t] ?? [];
    return subs.some(s => tags.includes(s));
  }
  return getTags(it).includes(t);
}
// Inventory search: substring over the item name plus its tags
// (case-insensitive). Empty query matches everything; AND-combined with
// the rarity/type/empty filters in renderInventory. Plural-aware: the
// haystack also carries the item's plural name, plural tag names (via
// INV_TYPE_PLURALS), and singular word variants, so "herbs", "apples",
// "twigs", "berries", and "greenleaves" match just like "herb", "apple",
// "twig", "berry", and "greenleaf" - in both directions ("material"
// finds the "Materials" tag too). The original name+tags phrase stays
// intact first, so multi-word queries ("apple food") keep matching
// contiguously.
function invWordSingulars(w) {
  const out = [];
  if (w.length > 3 && !w.endsWith("ss")) {
    if (w.endsWith("ies")) out.push(w.slice(0, -3) + "y");
    else if (w.endsWith("es")) { out.push(w.slice(0, -2)); out.push(w.slice(0, -1)); }
    else if (w.endsWith("s")) out.push(w.slice(0, -1));
  }
  return out;
}
// Per-item search haystack, cached per def object: the name + tags +
// plural/singular variants, lowercased once instead of rebuilt (with
// several Set allocations and regex splits) on every tick for every
// cell. Def objects are static config; runtime-added defs compute on
// first use and GC with the def when popped.
const __invHayCache = new WeakMap();
function invSearchHay(it) {
  let h = __invHayCache.get(it);
  if (h === undefined) {
    const tags = getTags(it);
    const base = (it.name + " " + tags.join(" ")).toLowerCase();
    const words = new Set(base.split(/[^a-z0-9]+/));
    const extra = [];
    if (typeof it.plural === "string" && it.plural) extra.push(it.plural);
    for (const t of tags) {
      const p = INV_TYPE_PLURALS[t];
      if (p) extra.push(p);
    }
    // Parent categories join the haystack ("reagents" finds Herb items),
    // so the search keeps working after the flat tags become sub-types.
    if (typeof INV_SUBTYPE_PARENT !== "undefined") {
      for (const t of tags) {
        const c = INV_SUBTYPE_PARENT[t];
        if (c) extra.push(c);
      }
    }
    for (const w of extra.join(" ").toLowerCase().split(/[^a-z0-9]+/)) if (w) words.add(w);
    for (const w of [...words]) for (const v of invWordSingulars(w)) if (v && !words.has(v)) { words.add(v); extra.push(v); }
    h = (base + " " + extra.join(" ")).toLowerCase();
    __invHayCache.set(it, h);
  }
  return h;
}

function invSearchMatch(it, q, qSing) {
  if (!q) return true;
  const hay = invSearchHay(it);
  // Whole-query singular fallbacks ("fuels" -> "fuel", "foods" -> "food",
  // "consumables" -> "consumable", "cooked apples" -> "cooked apple"):
  // plural forms with no haystack-side plural (uncountable tags like Food
  // have no INV_TYPE_PLURALS entry) still find their singular.
  if (hay.includes(q)) return true;
  return (qSing ?? invWordSingulars(q)).some(v => hay.includes(v));
}

// Hide-empty option (on by default): exhausted items (owned 0) hide
// instead of showing grayed-out. Items never obtained stay hidden
// either way (the seen gate in renderInventory is unconditional).
function hideEmptyInv() {
  return !state.options || state.options.hideEmptyInv !== false;
}

function invEmptyVisible(it) {
  return (state.amounts[it.id] ?? 0) > 0 || !hideEmptyInv();
}

// Current rarity filter ("all" or a rarity id); unknown values from old
// saves fall back to "all" instead of hiding everything.
function invRarity() {
  const r = state.options.invRarity;
  if (r === "all" || ((typeof RARITY_ORDER !== "undefined" ? RARITY_ORDER : []).includes(r))) return r;
  return "all";
}

function setInvRarity(r) {
  state.options.invRarity = r;
  render();
}

// An item is edible when it carries the "consumable" tag with a valid
// consume bundle (see normalizeConfig).
function itemEdible(def) {
  return !!def && getTags(def).includes("consumable") && !!def.consume;
}

function buildInventoryTab() {
  const filterRow = document.getElementById("invFilterRow");
  const grid = document.getElementById("invGridCtn");
  if (!filterRow || !grid) return;
  filterRow.innerHTML = "";
  filterRow._chips = null; // cached nodes (see renderInventory) die with the rebuild
  const label = document.createElement("span");
  label.textContent = "Rarity:";
  filterRow.appendChild(label);
  const order = (typeof RARITY_ORDER !== "undefined" && RARITY_ORDER.length) ? RARITY_ORDER : ["common"];
  const filters = ["all", ...order];
  for (const r of filters) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.rarity = r;
    // Chips wear their rarity's color (same palette as item names); "All"
    // keeps the default button color. Classes survive the render-time label
    // rewrites (textContent only), and the CSS wins over the button color.
    if (r !== "all" && typeof itemRarityClass === "function") b.classList.add(itemRarityClass({ rarity: r }));
    const n = invCountFor(r);
    b.textContent = invRarityChipLabel(r, n);
    b.classList.toggle("active", invRarity() === r);
    b.addEventListener("click", () => setInvRarity(r));
    filterRow.appendChild(b);
  }
  buildInvTypeRow();
  buildInvTypeSubRow();
  buildSellRow();
  grid.innerHTML = "";
  if (!ITEMS.length) {
    const d = document.createElement("div");
    d.className = "emptyNote";
    d.textContent = "No items yet.";
    grid.appendChild(d);
    return;
  }
  for (const it of ITEMS) grid.appendChild(buildInventoryCell(it));
}

// Secondary inline filter rows under the header: the main row holds "All"
// plus owned category chips (and any orphan tags outside the map); the sub
// row below it holds an "All" chip (the whole category at once) plus the
// active category's sub-type chips. Single-select
// like the rarity chips, AND-combined with rarity. The main row hides when
// no category is owned yet; the sub row hides unless a category (or one of
// its sub-types) is selected.
function invTopLevelTypes() {
  const tags = invTypeTags();
  const raw = state.options.invType;
  const activeCat = invActiveCategory(raw === "all" ? invType(tags) : raw);
  return tags.filter(t => invIsCategory(t) || !invCategoryOfSubtype(t) || invCategoryOfSubtype(t) !== activeCat);
}

function invSubRowTypes() {
  const tags = invTypeTags();
  const raw = state.options.invType;
  const activeCat = invActiveCategory(raw === "all" ? invType(tags) : raw);
  if (!activeCat) return [];
  return tags.filter(t => !invIsCategory(t) && invCategoryOfSubtype(t) === activeCat);
}

function buildInvTypeRow() {
  const typeRow = document.getElementById("invTypeRow");
  if (!typeRow) return;
  typeRow.innerHTML = "";
  typeRow._chips = null; // cached nodes (see renderInventory) die with the rebuild
  const tags = invTopLevelTypes();
  typeRow.hidden = !tags.length;
  if (!tags.length) return;
  const label = document.createElement("span");
  label.textContent = "Type:";
  typeRow.appendChild(label);
  const activeCat = invActiveCategory(state.options.invType);
  for (const t of ["all", ...tags]) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.invtype = t;
    b.textContent = invTypeChipLabel(t, invTypeCountFor(t));
    b.classList.toggle("active", invType() === t);
    if (activeCat && t === activeCat) b.classList.add("in-cat");
    b.addEventListener("click", () => setInvType(t));
    typeRow.appendChild(b);
  }
}

// Sub-type row below the main Type row: an "All" chip (the whole active
// category at once, same filter as its main-row chip) plus the active
// category's sub-type chips (see invSubRowTypes). Hidden unless a category
// is selected.
function buildInvTypeSubRow() {
  const subRow = document.getElementById("invTypeSubRow");
  if (!subRow) return;
  subRow.innerHTML = "";
  subRow._chips = null; // cached nodes (see renderInventory) die with the rebuild
  const tags = invSubRowTypes();
  subRow.hidden = !tags.length;
  if (!tags.length) return;
  const label = document.createElement("span");
  label.textContent = "Sub-type:";
  subRow.appendChild(label);
  // "All" first: the whole category (every sub-type at once) without
  // leaving the row - same filter as the category's main-row chip.
  const activeCat = invActiveCategory(state.options.invType);
  if (activeCat) {
    const allB = document.createElement("button");
    allB.type = "button";
    allB.dataset.invtype = activeCat;
    allB.classList.add("sub");
    allB._subAll = true;
    allB.textContent = "All (" + invTypeCountFor(activeCat) + ")";
    allB.classList.toggle("active", invType() === activeCat);
    allB.addEventListener("click", () => setInvType(activeCat));
    subRow.appendChild(allB);
  }
  for (const t of tags) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.invtype = t;
    b.classList.add("sub");
    b.textContent = invTypeChipLabel(t, invTypeCountFor(t));
    b.classList.toggle("active", invType() === t);
    b.addEventListener("click", () => setInvType(t));
    subRow.appendChild(b);
  }
}

function buildInventoryCell(it) {
  const cell = document.createElement("div");
  cell.className = "invCell";
  cell.id = "inv-" + it.id;
  const nm = document.createElement("span");
  nm.className = "invName";
  nm.textContent = it.name;
  if (typeof itemRarityClass === "function") nm.classList.add(itemRarityClass(it));
  const count = document.createElement("span");
  count.className = "invCount";
  cell.appendChild(nm);
  cell.appendChild(count);
  if (itemEdible(it)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "invConsumeBtn";
    btn.textContent = (it.consume && it.consume.button) || "Consume";
    btn.addEventListener("click", (e) => consumeItem(it.id, !!(e && e.shiftKey)));
    cell.appendChild(btn);
    uiRefs.set("i:" + it.id, { root: cell, name: nm, count, consume: btn, tipCount: null, tip: null });
  } else {
    // Invisible spacer where the Consume button would go: keeps every box
    // the same height whether or not the item is edible, so mixed rows
    // (Apple beside Greenleaf) don't shift. Never interactive.
    const spacer = document.createElement("button");
    spacer.type = "button";
    spacer.className = "invConsumeBtn invConsumeSpacer";
    spacer.textContent = "Consume";
    spacer.tabIndex = -1;
    spacer.setAttribute("aria-hidden", "true");
    cell.appendChild(spacer);
    uiRefs.set("i:" + it.id, { root: cell, name: nm, count, tipCount: null, tip: null });
  }
  // Tooltip: header (name + count), tag chips, description, rarity, and
  // what consuming grants for edibles.
  const tip = document.createElement("span");
  tip.className = "tip";
  const head = document.createElement("div");
  head.className = "tip-head";
  const title = document.createElement("span");
  title.textContent = it.name;
  if (typeof itemRarityClass === "function") title.classList.add(itemRarityClass(it));
  const tc = document.createElement("span");
  tc.className = "tip-count";
  head.appendChild(title);
  head.appendChild(tc);
  tip.appendChild(head);
  const headTags = buildTipTags(it);
  if (headTags) tip.appendChild(headTags);
  if (it.description) {
    const desc = document.createElement("div");
    desc.className = "tip-desc";
    desc.textContent = it.description;
    tip.appendChild(desc);
  }
  {
    const { sec, body } = makeTipSection("Rarity");
    const row = document.createElement("div");
    row.className = "tip-row";
    const s = document.createElement("span");
    s.textContent = itemRarityName(it.rarity ?? "common");
    if (typeof itemRarityClass === "function") s.classList.add(itemRarityClass(it));
    row.appendChild(s);
    body.appendChild(row);
    tip.appendChild(sec);
  }
  if (typeof it.fuel === "number" && isFinite(it.fuel) && it.fuel > 0) {
    const { sec, body } = makeTipSection("Fuel");
    const row = document.createElement("div");
    row.className = "tip-row";
    const s = document.createElement("span");
    s.textContent = "Fuel value: " + formatNum(it.fuel);
    row.appendChild(s);
    body.appendChild(row);
    tip.appendChild(sec);
  }
  if (itemEdible(it) && typeof itemNutritionMult === "function" && itemNutritionMult(it) > 1) {
    const { sec, body } = makeTipSection("Nutrition");
    const row = document.createElement("div");
    row.className = "tip-row";
    const s = document.createElement("span");
    s.textContent = "Overheals Stamina up to " + Math.round(itemNutritionMult(it) * 100) + "% of max";
    row.appendChild(s);
    body.appendChild(row);
    tip.appendChild(sec);
  }
  if (itemEdible(it)) appendTipSection(tip, "Consuming grants", it.consume.gains ?? {});
  let sellWarn = null;
  if (itemSellable(it)) {
    appendTipSection(tip, "Sells for", it.sellPrice ?? {});
    // Cap-overflow warning: same live notice as furniture sell tips
    // ("Selling 3 would destroy 1.5 Coins over the cap."). Refreshed on
    // hover/focus and on renders; hidden while nothing would overflow.
    sellWarn = document.createElement("div");
    sellWarn.className = "tip-flavor tip-overflow tip-teal";
    sellWarn.hidden = true;
    tip.appendChild(sellWarn);
  }
  cell.appendChild(tip);
  const ref = uiRefs.get("i:" + it.id);
  if (ref) { ref.tipCount = tc; ref.tip = tip; ref.sellWarn = sellWarn; }
  // Inventory rows join the shared highlight system, so item costs and
  // payouts ring them exactly like currencies (see hiResources).
  if (typeof pushResourceRef === "function") pushResourceRef(it.id, uiRefs.get("i:" + it.id));
  cell.tabIndex = 0;
  // Selling Mode: clicking the cell body (not its buttons) sells the
  // current amount. The Consume button keeps working while armed.
  cell.addEventListener("click", (e) => {
    if (!invSelling) return;
    if (e.target && e.target.closest && e.target.closest("button")) return;
    sellItem(it.id);
  });
  // Automatic placement: item tips detach via position:fixed (same pattern
  // as skill/furniture tips) and use viewport room, so tips in the
  // scrolling item grid open full-size instead of clipping at the grid's
  // edges (top-row tips opened upward, off-screen). The node stays in
  // place, so the :hover/:focus-visible show rules keep working;
  // leave/blur clears the inline positioning again. Scroll/resize while
  // open re-places.
  const cellTip = ref.tip;
  const fitInv = () => {
    syncItemSellWarn(it, ref);
    if (typeof placeInvTip === "function") placeInvTip(cellTip, cell);
    activeInvTip = { cell, tip: cellTip };
  };
  const unfitInv = () => {
    if (activeInvTip && activeInvTip.cell === cell) activeInvTip = null;
    if (typeof clearInvTip === "function") clearInvTip(cellTip);
  };
  cell.addEventListener("mouseenter", fitInv);
  cell.addEventListener("focus", fitInv);
  cell.addEventListener("mouseleave", unfitInv);
  cell.addEventListener("blur", unfitInv);
  return cell;
}

// Item tip placement: viewport-roomed fixed detach (same pattern as
// skill/furniture/world tips). The item grid scrolls internally, so an
// in-grid tip clips at the grid's edges; detached, it opens full-size
// over neighboring panels instead.
let activeInvTip = null; // { cell, tip } of the open item tip
function placeInvTip(tip, anchor) {
  return fitDetachedTip(tip, anchor, { prefer: "up", forceShow: true });
}

function clearInvTip(tip) {
  return clearDetachedTip(tip);
}

// While an item tip is open, scrolling or resizing would strand its fixed
// pixels away from the anchor: re-place instead.
if (typeof window !== "undefined" && !window.__invTipTrack) {
  window.__invTipTrack = true;
  const retrackInvTip = () => {
    if (activeInvTip && activeInvTip.cell && activeInvTip.cell.isConnected) {
      const tip = activeInvTip.tip;
      if (tip && tip.isConnected && getComputedStyle(tip).display !== "none" && typeof placeInvTip === "function") placeInvTip(tip, activeInvTip.cell);
    }
  };
  window.addEventListener("scroll", retrackInvTip, true);
  window.addEventListener("resize", retrackInvTip);
}

// Eating at full bars wastes the food: the Consume button grays out while
// every gain target sits at its cap (uncapped targets always have room,
// so mixed bundles stay clickable). Also guards consumeItem itself, since
// a bar can fill between the last render and the click.
// Nutrition (Meal overheal): an item with nutrition N lets its own Stamina
// grants exceed the cap up to max x N (e.g. nutrition 1.15 = up to 115% of
// max). Only Stamina overheals, and only for edible items - bad values are
// stripped at validation so this is just a second guard.
function itemNutritionMult(it) {
  return (it && typeof it.nutrition === "number" && Number.isFinite(it.nutrition) && it.nutrition > 1) ? it.nutrition : 1;
}
function itemOverhealCeil(it, rid) {
  const max = (typeof getEffectiveMax === "function") ? getEffectiveMax(rid) : Infinity;
  if (max === Infinity) return Infinity;
  return (rid === OVERHEAL_RESOURCE && itemEdible(it)) ? max * itemNutritionMult(it) : max;
}
// Highest edible nutrition multiplier on any item: bounds how far past the
// cap Stamina may legitimately sit, so save/load keeps overheal instead of
// clamping it back to the cap (see save.js).
function maxNutritionMult() {
  let m = 1;
  if (typeof ITEMS !== "undefined") for (const it of ITEMS) {
    if (!itemEdible(it)) continue;
    const n = itemNutritionMult(it);
    if (n > m) m = n;
  }
  return m;
}
function consumeFullyCapped(it) {
  const gains = (it && it.consume && it.consume.gains) || {};
  const ids = Object.keys(gains);
  if (!ids.length || typeof getEffectiveMax !== "function") return false;
  return ids.every(rid => {
    // A meal still has room while Stamina sits below its own overheal
    // ceiling (max x nutrition), not just below the cap.
    const ceil = (typeof itemOverhealCeil === "function") ? itemOverhealCeil(it, rid) : getEffectiveMax(rid);
    return ceil !== Infinity && (state.amounts[rid] ?? 0) >= ceil;
  });
}
// Eat one unit: pays nothing, grants the consume bundle through the
// normal capped grants (excess over a cap is destroyed, like actions),
// then logs the bite. Only edible, owned items run.
// The logged gains keep the targeted Vital's color: "You eat an apple."
// shows "+1 Stamina" in Stamina's own color (its bar color, like the
// Vitals panel), and the same holds for any other gain target.
function gainDisplayColor(rid) {
  // Resources carry their own display colors (nameColor/barColor in config).
  // Item gains are class-colored where they render (gather bullets wear
  // itemRarityClass; consume/sell lines only ever pay resources).
  const r = (typeof getResource === "function") ? getResource(rid) : null;
  if (!r) return null;
  return r.nameColor ?? r.barColor ?? null;
}

// Consume log line with precise Stamina accounting: under-cap gains read as
// "+N Stamina" while overhealed gains read as "also overhealing by +M"
// ("You eat a plain salad. (+1 Stamina, also overhealing by +1.5)").
// Overhealing is only mentioned when it actually happens - a meal eaten
// fully under the cap logs bare gains ("(+4 Stamina)"), exactly like
// plain foods. `gains` carries non-Stamina actuals, `split` the Stamina
// actuals ({under, over}); merged repeats accumulate running totals the
// same way. Amounts are actual grants (clamped), never nominal - a
// near-cap apple logs "+0.5 Stamina", not "+1.25".
function logConsume(base, gains, mergeKey, it, split) {
  const entries = Object.entries(gains ?? {}).filter(([rid, n]) => rid !== OVERHEAL_RESOURCE && n > 0);
  const under = (split && split.under > 1e-9) ? split.under : 0;
  const over = (split && split.over > 1e-9) ? split.over : 0;
  const hasUnder = under > 0, hasOver = over > 0;
  if (!entries.length && !hasUnder && !hasOver) { log(base, "consume", mergeKey); return; }
  const stamDef = (typeof getResource === "function") ? getResource(OVERHEAL_RESOURCE) : null;
  const stamN = hasUnder ? under : over;
  const stamLabel = "+" + formatNum(stamN) + " " + (stamDef ? displayName(stamDef, stamN) : "Stamina");
  const overLabel = "+" + formatNum(over);
  const label = ([rid, n]) => {
    const def = (typeof getResource === "function") ? getResource(rid) : null;
    return "+" + formatNum(n) + " " + (def ? displayName(def, n) : rid);
  };
  let plain = base + " (";
  let first = true;
  const pushPlain = (t) => { if (!first) plain += ", "; first = false; plain += t; };
  for (const e of entries) pushPlain(label(e));
  if (hasUnder) pushPlain(stamLabel);
  if (hasOver) pushPlain("also overhealing by " + overLabel);
  plain += ")";
  const fill = (line) => {
    line.appendChild(document.createTextNode(base + " ("));
    let f = true;
    // gain-c marks resource-tinted spans so light mode can darken them;
    // the "also overhealing by" tail stays plain text.
    const pushGain = (t, rid) => {
      if (!f) line.appendChild(document.createTextNode(", "));
      f = false;
      const s = document.createElement("span");
      s.textContent = t;
      s.className = "gain-c";
      const c = gainDisplayColor(rid);
      if (c) s.style.color = c;
      line.appendChild(s);
    };
    for (const e of entries) pushGain(label(e), e[0]);
    if (hasUnder) pushGain(stamLabel, OVERHEAL_RESOURCE);
    if (hasOver) {
      if (!f) line.appendChild(document.createTextNode(", "));
      f = false;
      line.appendChild(document.createTextNode("also overhealing by "));
      const s = document.createElement("span");
      s.textContent = overLabel;
      s.className = "gain-c";
      const c = gainDisplayColor(OVERHEAL_RESOURCE);
      if (c) s.style.color = c;
      line.appendChild(s);
    }
    line.appendChild(document.createTextNode(")"));
  };
  if (typeof logRich === "function") logRich(plain, "consume", fill, mergeKey);
  else log(plain, "consume", mergeKey);
}

// Repeat eats and repeat sells accumulate into ONE rewritten line -
// "You consume 2 Apples. (+2 Stamina)" - via the log mergeKey chain,
// instead of the generic back-to-back "(x2)" suffix. Any other log line
// breaks the chain (lastLogMergeKey changes), starting a fresh count.
// Runtime-only, never saved.
let consumeAcc = null; // { key, id, n, gains, under, over }
let sellAcc = null; // { key, id, n, gains }

function logChainAlive(acc) {
  return !!acc && typeof lastLogMergeKey !== "undefined" && lastLogMergeKey === acc.key;
}

function accAdd(dst, src) {
  for (const [rid, n] of Object.entries(src ?? {})) {
    if (!(n > 0)) continue;
    dst[rid] = (dst[rid] ?? 0) + n;
  }
}

function consumeItem(id, maxEat) {
  const it = (typeof getItem === "function") ? getItem(id) : null;
  if (!it || !itemEdible(it)) return;
  if ((state.amounts[id] ?? 0) <= 0) {
    log("None left: " + it.name + ".");
    render();
    return;
  }
  if (consumeFullyCapped(it)) {
    log("You feel too full to eat " + it.name + ".");
    render();
    return;
  }
  // Shift-click max-eats: enough units to fill every capped gain target
  // (never more than owned). The per-unit loop below re-checks the cap
  // each bite, so fractional headroom never overshoots into waste.
  let n = 1;
  if (maxEat) n = Math.max(1, maxEatCount(it));
  for (let i = 0; i < n; i++) {
    if ((state.amounts[id] ?? 0) <= 0) break;
    if (consumeFullyCapped(it)) break;
    eatOneUnit(it);
  }
  render();
}

// Max-eat units for an edible item: the fewest units filling every
// capped gain target (ceil of headroom per unit), bounded by what's
// held. Items with no capped gains (pure uncapped bundles) eat the
// whole stack. Callers guarantee at least one target has room (or no
// caps at all), so this always returns 1+. Meals measure headroom to
// their own overheal ceiling (max x nutrition), not just the cap.
function maxEatCount(it) {
  const owned = Math.floor(state.amounts[it.id] ?? 0);
  if (owned <= 0) return 0;
  const gains = (it.consume && it.consume.gains) || {};
  let need = Infinity, hasCap = false;
  for (const [rid, n] of Object.entries(gains)) {
    if (!(n > 0)) continue;
    const ceil = (typeof itemOverhealCeil === "function") ? itemOverhealCeil(it, rid) : ((typeof getEffectiveMax === "function") ? getEffectiveMax(rid) : Infinity);
    if (ceil === Infinity) continue;
    hasCap = true;
    const room = ceil - (state.amounts[rid] ?? 0);
    if (room <= 0) continue;
    need = Math.min(need, Math.ceil(room / n));
  }
  if (!hasCap) return owned;
  if (!Number.isFinite(need)) return 0;
  return Math.max(1, Math.min(owned, need));
}

// One bite: consumes a unit and logs it. Repeat bites merge into one
// rewritten line via the consumeAcc chain (see below). The log reports
// actual grants split into under-cap and overheal shares (see logConsume).
function eatOneUnit(it) {
  state.amounts[it.id] -= 1;
  const gains = (it.consume && it.consume.gains) || {};
  let under = 0, over = 0;
  const other = {};
  for (const [rid, n] of Object.entries(gains)) {
    // Meals overheal: their own Stamina grants clamp to max x nutrition
    // instead of the cap (never below the current value, so a weaker meal
    // eaten above its own ceiling can't drain the buffer).
    const ceil = (typeof itemOverhealCeil === "function") ? itemOverhealCeil(it, rid) : ((typeof getEffectiveMax === "function") ? getEffectiveMax(rid) : Infinity);
    const cur = state.amounts[rid] ?? 0;
    const next = ceil === Infinity ? cur + n : Math.max(cur, Math.min(ceil, cur + n));
    state.amounts[rid] = next;
    if (n > 0) {
      if (typeof markCurrencySeen === "function") markCurrencySeen(rid);
      // Item gains discover like any other find (see doTick).
      if (typeof getItem === "function" && getItem(rid)) {
        if (!state.seen) state.seen = {};
        state.seen[rid] = true;
      }
    }
    const actual = next - cur;
    if (!(actual > 1e-9)) continue;
    if (rid === OVERHEAL_RESOURCE) {
      const max = (typeof getEffectiveMax === "function") ? getEffectiveMax(rid) : Infinity;
      if (max === Infinity) under += actual;
      else {
        under += Math.max(0, Math.min(max, next) - Math.min(max, cur));
        over += Math.max(0, next - Math.max(max, cur));
      }
    } else {
      other[rid] = (other[rid] ?? 0) + actual;
    }
  }
  const key = "consume:" + it.id;
  if (logChainAlive(consumeAcc) && consumeAcc.id === it.id) {
    // Back-to-back eats of the same item rewrite one line with running
    // totals ("You consume 2 Apples. (+2 Stamina)") instead of "(x2)".
    // Stamina totals stay split (under/over) so the merged line reports
    // the true shares, not the nominal sum.
    consumeAcc.n += 1;
    consumeAcc.under += under;
    consumeAcc.over += over;
    accAdd(consumeAcc.gains, other);
    logConsume("You consume " + formatNum(consumeAcc.n) + " " + displayName(it, consumeAcc.n) + ".", consumeAcc.gains, key, it, { under: consumeAcc.under, over: consumeAcc.over });
  } else {
    consumeAcc = { key, id: it.id, n: 1, gains: { ...other }, under, over };
    logConsume((it.consume && it.consume.log) || ("You consume " + it.name + "."), other, key, it, { under, over });
  }
}

// Selling Mode (inventory): the panel's Sell button arms it (button flips
// to Done, like hiding mode) and an amount row appears (1 / 5 / 10, plus
// an inline field for any custom amount). Clicking a cell
// sells that amount of the item at its sellPrice. Selling only works at
// store tiles (General Store): arming off-store refuses with a message,
// and leaving the store while armed disarms. Runtime-only, never saved.
let invSelling = false;
let sellQty = 1;
const SELL_QTY_PRESETS = [1, 5, 10];
const SELL_QTY_MIN = 1;
const SELL_QTY_MAX = 99999;

// An item is sellable when at least one priced entry survived validation.
function itemSellable(def) {
  return !!def && !!def.sellPrice && Object.keys(def.sellPrice).length > 0;
}

// Store presence: the same General Store requirement shopping uses.
// Before the World unlocks the player is implicitly in town, so selling
// works exactly where buying does.
function atStoreTile() {
  if (typeof tileRequirementMet !== "function") return true;
  return tileRequirementMet({ requiresTile: STORE_TAG });
}

function normalizeSellQty(n) {
  n = Math.floor(Number(n));
  if (!Number.isFinite(n)) return SELL_QTY_MIN;
  return Math.min(SELL_QTY_MAX, Math.max(SELL_QTY_MIN, n));
}

function syncSellUI() {
  if (typeof invSellBtn !== "undefined" && invSellBtn) {
    const t = invSelling ? "Done" : "Sell";
    if (invSellBtn.textContent !== t) invSellBtn.textContent = t;
    invSellBtn.classList.toggle("on", invSelling);
    // Grayed out off-store: selling only works at a General Store, so
    // the button disables (rather than refusing on click) when no store
    // tile is underfoot. Refreshed every inventory render (travel moves).
    const offStore = !atStoreTile();
    if (invSellBtn.disabled !== offStore) invSellBtn.disabled = offStore;
    const tip = offStore ? "Travel to a General Store to sell items" : "Sell items for Coins (General Store only)";
    if (invSellBtn.title !== tip) invSellBtn.title = tip;
  }
  const row = document.getElementById("invSellRow");
  if (row && row.hidden === invSelling) row.hidden = !invSelling;
  const grid = document.getElementById("invGridCtn");
  if (grid) grid.classList.toggle("selling", invSelling);
}

function syncSellRow() {
  const wrap = document.getElementById("invSellQtyBtns");
  if (wrap) for (const b of wrap.querySelectorAll("button[data-sellqty]")) {
    b.classList.toggle("active", sellQty === Number(b.dataset.sellqty));
  }
  // The inline amount field mirrors the live quantity - skipped while
  // focused so typing is never clobbered; blur/change re-syncs.
  if (typeof sellQtyInput !== "undefined" && sellQtyInput && document.activeElement !== sellQtyInput) {
    if (sellQtyInput.value !== String(sellQty)) sellQtyInput.value = String(sellQty);
  }
}

function buildSellRow() {
  const wrap = document.getElementById("invSellQtyBtns");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const q of SELL_QTY_PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(q);
    b.dataset.sellqty = q;
    b.addEventListener("click", () => setSellQty(q));
    wrap.appendChild(b);
  }
  syncSellRow();
}

function toggleSelling() {
  if (!invSelling && !atStoreTile()) {
    log("You can only sell items at a General Store.");
    render();
    return;
  }
  invSelling = !invSelling;
  syncSellUI();
  render();
}

// Leaving the Inventory tab disarms Selling mode (called from showTab).
// No render here: the 50ms loop repaints within a tick, and showTab
// itself fires mid-render on automatic tab kicks.
function disarmSelling() {
  if (!invSelling) return;
  invSelling = false;
  syncSellUI();
}

function setSellQty(n) {
  sellQty = normalizeSellQty(n);
  syncSellRow();
}

// Sell log line: "You sell 5x Apples (+5 Coins)" with each gain in its
// currency color (like consume lines). Cap overflow never appears here -
// the item's own tooltip warns before the sale ("Selling 3 would destroy
// 1.5 Coins over the cap."). Selling at a full cap is always allowed.
function logSell(base, gains, mergeKey) {
  const entries = Object.entries(gains ?? {}).filter(([, n]) => n > 0);
  // Empty gains only happen on degenerate (runtime-injected) prices -
  // validation drops zero/unknown/self entries - but the line must still
  // carry its category, or the sell filter can never hide it.
  if (!entries.length) { log(base, "sell", mergeKey); return; }
  const label = ([rid, n]) => {
    const def = (typeof getResource === "function") ? getResource(rid) : null;
    return "+" + formatNum(n) + " " + (def ? displayName(def, n) : rid);
  };
  const plain = base + " (" + entries.map(label).join(", ") + ")";
  const fill = (line) => {
    line.appendChild(document.createTextNode(base + " ("));
    entries.forEach((e, i) => {
      if (i) line.appendChild(document.createTextNode(", "));
      const s = document.createElement("span");
      s.textContent = label(e);
      // gain-c marks resource-tinted spans so light mode can darken them.
      s.className = "gain-c";
      const c = gainDisplayColor(e[0]);
      if (c) s.style.color = c;
      line.appendChild(s);
    });
    line.appendChild(document.createTextNode(")"));
  };
  if (typeof logRich === "function") logRich(plain, "sell", fill, mergeKey);
  else log(plain, "sell", mergeKey);
}

// Item-tip overflow warning ("Selling 3 would destroy 1.5 Coins over the
// cap."): predictive, from the CURRENT sell amount, owned count, and cap
// room - the same notice furniture sell tips carry. Refreshed whenever the
// tip opens (hover/focus, so it can never go stale) and on inventory
// renders; hidden while nothing would overflow.
function syncItemSellWarn(it, ref) {
  const el = ref ? ref.sellWarn : null;
  if (!el) return;
  // Selling-mode only: outside Sell mode the warning would nag on every
  // capped tooltip, so it stays hidden until the mode is armed.
  if (!invSelling) {
    if (!el.hidden) el.hidden = true;
    return;
  }
  // Togglable in Options (on by default): off hides the warning outright.
  if (state.options.sellWarn === false) {
    if (!el.hidden) el.hidden = true;
    return;
  }
  let text = "";
  const owned = state.amounts[it.id] ?? 0;
  const qty = (typeof sellQty !== "undefined") ? sellQty : 1;
  const n = Math.min(Math.max(1, Math.floor(qty) || 1), owned);
  if (typeof itemSellable === "function" && itemSellable(it) && owned > 0 && n > 0) {
    const over = [];
    for (const [rid, per] of Object.entries(it.sellPrice ?? {})) {
      const total = per * n;
      if (!(total > 0)) continue;
      const max = (typeof getEffectiveMax === "function") ? getEffectiveMax(rid) : Infinity;
      if (max === Infinity) continue;
      const room = Math.max(0, max - (state.amounts[rid] ?? 0));
      if (total > room) {
        const def = (typeof getResource === "function") ? getResource(rid) : null;
        over.push(formatNum(total - room) + " " + (def ? displayName(def, total - room) : rid));
      }
    }
    // Same joining as furniture's overflow notice.
    if (over.length === 1) text = "Selling " + formatNum(n) + " would destroy " + over[0] + " over the cap.";
    else if (over.length === 2) text = "Selling " + formatNum(n) + " would destroy " + over[0] + " and " + over[1] + " over the cap.";
    else if (over.length) text = "Selling " + formatNum(n) + " would destroy " + over.slice(0, -1).join(", ") + ", and " + over[over.length - 1] + " over the cap.";
  }
  if (el.textContent !== text) el.textContent = text;
  const hide = !text;
  if (el.hidden !== hide) el.hidden = hide;
}

function sellItem(id) {
  const it = (typeof getItem === "function") ? getItem(id) : null;
  if (!it || !itemSellable(it)) {
    log("You can't sell " + (it ? it.name : id) + ".");
    render();
    return;
  }
  if (!atStoreTile()) {
    log("You can only sell items at a General Store.");
    invSelling = false;
    syncSellUI();
    render();
    return;
  }
  const owned = state.amounts[id] ?? 0;
  if (owned <= 0) {
    log("None left: " + it.name + ".");
    render();
    return;
  }
  const n = Math.min(Math.max(1, Math.floor(sellQty) || 1), owned);
  const gains = {};
  for (const [rid, per] of Object.entries(it.sellPrice)) {
    const total = per * n;
    if (!(total > 0)) continue;
    const max = (typeof getEffectiveMax === "function") ? getEffectiveMax(rid) : Infinity;
    const cur = state.amounts[rid] ?? 0;
    if (max === Infinity) {
      state.amounts[rid] = cur + total;
    } else {
      const room = Math.max(0, max - cur);
      state.amounts[rid] = cur + Math.min(room, total);
    }
    gains[rid] = total;
    if (typeof markCurrencySeen === "function") markCurrencySeen(rid);
    // Item proceeds join the Inventory like any other find (see doTick);
    // without this a sold-for item would be held but never seen.
    if (typeof getItem === "function" && getItem(rid)) {
      if (!state.seen) state.seen = {};
      state.seen[rid] = true;
    }
  }
  state.amounts[id] -= n;
  const key = "sell:" + id;
  const name = (count) => formatNum(count) + "x " + ((typeof getResource === "function") ? displayName(it, count) : it.name);
  if (logChainAlive(sellAcc) && sellAcc.id === id) {
    // Back-to-back sells of the same item rewrite one line with running
    // totals ("You sell 10x Apples. (+10 Coins)") instead of "(x2)".
    sellAcc.n += n;
    accAdd(sellAcc.gains, gains);
    logSell("You sell " + name(sellAcc.n) + ".", sellAcc.gains, key);
  } else {
    sellAcc = { key, id, n, gains: { ...gains } };
    logSell("You sell " + name(n) + ".", gains, key);
  }
  render();
}

function renderInventory() {
  const grid = document.getElementById("invGridCtn");
  if (!grid) return;
  // Leaving the store while armed disarms (selling only works there).
  if (invSelling && !atStoreTile()) {
    invSelling = false;
    syncSellUI();
    log("You step away from the store.");
  }
  syncSellUI();
  syncSellRow();
  const filter = invRarity();
  // One tag scan per tick: invType(), the chip totals, and the rebuild
  // check below all share it instead of each re-scanning ITEMS.
  const typeTags = invTypeTags();
  const type = invType(typeTags);
  const hideEmpty = hideEmptyInv();
  // String-coerced: a non-string value (save tampering, a stray write)
  // would otherwise throw on .trim() and freeze the 50ms tick loop.
  const query = String((state.options && state.options.invSearch) || "").trim().toLowerCase();
  // Query singulars, computed once per tick instead of per cell.
  const querySing = query ? invWordSingulars(query) : null;
  // The search field is static markup (never rebuilt), so sync its text
  // here without clobbering in-progress typing: only write when it isn't
  // focused (loads/restores land while focus is elsewhere).
  if (typeof invSearchInput !== "undefined" && invSearchInput && document.activeElement !== invSearchInput && invSearchInput.value !== (state.options.invSearch ?? "")) invSearchInput.value = state.options.invSearch ?? "";
  // Rarity chips highlight the active filter (setInvRarity only flips the
  // option + re-renders, so the chips would otherwise stay stale), and
  // their counts follow discoveries, the type filter, and the empty rule
  // live (gathering marks items seen, so the modal numbers update with no
  // rebuild). Labels rewrite only when the counts actually change. Counts
  // come from one shared single-pass tally (see invChipTotals), not one
  // scan per chip.
  const chipTotals = (typeof invChipTotals === "function") ? invChipTotals(typeTags) : null;
  const rarCount = (r) => chipTotals
    ? (r === "all" ? chipTotals.rarTotal : (chipTotals.rar.get(r) ?? 0))
    : invCountFor(r);
  const typCount = (t) => chipTotals
    ? (t === "all" ? chipTotals.typTotal : (chipTotals.typ.get(t) ?? 0))
    : invTypeCountFor(t);
  const filterRow = document.getElementById("invFilterRow");
  if (filterRow) {
    // Static chip set (rarity list never changes at runtime): cache the
    // nodes instead of re-querying every tick.
    if (!filterRow._chips) filterRow._chips = [...filterRow.querySelectorAll("button[data-rarity]")];
    const chips = filterRow._chips;
    const sig = chips.map(b => (b.dataset.rarity ?? "all") + ":" + rarCount(b.dataset.rarity ?? "all")).join(",");
    if (filterRow.dataset.countSig !== sig) {
      filterRow.dataset.countSig = sig;
      for (const b of chips) {
        const r = b.dataset.rarity ?? "all";
        b.textContent = invRarityChipLabel(r, rarCount(r));
        b.classList.toggle("active", r === filter);
      }
    } else {
      for (const b of chips) b.classList.toggle("active", (b.dataset.rarity ?? "all") === filter);
    }
  }
  // Type chips sync the same way (highlight + live counts): categories in
  // the main row, the active category's sub-types in the sub row below.
  const typeRow = document.getElementById("invTypeRow");
  const subRow = document.getElementById("invTypeSubRow");
  const topTypes = invTopLevelTypes();
  const subTypes = invSubRowTypes();
  // The active category's chip glows green (in-cat) while one of its
  // sub-types is selected - synced every frame like .active, so leaving
  // the sub-type never strands the glow on the old category.
  const activeCat = invActiveCategory(type);
  if (typeRow) {
    // New finds can add categories at any time, so rebuild the row when
    // the set changes - counts alone can't do that.
    // The chip nodes are cached like the rarity row's (see above).
    const tagSig = topTypes.join("|");
    if (typeRow.dataset.tagSig !== tagSig) {
      typeRow.dataset.tagSig = tagSig;
      buildInvTypeRow();
      typeRow._chips = null;
    }
    if (!typeRow._chips) typeRow._chips = [...typeRow.querySelectorAll("button[data-invtype]")];
    const chips = typeRow._chips;
    const sig = chips.map(b => (b.dataset.invtype ?? "all") + ":" + typCount(b.dataset.invtype ?? "all")).join(",");
    if (typeRow.dataset.countSig !== sig) {
      typeRow.dataset.countSig = sig;
      for (const b of chips) {
        const t = b.dataset.invtype ?? "all";
        b.textContent = b._subAll ? "All (" + typCount(t) + ")" : invTypeChipLabel(t, typCount(t));
        b.classList.toggle("active", t === type);
        b.classList.toggle("in-cat", !!activeCat && t === activeCat);
      }
    } else {
      for (const b of chips) {
        b.classList.toggle("active", (b.dataset.invtype ?? "all") === type);
        b.classList.toggle("in-cat", !!activeCat && (b.dataset.invtype ?? "all") === activeCat);
      }
    }
  }
  if (subRow) {
    // Selecting another category swaps the whole sub-type set, so the sub
    // row rebuilds on set changes exactly like the main row.
    const tagSig = subTypes.join("|");
    if (subRow.dataset.tagSig !== tagSig) {
      subRow.dataset.tagSig = tagSig;
      buildInvTypeSubRow();
      subRow._chips = null;
    }
    if (!subRow._chips) subRow._chips = [...subRow.querySelectorAll("button[data-invtype]")];
    const chips = subRow._chips;
    const sig = chips.map(b => (b.dataset.invtype ?? "all") + ":" + typCount(b.dataset.invtype ?? "all")).join(",");
    if (subRow.dataset.countSig !== sig) {
      subRow.dataset.countSig = sig;
      for (const b of chips) {
        const t = b.dataset.invtype ?? "all";
        b.textContent = b._subAll ? "All (" + typCount(t) + ")" : invTypeChipLabel(t, typCount(t));
        b.classList.toggle("active", t === type);
        b.classList.toggle("in-cat", !!activeCat && t === activeCat);
      }
    } else {
      for (const b of chips) {
        b.classList.toggle("active", (b.dataset.invtype ?? "all") === type);
        b.classList.toggle("in-cat", !!activeCat && (b.dataset.invtype ?? "all") === activeCat);
      }
    }
  }
  let anyVisible = false;
  for (const it of ITEMS) {
    const ref = uiRefs.get("i:" + it.id);
    if (!ref || !ref.root.isConnected) continue;
    const owned = state.amounts[it.id] ?? 0;
    const seen = !!(state.seen && state.seen[it.id]);
    const match = (filter === "all" || (it.rarity ?? "common") === filter) && invTypeMatch(it, type) && invSearchMatch(it, query, querySing);
    const show = seen && match && (owned > 0 || !hideEmpty);
    if (show) anyVisible = true;
    const edible = itemEdible(it);
    const capped = edible && consumeFullyCapped(it);
    const sig = (show ? 1 : 0) + "|" + owned + "|" + filter + "|" + type + "|" + query + "|" + (hideEmpty ? 1 : 0) + "|" + (edible ? 1 : 0) + "|" + (capped ? 1 : 0);
    if (ref._sig !== sig) {
      ref._sig = sig;
      ref.root.hidden = !show;
      ref.count.textContent = owned > 0 ? "x" + formatNum(owned) : "x0";
      ref.root.classList.toggle("invEmpty", owned <= 0);
      if (ref.tipCount) ref.tipCount.textContent = "x" + formatNum(owned);
      if (ref.consume) {
        ref.consume.disabled = owned <= 0 || capped;
        ref.consume.textContent = (it.consume && it.consume.button) || "Consume";
        ref.consume.removeAttribute("title");
      }
    }
    // Outside the sig gate: coin/cap/sellQty changes don't alter the sig,
    // but they do change the overflow math - so the warning stays right
    // with zero hover/focus needed.
    syncItemSellWarn(it, ref);
  }
  let note = grid.querySelector(":scope > .invEmptyNote");
  if (!anyVisible) {
    if (!note) {
      note = document.createElement("div");
      note.className = "emptyNote invEmptyNote";
      note.textContent = "No Items.";
      grid.appendChild(note);
    }
  } else if (note) note.remove();
}

// Selling Mode wiring: arm/disarm button plus the inline amount field
// (typing applies live; Enter just leaves the field).
if (typeof invSellBtn !== "undefined" && invSellBtn) invSellBtn.addEventListener("click", toggleSelling);
if (typeof sellQtyInput !== "undefined" && sellQtyInput) {
  sellQtyInput.addEventListener("input", () => {
    if (sellQtyInput.value === "") return;
    setSellQty(sellQtyInput.value);
  });
  sellQtyInput.addEventListener("change", () => {
    if (sellQtyInput.value === "") sellQtyInput.value = String(sellQty);
    else setSellQty(sellQtyInput.value);
    syncSellRow();
  });
  sellQtyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && sellQtyInput.blur) sellQtyInput.blur();
    e.stopPropagation();
  });
}
// Inventory search wiring: typing applies live (Enter just leaves the
// field, Escape clears it). Same stopPropagation as the sell field so
// global keys don't fire mid-typing.
if (typeof invSearchInput !== "undefined" && invSearchInput) {
  invSearchInput.addEventListener("input", () => {
    state.options.invSearch = invSearchInput.value;
    render();
  });
  // The native type=search clear button doesn't fire `input` in every
  // browser (it fires `search`); without this, the per-tick render would
  // resync the field from the stale state and undo the clear. Firing on
  // Enter in some browsers is harmless (same value, one extra render).
  invSearchInput.addEventListener("search", () => {
    state.options.invSearch = invSearchInput.value;
    render();
  });
  invSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && invSearchInput.blur) invSearchInput.blur();
    else if (e.key === "Escape") { state.options.invSearch = ""; invSearchInput.value = ""; render(); }
    e.stopPropagation();
  });
}
