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
  if ((typeof worldShopBlocked === "function") && worldShopBlocked(f)) {
    log(tileBlockedMessage(f, "buy"));
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
  // Crafting tab: buying any "Crafting"-tagged furniture reveals it
  // permanently (sticky - selling everything afterwards keeps the tab).
  if (getTags(f).includes("Crafting")) state.unlocked["tab:crafting"] = true;
  // Station plans: the first furniture of a crafting station unlocks
  // that group's starter plans (e.g. a Cooking Pot unlocks Roasting).
  if (typeof unlockStarterPlans === "function") unlockStarterPlans(f);
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
    // Same overheal guard as doTick: never drain a meal buffer with a refund.
    const cur = state.amounts[rid] ?? 0;
    if (rid === "stamina" && cur > max) state.amounts[rid] = Math.max(cur, Math.min(max, cur + n));
    else state.amounts[rid] = max === Infinity ? cur + n : Math.min(max, cur + n);
    if (n > 0) {
      markCurrencySeen(rid);
      // Item refunds discover like any other find (see doTick).
      if (typeof getItem === "function" && getItem(rid)) {
        if (!state.seen) state.seen = {};
        state.seen[rid] = true;
      }
    }
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

// Tip placement: tips escape the furniture list box via position:fixed
// (viewport-relative), so they never shrink into unusable nubs or clip at
// the list's top edge. The list box is short (about one screen of cards),
// so confining tips to it capped top-row tips at ~50px once the list
// learned to scroll internally. Fixed tips are clipped by nothing but the
// viewport (no transformed ancestors between the tip and the window), and
// painting over neighboring cards while open matches every other tip type.
// The node itself stays in place (only its positioning detaches), so the
// :hover/:focus-within show rules and the press-swallow guard keep working;
// closeInfo clears the inline positioning again. Scroll/resize while open
// re-places (see the trackers below), so the tip follows its anchor.
function placeFurnTip(tip, anchor) {
  if (!tip || !anchor) return;
  // Measure the tip's TRUE geometry first (same reset discipline as
  // fitTip): stale inline writes from a previous fit would shrink the
  // measured height and the cap would compound on every hover.
  const keep = { position: tip.style.position, top: tip.style.top, bottom: tip.style.bottom, left: tip.style.left, transform: tip.style.transform, maxHeight: tip.style.maxHeight, marginLeft: tip.style.marginLeft };
  tip.style.position = "";
  tip.style.top = "";
  tip.style.bottom = "";
  tip.style.left = "";
  tip.style.transform = "";
  tip.style.maxHeight = "";
  tip.style.marginLeft = "";
  const h = tip.offsetHeight;
  if (!h) {
    tip.style.position = keep.position;
    tip.style.top = keep.top;
    tip.style.bottom = keep.bottom;
    tip.style.left = keep.left;
    tip.style.transform = keep.transform;
    tip.style.maxHeight = keep.maxHeight;
    tip.style.marginLeft = keep.marginLeft;
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
  // NOTE: cs is a LIVE declaration - read everything off it before writing
  // any inline style below (writing first would echo back here).
  const centered = cs.transform !== "none";
  const chrome = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) +
    (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  const avail = Math.floor(room - chrome);
  const cssCap = Math.min(360, VH * 0.7);
  const cap = avail <= 0 ? 80 : avail < 80 ? avail : Math.min(avail, cssCap);
  if (room < h + 8) tip.style.maxHeight = cap + "px";
  // Detach: explicit viewport pixels from here on (percentages would resolve
  // against the viewport under fixed positioning). Width is measured after
  // the cap lands, since wrapping depends on it.
  tip.style.position = "fixed";
  tip.style.bottom = "auto";
  tip.style.marginLeft = "";
  tip.style.transform = "none";
  const w = tip.offsetWidth;
  const wantLeft = centered ? b.left + b.width / 2 - w / 2 : b.left;
  tip.style.left = Math.max(8, Math.min(Math.round(wantLeft), VW - 8 - w)) + "px";
  tip.style.top = dir === "down" ? Math.round(b.bottom - 2) + "px" : Math.round(b.top + 2 - tip.offsetHeight) + "px";
  if (typeof syncTipPointer === "function") syncTipPointer(anchor, true);
}

// Undo placeFurnTip: the next open re-fits from scratch, so no stale fixed
// position may survive a close (a CSS reshown tip would otherwise sit at
// old viewport pixels without any placer running).
function clearFurnTip(tip) {
  if (!tip) return;
  tip.style.position = "";
  tip.style.top = "";
  tip.style.bottom = "";
  tip.style.left = "";
  tip.style.transform = "";
  tip.style.maxHeight = "";
  tip.style.marginLeft = "";
}

// While a furniture tip is open, scrolling or resizing would strand its
// fixed pixels away from the anchor: re-place instead (both tips - the
// hidden one bails on its zero height). Scroll events don't bubble, so the
// window listener uses capture to catch list/panel/page scrolls alike.
if (typeof window !== "undefined" && !window.__furnTipTrack) {
  window.__furnTipTrack = true;
  const retrackFurnTip = () => {
    if (hoverTip && typeof hoverTip.key === "string" && hoverTip.key.startsWith("f:") && hoverTip.ref && hoverTip.ref.root && hoverTip.ref.root.isConnected) {
      const card = hoverTip.ref.root;
      const info = card.querySelector(":scope > .tip.furnInfo");
      if (info && getComputedStyle(info).display !== "none") placeFurnTip(info, card);
      const sellBtn = hoverTip.ref.sell;
      const stip = sellBtn && sellBtn.querySelector(":scope > .tip");
      if (stip && sellBtn && getComputedStyle(stip).display !== "none") placeFurnTip(stip, sellBtn);
    }
  };
  window.addEventListener("scroll", retrackFurnTip, true);
  window.addEventListener("resize", retrackFurnTip);
}

function buildFurnitureCard(f) {
  const card = document.createElement("div");
  card.className = "furnCard";
  card.id = "furn-" + f.id;
  // Hidden until the Home render pass says otherwise (no home yet on a
  // fresh save means every card is gated, and that pass is skipped).
  card.hidden = true;
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
  snotice.className = "tip-flavor tip-overflow tip-teal";
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
  appendUnlockSection(tip, f);
  const costRefs = [];
  appendTipSection(tip, "Cost", f.cost ?? {}, costRefs);
  if (f.effects && f.effects.length) {
    const { sec, body } = makeTipSection(f.effects.length > 1 ? "Effects" : "Effect");
    for (const e of f.effects) {
      const row = document.createElement("div");
      row.className = "tip-row";
      const s = document.createElement("span");
      s.textContent = describeEffect(e);
      row.appendChild(s);
      body.appendChild(row);
    }
    tip.appendChild(sec);
  }
  const { sec: hsec, body: hbody } = makeTipSection("Housing");
  const hrow = document.createElement("div");
  hrow.className = "tip-row";
  const hk = document.createElement("span");
  hk.textContent = "Floor Space:";
  const hv = document.createElement("span");
  hv.textContent = formatNum(f.space ?? 1);
  hrow.appendChild(hk);
  hrow.appendChild(hv);
  hbody.appendChild(hrow);
  tip.appendChild(hsec);
  const rsec = (typeof appendTileRequirementSection === "function") ? appendTileRequirementSection(tip, f) : null;
  if (f.flavor) {
    const flavor = document.createElement("div");
    flavor.className = "tip-flavor";
    flavor.textContent = f.flavor;
    tip.appendChild(flavor);
  }
  card.appendChild(tip);

  card.tabIndex = 0;
  uiRefs.set("f:" + f.id, { root: card, name: nm, owned, buy, sell, sellNotice: snotice, tipCount: count, costs: costRefs, reqSec: rsec });
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
    // Same ownership as action/upgrade tips (see tips.js): the newest
    // hover clears first, and leaving only clears while still the owner.
    if (mode === "buy" || mode === "sell") {
      claimHi("f:" + f.id);
      (mode === "buy" ? buyHi : sellHi)(true);
    } else releaseHi("f:" + f.id);
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
    clearFurnTip(tip);
    if (typeof stip !== "undefined") clearFurnTip(stip);
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
  if (typeof resetHi === "function") resetHi();
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
      const { sec, body } = makeTipSection(h.effects.length > 1 ? "Effects" : "Effect");
      for (const e of h.effects) {
        const row = document.createElement("div");
        row.className = "tip-row";
        const s = document.createElement("span");
        s.textContent = describeEffect(e);
        row.appendChild(s);
        body.appendChild(row);
      }
      tip.appendChild(sec);
    }
    if (!fits) {
      const note = document.createElement("div");
      note.className = "tip-flavor tip-teal";
      note.textContent = "Free up " + (used - h.space) + " more Floor Space to move here.";
      tip.appendChild(note);
    }
    btn.appendChild(tip);
    btn.disabled = isCur || !fits;
    btn.addEventListener("click", () => selectHome(h.id));
    // Automatic placement: long home tips flip/cap instead of clipping.
    if (typeof fitTip === "function") {
      const homeTip = tip;
      const fit = () => { fitTip(homeTip, btn, "up"); if (typeof syncTipPointer === "function") syncTipPointer(btn, true); };
      btn.addEventListener("mouseenter", fit);
      btn.addEventListener("focus", fit);
    }
    homeListCtn.appendChild(btn);
  }
}
