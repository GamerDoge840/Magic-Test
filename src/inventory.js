// Labor Game inventory: item grid, rarity filters, consuming.
const RARITY_COLORS = {
  junk: "#9aa3b5",
  common: "#f5f5f5",
  uncommon: "#7fd97f",
  rare: "#7fc9ff",
  exotic: "#c58fff",
  legendary: null, // gradient, handled by the .rar-legendary CSS class
};

// Rarity class for an item's name (inventory cells, item tooltips, gather
// log bullets). Classes - not inline styles - so the light-mode CSS block
// can re-tone them for white backgrounds (common is near-white in dark
// mode). Unknown rarities fall back to common, matching validation.
function itemRarityClass(def) {
  const r = (def && def.rarity) || "common";
  return "rar-" + (((typeof RARITY_ORDER !== "undefined" && RARITY_ORDER.includes(r)) || ["junk", "common", "uncommon", "rare", "exotic", "legendary"].includes(r)) ? r : "common");
}

function itemRarityName(rid) {
  return rid ? rid.charAt(0).toUpperCase() + rid.slice(1) : rid;
}

// Chip counts cover only displayable cells: seen items passing the OTHER
// dimension's filter and the empty rule, so every chip number matches the
// cells its click would show. Counts refresh every render (see
// renderInventory), so gathering/consuming updates them live.
function invCountBase(except) {
  const r = invRarity(), t = invType();
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

function invTypeCountFor(t) {
  const base = invCountBase("type");
  if (t === "all") return base.length;
  return base.filter(it => invTypeMatch(it, t)).length;
}

function invChipLabel(name, n) {
  return name + " (" + n + ")";
}

function invRarityChipLabel(r, n) {
  return invChipLabel(r === "all" ? "All" : itemRarityName(r), n);
}

// Display plurals for type-filter chips ("Herb" -> "Herbs"). Uncountable
// tags like "Food" are intentionally absent and render as-is.
const INV_TYPE_PLURALS = { Herb: "Herbs" };

function invTypeChipLabel(t, n) {
  if (t === "all") return invChipLabel("All", n);
  // Category names read as plurals ("Herbs"); uncountables ("Food") and
  // anything unmapped keep the raw tag. Tooltips still show the raw tag.
  return invChipLabel(INV_TYPE_PLURALS[t] ?? t, n);
}

// Type filter (by tag): single-select inline row under the header -
// "All" plus one chip per discovered item type tag. A tag is a *type* only when it doesn't cover every
// defined item ("Foraged" is on everything; the "consumable" mechanic
// tag is not a type) - and of those, only tags with at least one
// all-time obtained item show, so advanced categories stay hidden until
// their first find. An item matches the selected type when one of its
// tags is exactly it.
function invTypeTags() {
  const total = new Map();
  for (const it of ITEMS) for (const t of new Set(getTags(it))) {
    if (String(t).toLowerCase() === "consumable") continue;
    total.set(t, (total.get(t) ?? 0) + 1);
  }
  const out = [];
  for (const [t, n] of total) {
    if (n >= ITEMS.length) continue;
    if (ITEMS.some(it => state.seen && state.seen[it.id] && getTags(it).includes(t))) out.push(t);
  }
  return out.sort();
}

function invType() {
  const t = state.options.invType;
  if (t === "all" || invTypeTags().includes(t)) return t;
  return "all";
}

function setInvType(t) {
  state.options.invType = t;
  render();
}

function invTypeMatch(it, t) {
  return t === "all" || getTags(it).includes(t);
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

// Secondary inline filter row: "All" plus one chip per item type tag,
// with live counts. Single-select like the rarity chips, and AND-combined
// with the rarity filter. Hidden when nothing discriminates.
function buildInvTypeRow() {
  const typeRow = document.getElementById("invTypeRow");
  if (!typeRow) return;
  typeRow.innerHTML = "";
  const tags = invTypeTags();
  typeRow.hidden = !tags.length;
  if (!tags.length) return;
  const label = document.createElement("span");
  label.textContent = "Type:";
  typeRow.appendChild(label);
  for (const t of ["all", ...tags]) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.invtype = t;
    b.textContent = invTypeChipLabel(t, invTypeCountFor(t));
    b.classList.toggle("active", invType() === t);
    b.addEventListener("click", () => setInvType(t));
    typeRow.appendChild(b);
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
    const sec = document.createElement("div");
    sec.className = "tip-sec";
    const lab = document.createElement("div");
    lab.className = "tip-sec-label";
    lab.textContent = "Rarity";
    sec.appendChild(lab);
    const row = document.createElement("div");
    row.className = "tip-row";
    const s = document.createElement("span");
    s.textContent = itemRarityName(it.rarity ?? "common");
    if (typeof itemRarityClass === "function") s.classList.add(itemRarityClass(it));
    row.appendChild(s);
    sec.appendChild(row);
    tip.appendChild(sec);
  }
  if (typeof it.fuel === "number" && isFinite(it.fuel) && it.fuel > 0) {
    const sec = document.createElement("div");
    sec.className = "tip-sec";
    const lab = document.createElement("div");
    lab.className = "tip-sec-label";
    lab.textContent = "Fuel";
    sec.appendChild(lab);
    const row = document.createElement("div");
    row.className = "tip-row";
    const s = document.createElement("span");
    s.textContent = "Fuel value: " + formatNum(it.fuel);
    row.appendChild(s);
    sec.appendChild(row);
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
  if (!tip || !anchor) return;
  const keep = { position: tip.style.position, top: tip.style.top, bottom: tip.style.bottom, left: tip.style.left, transform: tip.style.transform, maxHeight: tip.style.maxHeight, marginLeft: tip.style.marginLeft };
  tip.style.position = "";
  tip.style.top = "";
  tip.style.bottom = "";
  tip.style.left = "";
  tip.style.transform = "";
  tip.style.maxHeight = "";
  tip.style.marginLeft = "";
  // Measure with the tip forcibly shown: open paths can land a frame
  // before CSS :hover/:focus-visible paints it visible, and a display:none
  // tip reads 0 and bails, stranding it at its natural clipped spot.
  const needShow = getComputedStyle(tip).display === "none";
  if (needShow) tip.style.display = "block";
  const h = tip.offsetHeight;
  if (!h) {
    tip.style.position = keep.position;
    tip.style.top = keep.top;
    tip.style.bottom = keep.bottom;
    tip.style.left = keep.left;
    tip.style.transform = keep.transform;
    tip.style.maxHeight = keep.maxHeight;
    tip.style.marginLeft = keep.marginLeft;
    if (needShow) tip.style.display = "";
    return;
  }
  const VH = window.innerHeight, VW = window.innerWidth;
  const b = anchor.getBoundingClientRect();
  const roomUp = b.top - 8;
  const roomDown = VH - 8 - b.bottom;
  let dir = "up";
  if (roomUp < h + 8 && roomDown > roomUp) dir = "down";
  const room = dir === "up" ? roomUp : roomDown;
  const cs = getComputedStyle(tip);
  const centered = cs.transform !== "none";
  const chrome = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) +
    (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  const avail = Math.floor(room - chrome);
  const cssCap = Math.min(360, VH * 0.7);
  const cap = avail <= 0 ? 80 : avail < 80 ? avail : Math.min(avail, cssCap);
  if (room < h + 8) tip.style.maxHeight = cap + "px";
  tip.style.position = "fixed";
  tip.style.bottom = "auto";
  tip.style.marginLeft = "";
  tip.style.transform = "none";
  const w = tip.offsetWidth;
  const wantLeft = centered ? b.left + b.width / 2 - w / 2 : b.left;
  tip.style.left = Math.max(8, Math.min(Math.round(wantLeft), VW - 8 - w)) + "px";
  tip.style.top = dir === "down" ? Math.round(b.bottom - 2) + "px" : Math.round(b.top + 2 - tip.offsetHeight) + "px";
  if (needShow) tip.style.display = "";
  if (typeof syncTipPointer === "function") syncTipPointer(anchor, true);
}

function clearInvTip(tip) {
  if (!tip) return;
  tip.style.position = "";
  tip.style.top = "";
  tip.style.bottom = "";
  tip.style.left = "";
  tip.style.transform = "";
  tip.style.maxHeight = "";
  tip.style.marginLeft = "";
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
function consumeFullyCapped(it) {
  const gains = (it && it.consume && it.consume.gains) || {};
  const ids = Object.keys(gains);
  if (!ids.length || typeof getEffectiveMax !== "function") return false;
  return ids.every(rid => {
    const max = getEffectiveMax(rid);
    return max !== Infinity && (state.amounts[rid] ?? 0) >= max;
  });
}
// Eat one unit: pays nothing, grants the consume bundle through the
// normal capped grants (excess over a cap is destroyed, like actions),
// then logs the bite. Only edible, owned items run.
// The logged gains keep the targeted Vital's color: "You eat an apple."
// shows "+1 Stamina" in Stamina's own color (its bar color, like the
// Vitals panel), and the same holds for any other gain target.
function gainDisplayColor(rid) {
  const item = (typeof getItem === "function") ? getItem(rid) : null;
  if (item) {
    if (item.rarity === "legendary") return "#ffd700";
    return RARITY_COLORS[item.rarity ?? "common"] ?? RARITY_COLORS.common;
  }
  const r = (typeof getResource === "function") ? getResource(rid) : null;
  if (!r) return null;
  return r.nameColor ?? r.barColor ?? null;
}

function logConsume(base, gains, mergeKey) {
  const entries = Object.entries(gains ?? {}).filter(([, n]) => n > 0);
  if (!entries.length) { log(base, "consume", mergeKey); return; }
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
  if (typeof logRich === "function") logRich(plain, "consume", fill, mergeKey);
  else log(plain, "consume", mergeKey);
}

// Repeat eats and repeat sells accumulate into ONE rewritten line -
// "You consume 2 Apples. (+2 Stamina)" - via the log mergeKey chain,
// instead of the generic back-to-back "(x2)" suffix. Any other log line
// breaks the chain (lastLogMergeKey changes), starting a fresh count.
// Runtime-only, never saved.
let consumeAcc = null; // { key, id, n, gains }
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
// caps at all), so this always returns 1+.
function maxEatCount(it) {
  const owned = Math.floor(state.amounts[it.id] ?? 0);
  if (owned <= 0) return 0;
  const gains = (it.consume && it.consume.gains) || {};
  let need = Infinity, hasCap = false;
  for (const [rid, n] of Object.entries(gains)) {
    if (!(n > 0)) continue;
    const max = (typeof getEffectiveMax === "function") ? getEffectiveMax(rid) : Infinity;
    if (max === Infinity) continue;
    hasCap = true;
    const room = max - (state.amounts[rid] ?? 0);
    if (room <= 0) continue;
    need = Math.min(need, Math.ceil(room / n));
  }
  if (!hasCap) return owned;
  if (!Number.isFinite(need)) return 0;
  return Math.max(1, Math.min(owned, need));
}

// One bite: consumes a unit and logs it. Repeat bites merge into one
// rewritten line via the consumeAcc chain (see below).
function eatOneUnit(it) {
  state.amounts[it.id] -= 1;
  const gains = (it.consume && it.consume.gains) || {};
  for (const [rid, n] of Object.entries(gains)) {
    const max = (typeof getEffectiveMax === "function") ? getEffectiveMax(rid) : Infinity;
    const cur = state.amounts[rid] ?? 0;
    state.amounts[rid] = max === Infinity ? cur + n : Math.min(max, cur + n);
    if (n > 0) {
      if (typeof markCurrencySeen === "function") markCurrencySeen(rid);
      // Item gains discover like any other find (see doTick).
      if (typeof getItem === "function" && getItem(rid)) {
        if (!state.seen) state.seen = {};
        state.seen[rid] = true;
      }
    }
  }
  const key = "consume:" + it.id;
  if (logChainAlive(consumeAcc) && consumeAcc.id === it.id) {
    // Back-to-back eats of the same item rewrite one line with running
    // totals ("You consume 2 Apples. (+2 Stamina)") instead of "(x2)".
    consumeAcc.n += 1;
    accAdd(consumeAcc.gains, gains);
    logConsume("You consume " + formatNum(consumeAcc.n) + " " + displayName(it, consumeAcc.n) + ".", consumeAcc.gains, key);
  } else {
    consumeAcc = { key, id: it.id, n: 1, gains: { ...gains } };
    logConsume((it.consume && it.consume.log) || ("You consume " + it.name + "."), gains, key);
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
  return tileRequirementMet({ requiresTile: "General Store" });
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
  if (!entries.length) { log(base); return; }
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
  const type = invType();
  const hideEmpty = hideEmptyInv();
  // Rarity chips highlight the active filter (setInvRarity only flips the
  // option + re-renders, so the chips would otherwise stay stale), and
  // their counts follow discoveries, the type filter, and the empty rule
  // live (gathering marks items seen, so the modal numbers update with no
  // rebuild). Labels rewrite only when the counts actually change.
  const filterRow = document.getElementById("invFilterRow");
  if (filterRow) {
    const chips = [...filterRow.querySelectorAll("button[data-rarity]")];
    const sig = chips.map(b => (b.dataset.rarity ?? "all") + ":" + invCountFor(b.dataset.rarity ?? "all")).join(",");
    if (filterRow.dataset.countSig !== sig) {
      filterRow.dataset.countSig = sig;
      for (const b of chips) {
        const r = b.dataset.rarity ?? "all";
        b.textContent = invRarityChipLabel(r, invCountFor(r));
        b.classList.toggle("active", r === filter);
      }
    } else {
      for (const b of chips) b.classList.toggle("active", (b.dataset.rarity ?? "all") === filter);
    }
  }
  // Type chips sync the same way (highlight + live counts).
  const typeRow = document.getElementById("invTypeRow");
  if (typeRow) {
    // Discovery can add tags at any time (a first find), so rebuild the
    // row when the discovered set changes - counts alone can't do that.
    const tagSig = invTypeTags().join("|");
    if (typeRow.dataset.tagSig !== tagSig) {
      typeRow.dataset.tagSig = tagSig;
      buildInvTypeRow();
    }
    const chips = [...typeRow.querySelectorAll("button[data-invtype]")];
    const sig = chips.map(b => (b.dataset.invtype ?? "all") + ":" + invTypeCountFor(b.dataset.invtype ?? "all")).join(",");
    if (typeRow.dataset.countSig !== sig) {
      typeRow.dataset.countSig = sig;
      for (const b of chips) {
        const t = b.dataset.invtype ?? "all";
        b.textContent = invTypeChipLabel(t, invTypeCountFor(t));
        b.classList.toggle("active", t === type);
      }
    } else {
      for (const b of chips) b.classList.toggle("active", (b.dataset.invtype ?? "all") === type);
    }
  }
  let anyVisible = false;
  for (const it of ITEMS) {
    const ref = uiRefs.get("i:" + it.id);
    if (!ref || !ref.root.isConnected) continue;
    const owned = state.amounts[it.id] ?? 0;
    const seen = !!(state.seen && state.seen[it.id]);
    const match = (filter === "all" || (it.rarity ?? "common") === filter) && invTypeMatch(it, type);
    const show = seen && match && (owned > 0 || !hideEmpty);
    if (show) anyVisible = true;
    const edible = itemEdible(it);
    const capped = edible && consumeFullyCapped(it);
    const sig = (show ? 1 : 0) + "|" + owned + "|" + filter + "|" + type + "|" + (hideEmpty ? 1 : 0) + "|" + (edible ? 1 : 0) + "|" + (capped ? 1 : 0);
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
