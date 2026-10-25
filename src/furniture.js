// Labor Game furniture: home goods bought like upgrades, sold for full refund.
function sortedFurniture() {
  const sort = state.options.furnSort ?? { key: "name", dir: 1 };
  const arr = [...FURNITURE];
  arr.sort((a, b) => {
    let d = 0;
    if (sort.key === "space") d = (a.space ?? 1) - (b.space ?? 1);
    if (!d) d = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    return d * (sort.dir === -1 ? -1 : 1);
  });
  return arr;
}

function updateSortButtons() {
  const sort = state.options.furnSort ?? { key: "name", dir: 1 };
  if (sortSpaceBtn) {
    sortSpaceBtn.textContent = "Floor Space " + (sort.key === "space" ? (sort.dir === -1 ? "▲" : "▼") : "↕");
    sortSpaceBtn.classList.toggle("active", sort.key === "space");
  }
  if (sortNameBtn) {
    sortNameBtn.textContent = "Furnishing " + (sort.key === "name" ? (sort.dir === -1 ? "▲" : "▼") : "↕");
    sortNameBtn.classList.toggle("active", sort.key === "name");
  }
}

function setFurnSort(key) {
  const sort = state.options.furnSort ?? { key: "name", dir: 1 };
  if (sort.key === key) sort.dir = sort.dir === -1 ? 1 : -1;
  else { sort.key = key; sort.dir = 1; }
  state.options.furnSort = normalizeFurnSort(sort);
  updateSortButtons();
  buildFurnitureCards();
  render();
}

// Furniture type filters (by tag): the checkbox list is data-driven, so new
// furniture with new tags just works. Tags on EVERY item (e.g. "Furniture")
// can't discriminate, so they get no checkbox. An item shows when any of
// its listed types is checked; unlisted prefs default to shown.
function furnitureTypeTags() {
  const counts = new Map();
  for (const f of FURNITURE) for (const t of new Set(getTags(f))) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n < FURNITURE.length).map(([t]) => t).sort();
}

function furnTypeOn(tag) {
  return (state.options.furnTypes ?? {})[tag] !== false;
}

function furnTypeVisible(f) {
  const types = furnitureTypeTags();
  if (!types.length) return true;
  const mine = getTags(f).filter(t => types.includes(t));
  if (!mine.length) return true;
  return mine.some(t => furnTypeOn(t));
}

// Visibility for the four state filters: Maxed items answer only to Maxed;
// everything else shows only when its Owned/Unowned toggle is on AND it
// isn't excluded by Blocked. Every checkbox reliably hides its own
// category (Blocked never overrides an Owned/Unowned opt-out). Missing
// prefs default to visible.
function furnVisible(f) {
  if (!unlockFurniture(f)) return false;
  if (!furnTypeVisible(f)) return false;
  const flt = state.options.furnFilters ?? {};
  const owned = state.furniture[f.id] ?? 0;
  if (owned >= getEffectiveFurnCap(f)) return flt.maxed !== false;
  if (furnitureBlocked(f) && flt.blocked === false) return false;
  if (owned > 0) return flt.owned !== false;
  return flt.unowned !== false;
}

function buyFurniture(id) {
  const f = getFurniture(id);
  if (!f || !unlockFurniture(f)) return;
  const owned = state.furniture[id] ?? 0;
  if (owned >= getEffectiveFurnCap(f)) {
    log(f.name + " is already maxed out.");
    return;
  }
  if (!canAfford(f.cost)) {
    log("Not enough for " + f.name + " (" + describeCost(f.cost) + ").");
    return;
  }
  if (furnitureSpaceUsed() + (f.space ?? 1) > homeSpaceMax()) {
    log("No room for " + f.name + " (" + (f.space ?? 1) + " Floor Space).");
    return;
  }
  payCosts(f.cost);
  state.furniture[id] = owned + 1;
  const capNow = getEffectiveFurnCap(f);
  const cap = capNow === Infinity ? "no limit" : formatNum(capNow);
  log((f.buyLog ?? "Bought: " + f.name) + " (" + state.furniture[id] + "/" + cap + ").", "upgrade");
  buildUI();
  render();
}

function sellFurniture(id) {
  const f = getFurniture(id);
  if (!f) return;
  const owned = state.furniture[id] ?? 0;
  if (owned <= 0) return;
  state.furniture[id] = owned - 1;
  // Full refund, capped at each resource's (possibly just lowered) max -
  // excess over the cap is destroyed. A second pass clamps everything in
  // case losing a "max" effect left amounts above their new caps.
  for (const [rid, n] of Object.entries(f.cost ?? {})) {
    const max = getEffectiveMax(rid);
    state.amounts[rid] = max === Infinity ? (state.amounts[rid] ?? 0) + n : Math.min(max, (state.amounts[rid] ?? 0) + n);
  }
  for (const r of RESOURCES) {
    const m = getEffectiveMax(r.id);
    if (m !== Infinity && (state.amounts[r.id] ?? 0) > m) state.amounts[r.id] = m;
  }
  log((f.sellLog ?? "Sold: " + f.name) + " (" + state.furniture[id] + "/" + formatNum(getEffectiveFurnCap(f)) + ").", "upgrade");
  buildUI();
  render();
}

// Cap a resource would have after selling one unit of f (its own "max"
// effects no longer count). Used for the sell overflow notice.
function maxAfterSell(f, rid) {
  let m = getEffectiveMax(rid);
  for (const e of f.effects ?? []) {
    if (e.type === "max" && e.resource === rid) m -= e.amount;
  }
  return m;
}

// Buy/sell hover highlights, per furniture item (so future entries behave too):
//   Buy:  costs ring red (spend), effect targets ring green - except a
//         resource that is BOTH (Coin Piles' Coin) stays red, since buying
//         drains it.
//   Sell: refunded costs ring green (you gain them back), lost non-cost
//         effects ring red (e.g. the Stamina a blanket was adding).
// Only the resource keys matter to hiResources; the zero amounts are filler.
function furnitureBuyGains(f) {
  const costs = f.cost ?? {};
  const out = {};
  for (const e of f.effects ?? []) if (e.resource && !(e.resource in costs)) out[e.resource] = 0;
  return out;
}

// Tip placement: tips open upward, but flip below their anchor when there
// is no room above the viewport top (the page scrolls, so a tall upward tip
// would be cut by the top of the screen instead).
function placeFurnTip(tip, anchor) {
  if (!tip || !anchor) return;
  const h = tip.offsetHeight;
  if (!h) return;
  if (anchor.getBoundingClientRect().top - h - 8 < 0) {
    tip.style.top = "110%";
    tip.style.bottom = "auto";
  } else {
    tip.style.top = "";
    tip.style.bottom = "";
  }
}

function buildFurnitureCard(f) {
  const card = document.createElement("div");
  card.className = "furnCard";
  card.id = "furn-" + f.id;
  const top = document.createElement("div");
  top.className = "furnTop";
  const nm = document.createElement("span");
  nm.className = "furnName";
  nm.textContent = f.name;
  const owned = document.createElement("span");
  owned.className = "furnOwned";
  top.appendChild(nm);
  top.appendChild(owned);
  card.appendChild(top);

  const btns = document.createElement("div");
  btns.className = "furnBtns";
  const buy = document.createElement("button");
  buy.type = "button";
  buy.className = "furnBuy";
  buy.textContent = "Buy";
  buy.addEventListener("click", () => buyFurniture(f.id));
  const sell = document.createElement("button");
  sell.type = "button";
  sell.className = "furnSell";
  const sellLabel = document.createElement("span");
  sellLabel.textContent = "Sell";
  sell.appendChild(sellLabel);
  // Sell tooltip: refund plus a live overflow notice.
  const stip = document.createElement("span");
  stip.className = "tip";
  const shead = document.createElement("div");
  shead.className = "tip-head";
  const stitle = document.createElement("span");
  stitle.textContent = "Sell: " + f.name;
  shead.appendChild(stitle);
  stip.appendChild(shead);
  appendTipSection(stip, "Refund", f.cost ?? {});
  const snotice = document.createElement("div");
  snotice.className = "tip-flavor tip-overflow";
  snotice.hidden = true;
  stip.appendChild(snotice);
  sell.appendChild(stip);
  sell.addEventListener("click", () => sellFurniture(f.id));
  btns.appendChild(buy);
  btns.appendChild(sell);
  card.appendChild(btns);

  // Info tooltip: same style as everywhere else.
  const tip = document.createElement("span");
  tip.className = "tip furnInfo";
  const head = document.createElement("div");
  head.className = "tip-head";
  const title = document.createElement("span");
  title.textContent = f.name;
  const count = document.createElement("span");
  count.className = "tip-count";
  head.appendChild(title);
  head.appendChild(count);
  tip.appendChild(head);
  const headTags = buildTipTags(f);
  if (headTags) tip.appendChild(headTags);
  {
    const desc = document.createElement("div");
    desc.className = "tip-desc";
    desc.textContent = f.description;
    tip.appendChild(desc);
  }
  const costRefs = [];
  appendTipSection(tip, "Cost", f.cost ?? {}, costRefs);
  if (f.effects && f.effects.length) {
    const sec = document.createElement("div");
    sec.className = "tip-sec";
    const lab = document.createElement("div");
    lab.className = "tip-sec-label";
    lab.textContent = f.effects.length > 1 ? "Effects" : "Effect";
    sec.appendChild(lab);
    for (const e of f.effects) {
      const row = document.createElement("div");
      row.className = "tip-row";
      const s = document.createElement("span");
      s.textContent = describeEffect(e);
      row.appendChild(s);
      sec.appendChild(row);
    }
    tip.appendChild(sec);
  }
  const hsec = document.createElement("div");
  hsec.className = "tip-sec";
  const hlab = document.createElement("div");
  hlab.className = "tip-sec-label";
  hlab.textContent = "Housing";
  hsec.appendChild(hlab);
  const hrow = document.createElement("div");
  hrow.className = "tip-row";
  const hk = document.createElement("span");
  hk.textContent = "Floor Space:";
  const hv = document.createElement("span");
  hv.textContent = formatNum(f.space ?? 1);
  hrow.appendChild(hk);
  hrow.appendChild(hv);
  hsec.appendChild(hrow);
  tip.appendChild(hsec);
  if (f.flavor) {
    const flavor = document.createElement("div");
    flavor.className = "tip-flavor";
    flavor.textContent = f.flavor;
    tip.appendChild(flavor);
  }
  card.appendChild(tip);

  card.tabIndex = 0;
  uiRefs.set("f:" + f.id, { root: card, owned, buy, sell, sellNotice: snotice, tipCount: count, costs: costRefs });
  // Buy vs Sell highlight on their own buttons (card background counts as
  // Buy): moving between buttons switches the mode; leaving the card turns
  // both off. The ring hits every mirror copy via hiResources.
  const buyHi = (on) => hiResources({ costs: f.cost, gains: furnitureBuyGains(f) }, on);
  const sellHi = (on) => hiResources({ costs: furnitureBuyGains(f), gains: { ...(f.cost ?? {}) } }, on);
  let hiMode = null;
  function setHi(mode) {
    if (mode === hiMode) return;
    if (hiMode === "buy") buyHi(false);
    else if (hiMode === "sell") sellHi(false);
    hiMode = mode;
    if (mode === "buy") buyHi(true);
    else if (mode === "sell") sellHi(true);
  }
  // Info tooltip upkeep (same on Buy and Sell hover; the Sell tooltip is
  // positioned too). Live row tints refresh every frame via render().
  function openInfo() {
    placeFurnTip(tip, card);
    const ref = uiRefs.get("f:" + f.id);
    hoverTip = ref ? { key: "f:" + f.id, ref, costs: f.cost } : null;
    if (ref) tintTip(ref, f.cost);
  }
  function closeInfo() {
    if (hoverTip && hoverTip.key === "f:" + f.id) hoverTip = null;
  }
  card.addEventListener("mouseenter", () => { openInfo(); setHi("buy"); });
  buy.addEventListener("mouseenter", () => { openInfo(); setHi("buy"); });
  sell.addEventListener("mouseenter", () => { openInfo(); placeFurnTip(stip, sell); setHi("sell"); });
  card.addEventListener("mouseleave", () => { closeInfo(); setHi(null); });
  card.addEventListener("focusin", () => { openInfo(); setHi(sell.contains(document.activeElement) ? "sell" : "buy"); });
  card.addEventListener("focusout", (e) => { if (!card.contains(e.relatedTarget)) { closeInfo(); setHi(null); } });
  return card;
}

function buildFurnitureCards() {
  furnitureCtn.innerHTML = "";
  const list = sortedFurniture();
  if (!list.length) {
    const d = document.createElement("div");
    d.className = "emptyNote";
    d.textContent = "None yet.";
    furnitureCtn.appendChild(d);
    return;
  }
  for (const f of list) furnitureCtn.appendChild(buildFurnitureCard(f));
}

function selectHome(id) {
  const h = getHome(id);
  if (!h || !state.homes[id]) return;
  if (state.currentHome === id) return;
  // Switch needs room: the target must fit everything already placed.
  // A bigger home always fits; a smaller one needs selling first.
  if (furnitureSpaceUsed() > h.space) return;
  state.currentHome = id;
  log("You move into the " + h.name + ".");
  buildHomeList();
  buildUI();
  render();
}

function buildHomeList() {
  homeListCtn.innerHTML = "";
  const used = furnitureSpaceUsed();
  // Only owned homes are listed - anything not yet bought stays hidden
  // (its Shop upgrade is how you discover it). Replaced homes are gone
  // from state already, so this is just the homes you actually hold.
  for (const h of HOMES) {
    if (!state.homes[h.id]) continue;
    const isCur = state.currentHome === h.id;
    const fits = used <= h.space;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "homeRow" + (isCur ? " current" : "");
    const nm = document.createElement("span");
    nm.className = "homeRowName";
    nm.textContent = h.name;
    const sp = document.createElement("span");
    sp.className = "homeRowSpace";
    sp.textContent = h.space + " Floor Space";
    const st = document.createElement("span");
    st.className = "homeRowStatus";
    st.textContent = isCur ? "Current" : !fits ? "No room" : "";
    btn.appendChild(nm);
    btn.appendChild(sp);
    btn.appendChild(st);
    // Dynamic tooltip: all of the home's information.
    const tip = document.createElement("span");
    tip.className = "tip";
    const head = document.createElement("div");
    head.className = "tip-head";
    const title = document.createElement("span");
    title.textContent = h.name;
    const count = document.createElement("span");
    count.className = "tip-count";
    count.textContent = h.space + " Floor Space";
    head.appendChild(title);
    head.appendChild(count);
    tip.appendChild(head);
    const headTags = buildTipTags(h);
    if (headTags) tip.appendChild(headTags);
    if (h.tooltip) {
      const desc = document.createElement("div");
      desc.className = "tip-desc";
      desc.textContent = h.tooltip;
      tip.appendChild(desc);
    }
    if (h.effects && h.effects.length) {
      const sec = document.createElement("div");
      sec.className = "tip-sec";
      const lab = document.createElement("div");
      lab.className = "tip-sec-label";
      lab.textContent = h.effects.length > 1 ? "Effects" : "Effect";
      sec.appendChild(lab);
      for (const e of h.effects) {
        const row = document.createElement("div");
        row.className = "tip-row";
        const s = document.createElement("span");
        s.textContent = describeEffect(e);
        row.appendChild(s);
        sec.appendChild(row);
      }
      tip.appendChild(sec);
    }
    if (!fits) {
      const note = document.createElement("div");
      note.className = "tip-flavor";
      note.textContent = "Free up " + (used - h.space) + " more Floor Space to move here.";
      tip.appendChild(note);
    }
    btn.appendChild(tip);
    btn.disabled = isCur || !fits;
    btn.addEventListener("click", () => selectHome(h.id));
    homeListCtn.appendChild(btn);
  }
}
