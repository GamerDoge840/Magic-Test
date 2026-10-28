// Labor Game tooltips: builders, placement, hover highlights, row tints.
function appendTipSection(tip, label, entries, valueRefs) {
  const rows = Object.entries(entries ?? {});
  if (!rows.length) return;
  const sec = document.createElement("div");
  sec.className = "tip-sec";
  const lab = document.createElement("div");
  lab.className = "tip-sec-label";
  lab.textContent = label;
  sec.appendChild(lab);
  for (const [id, n] of rows) {
    const def = getResource(id);
    const row = document.createElement("div");
    row.className = "tip-row";
    const k = document.createElement("span");
    k.textContent = (def ? def.name : id) + ":";
    const v = document.createElement("span");
    v.textContent = formatNum(n);
    row.appendChild(k);
    row.appendChild(v);
    sec.appendChild(row);
    // Optional live refs: improved actions update these rows every frame
    // so Results always shows the leveled-up payout, not the base gains.
    if (valueRefs) valueRefs.push({ id, el: v });
  }
  tip.appendChild(sec);
}

// Visible bounds for an anchor: the viewport shrunk by every clipping
// ancestor (overflow auto/hidden/scroll - e.g. the Actions scroll list and
// its panel). Tips must fit inside these bounds, not just the viewport, or
// the window edge cuts them off.
function visibleBounds(anchor) {
  let top = 8, bottom = window.innerHeight - 8;
  let left = 8, right = window.innerWidth - 8;
  let el = anchor.parentElement;
  while (el && el !== document.body) {
    let st = null;
    try { st = getComputedStyle(el); } catch (e) { break; }
    if (st && (st.overflowY === "auto" || st.overflowY === "hidden" || st.overflowY === "scroll" ||
               st.overflowX === "auto" || st.overflowX === "hidden" || st.overflowX === "scroll")) {
      const r = el.getBoundingClientRect();
      if (r.bottom > r.top && r.right > r.left) {
        if (r.top > top) top = r.top;
        if (r.bottom < bottom) bottom = r.bottom;
        if (r.left > left) left = r.left;
        if (r.right < right) right = r.right;
      }
    }
    el = el.parentElement;
  }
  return { top, bottom, left, right };
}
// Automatic tooltip fitting (the "tips just work" fix): every tip flips
// up/down by available room, caps its height to the winning side
// with internal scroll, and nudges horizontally to stay on screen. Called
// on hover/focus for every tip type, so long present AND future tips never
// clip through the top of the screen or blow out the action menu. The CSS
// max-height backstop covers tips with no JS wiring; this covers placement.
// Only writes when something changes, so open-tip scroll pos stays stable.
function fitTip(tip, anchor, prefer) {
  if (!tip || !anchor) return;
  // Measure the tip's TRUE geometry first: stale inline writes from a
  // previous fit would otherwise distort this run. A leftover maxHeight
  // shrinks the measured height, so the cap looks unneeded, gets cleared,
  // and the tip balloons past the window with no further run to fix it;
  // a leftover margin clamp shifts the measured rect, so the new clamp
  // compounds sideways instead of centering. Display itself is CSS-driven
  // (:hover) and untouched - only fitTip's own four props reset. The reset
  // values are saved first: a hidden tip (display:none from :hover rules,
  // e.g. furnInfo while the sell tip shows)
  // measures 0, and bailing with the reset in place would wipe its
  // last-good placement - revealed later in the wrong spot.
  const keepTop = tip.style.top, keepBottom = tip.style.bottom,
    keepMaxH = tip.style.maxHeight, keepML = tip.style.marginLeft;
  tip.style.top = "";
  tip.style.bottom = "";
  tip.style.maxHeight = "";
  tip.style.marginLeft = "";
  const h = tip.offsetHeight;
  if (!h) {
    tip.style.top = keepTop;
    tip.style.bottom = keepBottom;
    tip.style.maxHeight = keepMaxH;
    tip.style.marginLeft = keepML;
    return;
  }
  const b = anchor.getBoundingClientRect();
  // Room is measured against the visible bounds (viewport shrunk by every
  // clipping ancestor), so a tip inside the Actions window can never be
  // placed where the window edge would cut it off.
  const bounds = typeof visibleBounds === "function"
    ? visibleBounds(anchor)
    : { top: 8, bottom: window.innerHeight - 8, left: 8, right: window.innerWidth - 8 };
  const roomUp = b.top - bounds.top;
  const roomDown = bounds.bottom - b.bottom;
  let dir = prefer;
  if (prefer === "up") {
    if (roomUp < h + 8 && roomDown > roomUp) dir = "down";
  } else {
    if (roomDown < h + 8 && roomUp > roomDown) dir = "up";
  }
  // Tips overlap their anchor by 2px instead of floating above/below it
  // (bottom/top 100% minus 2px): with a gap, the mouse path from the anchor
  // to the tip crosses a dead zone where :hover drops and the tip blinks
  // out - making the scrollbar of a long tip unreachable. The overlap is
  // invisible (the tip paints above, z-index 10) and the hover path stays
  // unbroken, so long tips can be scrolled while an action runs or idle.
  const TIP_OFF = "calc(100% - 2px)";
  if (dir === "up") {
    if (tip.style.top !== "auto") tip.style.top = "auto";
    if (tip.style.bottom !== TIP_OFF) tip.style.bottom = TIP_OFF;
  } else {
    if (tip.style.bottom !== "auto") tip.style.bottom = "auto";
    if (tip.style.top !== TIP_OFF) tip.style.top = TIP_OFF;
  }
  // Cap to the winning side (never above the CSS cap). The 80px
  // readability floor yields to geometry: a shorter scrollbox keeps every
  // line reachable, while even 1px of overflow gets cut off by the panel -
  // so a side with 76px of room gets a 76px tip, not an 80px one poking
  // through. Only with no room at all do we fall back to 80px.
  const room = dir === "up" ? roomUp : roomDown;
  const cs = getComputedStyle(tip);
  const chrome = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) +
    (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  const gap = 0;
  const avail = Math.floor(room - gap - chrome);
  const cssCap = Math.min(360, window.innerHeight * 0.7);
  const cap = avail <= 0 ? 80 : avail < 80 ? avail : Math.min(avail, cssCap);
  if (room < h + 8) {
    const px = cap + "px";
    if (tip.style.maxHeight !== px) tip.style.maxHeight = px;
  } else if (tip.style.maxHeight) {
    tip.style.maxHeight = "";
  }
  // Horizontal clamp for centered tips (left:50% ones): shift inboard when
  // near a window edge. Left-anchored tips (actions/furniture) skip this.
  const centered = getComputedStyle(tip).transform !== "none";
  if (centered) {
    const r = tip.getBoundingClientRect();
    let shift = 0;
    if (r.left < bounds.left) shift = bounds.left - r.left;
    else if (r.right > bounds.right) shift = bounds.right - r.right;
    const want = shift ? Math.round(shift) + "px" : "";
    if (tip.style.marginLeft !== want) tip.style.marginLeft = want;
  } else if (tip.style.marginLeft) {
    tip.style.marginLeft = "";
  }
}

// Skill XP section for action tooltips: which skills an action feeds per
// cycle (e.g. Research Scrolls -> Basic Knowledge +1). Static amounts;
// unknown skill ids still list by id (normalizeConfig already warned).
// The section is built once with every row, but locked skills (e.g. Odd
// Jobs Mastery before its unlock milestone) hide until unlocked - unlocks
// fire mid-session with no UI rebuild, so render() unhides the rows and
// the section live (see the action block there). Returns refs for that.
function appendTipXpSection(tip, xp) {
  const rows = Object.entries(xp ?? {});
  if (!rows.length) return null;
  const sec = document.createElement("div");
  sec.className = "tip-sec";
  const lab = document.createElement("div");
  lab.className = "tip-sec-label";
  lab.textContent = "Skill XP";
  sec.appendChild(lab);
  const refs = [];
  let anyVisible = false;
  for (const [sid, n] of rows) {
    const s = typeof getSkill === "function" ? getSkill(sid) : null;
    const row = document.createElement("div");
    row.className = "tip-row";
    const shown = typeof skillUnlocked !== "function" || skillUnlocked(sid);
    row.hidden = !shown;
    if (shown) anyVisible = true;
    const k = document.createElement("span");
    k.textContent = (s ? s.name : sid) + ":";
    const v = document.createElement("span");
    v.textContent = "+" + formatNum(n);
    row.appendChild(k);
    row.appendChild(v);
    sec.appendChild(row);
    refs.push({ sid, row, el: v });
  }
  sec.hidden = !anyVisible;
  tip.appendChild(sec);
  return { sec, rows: refs };
}

// Action tips prefer opening upward (never grows the page/scroll area), but
// flip downward when the actions column itself scrolls and there is no room
// above the button (otherwise the tip would be cut off). Long tips also cap
// to the winning side via fitTip, so they scroll internally instead of
// blowing out the menu.
function placeActionTip(btn) {
  const tip = btn.querySelector(".tip");
  const ctn = document.getElementById("actionsCtn");
  if (!tip || !ctn) return;
  const h = tip.offsetHeight;
  if (!h) return;
  const c = ctn.getBoundingClientRect();
  const b = btn.getBoundingClientRect();
  const roomUp = b.top - c.top;
  const roomDown = ctn.scrollHeight > ctn.clientHeight + 1 ? c.bottom - b.bottom : Infinity;
  const prefer = (roomUp >= h + 8 || roomUp >= roomDown) ? "up" : "down";
  fitTip(tip, btn, prefer);
  if (typeof syncTipPointer === "function") syncTipPointer(btn, true);
}

// Fill defaults, auto-write missing descriptions, and turn config
// mistakes into warnings instead of crashes (bad entries are removed in
// place, so later engine loops stay safe). Lets minimal entries work:
// { id: "wood", name: "Wood" } is already a valid currency, and
// { id: "doX", name: "Do X", gains: { coin: 1 } } is a valid action.
// Hovering an action faintly rings the currencies/vitals it drains (red)
// or fills (green) - always through effectiveGains, so improved payouts and
// furniture/home boosts highlight too.
// Shared panels: the ring hits EVERY visible copy (Work + Home + later tabs).
function hiResources(a, on) {
  for (const id of Object.keys(a.costs ?? {})) for (const ref of getResourceRefs(id)) ref.root.classList.toggle("spendHi", on);
  for (const id of Object.keys(effectiveGains(a))) for (const ref of getResourceRefs(id)) ref.root.classList.toggle("gainHi", on);
}

// Upgrade effect targets (e.g. the Coin whose max Pockets raises) as a
// gains-like map, so upgrades reuse the action highlight system as-is.
function effectGains(u) {
  const out = {};
  for (const e of u.effects ?? []) if (e.resource) out[e.resource] = 0;
  return out;
}

// A stopped action sitting on a paid cycle resumes for free, so its tip
// rows must not glow red for costs that won't be charged this cycle.
// (A running paid action keeps the normal tint - its next cycles pay.)
function tipCostsFor(action, costs) {
  if (!action) return costs;
  const cyc = state.cycles[action.id];
  if (cyc && cyc.paid && state.currentActionId !== action.id) return {};
  return costs;
}

let hoverTip = null; // { key, ref, costs } of the action/upgrade whose tip is open

// Tips are pointer-transparent (CSS pointer-events:none), so presses can
// never land inside one: no swallow guard needed. Tips show purely via
// CSS :hover on the anchor and close the instant the pointer leaves it.

// Tooltip row tints, refreshed while a tip is open: unaffordable cost rows
// glow red, and gain rows whose resource sits at its storage cap glow orange.
function tintTip(ref, costs) {
  for (const { id, el } of ref.costs ?? []) {
    el.parentElement.classList.toggle("short", (state.amounts[id] ?? 0) < (costs?.[id] ?? 0));
  }
  for (const { id, el } of ref.gains ?? []) {
    const max = getEffectiveMax(id);
    el.parentElement.classList.toggle("capped", max !== Infinity && (state.amounts[id] ?? 0) >= max);
  }
}

function openTip(key, btn, hi, costs) {
  placeActionTip(btn);
  hi(true);
  const ref = uiRefs.get(key);
  hoverTip = ref ? { key, ref, costs } : null;
  // Paid-resume actions tint against a free ride (see tipCostsFor).
  if (ref) tintTip(ref, key.startsWith("a:") ? tipCostsFor(getAction(key.slice(2)), costs) : costs);
}

function closeTip(key, hi) {
  hi(false);
  if (hoverTip && hoverTip.key === key) hoverTip = null;
}

// Pointer policy: only scrollbar tips take the pointer. A tip whose content
// is taller than its fitted box gets pointer-events:auto so the cursor can
// rest on it and use its scrollbar; every other tip stays
// pointer-transparent (CSS) and closes the instant the pointer moves onto
// it. Open paths pass force=true (tip is measurable on hover/focus); the
// per-frame backstop in render.js uses the throttle, so mid-hover changes
// (unlock rows unhiding, live values re-wrapping) still follow without a
// layout read every frame.
let lastPointerSync = 0;
function syncTipPointer(anchor, force) {
  if (!anchor || !anchor.querySelectorAll) return;
  const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
  if (!force && now - lastPointerSync < 200) return;
  lastPointerSync = now;
  const tips = anchor.querySelectorAll(".tip");
  for (const t of tips) {
    const scrollable = t.scrollHeight > t.clientHeight + 1;
    if ((t.style.pointerEvents === "auto") !== scrollable) {
      t.style.pointerEvents = scrollable ? "auto" : "";
    }
  }
}

// Presses landing inside a tip must not activate its parent: grabbing a
// scrollbar tip's scrollbar, selecting tip text, or clicking inside it must
// not start/stop the action or buy the upgrade. Only scrollbar tips can be
// hit (the rest are pointer-transparent), so this only ever fires for those.
let tipPress = false;
document.addEventListener("pointerdown", (e) => {
  tipPress = !!(e && e.target && e.target.closest && e.target.closest(".tip"));
}, true);
document.addEventListener("click", (e) => {
  const onTip = !!(e && e.target && e.target.closest && e.target.closest(".tip"));
  // Swallow presses that started inside a tip (including scrollbar drags
  // that end outside it), so the parent button never activates.
  if (tipPress || onTip) {
    tipPress = false;
    e.stopPropagation();
  } else {
    tipPress = false;
  }
}, true);

