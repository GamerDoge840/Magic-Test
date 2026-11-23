// Labor Game tooltips: builders, placement, hover highlights, row tints.
// Full-bleed section dividers: .tip-sec is a full-width block whose
// border-top spans the whole tooltip (negative margins over the tip's
// padding), while .tip-sec-body keeps the old shrink-wrapped table
// layout - so every label and row stays exactly where it was.
function makeTipSection(labelText, extraClass) {
  const sec = document.createElement("div");
  sec.className = "tip-sec" + (extraClass ? " " + extraClass : "");
  const body = document.createElement("div");
  body.className = "tip-sec-body";
  const lab = document.createElement("div");
  lab.className = "tip-sec-label";
  lab.textContent = labelText;
  body.appendChild(lab);
  sec.appendChild(body);
  return { sec, body, lab };
}

function appendTipSection(tip, label, entries, valueRefs) {
  const rows = Object.entries(entries ?? {});
  if (!rows.length) return;
  const { sec, body } = makeTipSection(label);
  for (const [id, n] of rows) {
    const def = getResource(id);
    // "tag:" recipe inputs have no item def: show the tag instead.
    const tagLabel = ((typeof isTagInputKey === "function") && isTagInputKey(id))
      ? tagInputTag(id).charAt(0).toUpperCase() + tagInputTag(id).slice(1) + " (any)" : id;
    const row = document.createElement("div");
    row.className = "tip-row";
    const k = document.createElement("span");
    k.textContent = (def ? def.name : tagLabel) + ":";
    const v = document.createElement("span");
    v.textContent = formatNum(n);
    row.appendChild(k);
    row.appendChild(v);
    body.appendChild(row);
    // Optional live refs: improved actions update these rows every frame
    // so Results always shows the leveled-up payout, not the base gains.
    // Row included so render can hide locked rows live (Rest's Health).
    if (valueRefs) valueRefs.push({ id, el: v, row });
  }
  tip.appendChild(sec);
  return sec;
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
    keepMaxH = tip.style.maxHeight, keepML = tip.style.marginLeft,
    keepMaxW = tip.style.maxWidth;
  tip.style.top = "";
  tip.style.bottom = "";
  tip.style.maxHeight = "";
  tip.style.marginLeft = "";
  tip.style.maxWidth = "";
  const h = tip.offsetHeight;
  if (!h) {
    tip.style.top = keepTop;
    tip.style.bottom = keepBottom;
    tip.style.maxHeight = keepMaxH;
    tip.style.marginLeft = keepML;
    tip.style.maxWidth = keepMaxW;
    return;
  }
  const b = anchor.getBoundingClientRect();
  // Room is measured against the visible bounds (viewport shrunk by every
  // clipping ancestor), so a tip inside the Actions window can never be
  // placed where the window edge would cut it off.
  const bounds = typeof visibleBounds === "function"
    ? visibleBounds(anchor)
    : { top: TIP_EDGE, bottom: window.innerHeight - TIP_EDGE, left: TIP_EDGE, right: window.innerWidth - TIP_EDGE };
  const roomUp = b.top - bounds.top;
  const roomDown = bounds.bottom - b.bottom;
  let dir = prefer;
  if (prefer === "up") {
    if (roomUp < h + TIP_BREATHE && roomDown > roomUp) dir = "down";
  } else {
    if (roomDown < h + TIP_BREATHE && roomUp > roomDown) dir = "up";
  }
  // Tips overlap their anchor by 2px instead of floating above/below it
  // (bottom/top 100% minus 2px): with a gap, the mouse path from the anchor
  // to the tip crosses a dead zone where :hover drops and the tip blinks
  // out - making the scrollbar of a long tip unreachable. The overlap is
  // invisible (the tip paints above, z-index 10) and the hover path stays
  // unbroken, so long tips can be scrolled while an action runs or idle.
  const TIP_OFF = "calc(100% - " + TIP_OVERLAP + "px)";
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
  const cssCap = Math.min(TIP_MAX_H, window.innerHeight * TIP_MAX_VH);
  const cap = avail <= 0 ? TIP_MIN_H : avail < TIP_MIN_H ? avail : Math.min(avail, cssCap);
  if (room < h + TIP_BREATHE) {
    const px = cap + "px";
    if (tip.style.maxHeight !== px) tip.style.maxHeight = px;
  } else if (tip.style.maxHeight) {
    tip.style.maxHeight = "";
  }
  // Horizontal clamp for centered tips (left:50% ones): shift inboard
  // when near an edge - but a tip WIDER than its visible home (e.g. a
  // 240px World-mirror tip in the narrow World Actions strip) can't be
  // shifted into fit, so narrow it to the visible width and center it
  // there instead of shoving it sideways off the other edge.
  // Left-anchored tips (detached furniture ones) skip this.
  const centered = getComputedStyle(tip).transform !== "none";
  if (centered) {
    const r = tip.getBoundingClientRect();
    const availW = bounds.right - bounds.left;
    if (r.width > availW + 1) {
      tip.style.maxWidth = Math.max(TIP_MIN_W, Math.floor(availW)) + "px";
      const r2 = tip.getBoundingClientRect();
      const want = Math.round(bounds.left + (availW - r2.width) / 2 - r2.left) + "px";
      if (tip.style.marginLeft !== want) tip.style.marginLeft = want;
    } else {
      let shift = 0;
      if (r.left < bounds.left) shift = bounds.left - r.left;
      else if (r.right > bounds.right) shift = bounds.right - r.right;
      const want = shift ? Math.round(shift) + "px" : "";
      if (tip.style.marginLeft !== want) tip.style.marginLeft = want;
    }
  } else if (tip.style.marginLeft) {
    tip.style.marginLeft = "";
  }
}

// Detached-tip geometry (shared by every place*Tip detached placer).
// One copy of the magic numbers the five detached placers used to repeat:
// viewport/panel edge margin, up/down breathing room, CSS height cap
// (min of px + viewport share), readability floor, anchor overlap, and
// the narrow-tip minimum width. Changing a value here retunes every
// detached tooltip at once (furniture, inventory, skills, world, plans).
const TIP_EDGE = 8;
const TIP_BREATHE = 8;
const TIP_MAX_H = 360;
const TIP_MAX_VH = 0.7;
const TIP_MIN_H = 80;
const TIP_OVERLAP = 2;
const TIP_MIN_W = 120;

function resetDetachedTip(tip) {
  const keep = { position: tip.style.position, top: tip.style.top, bottom: tip.style.bottom, left: tip.style.left, transform: tip.style.transform, maxHeight: tip.style.maxHeight, marginLeft: tip.style.marginLeft };
  tip.style.position = "";
  tip.style.top = "";
  tip.style.bottom = "";
  tip.style.left = "";
  tip.style.transform = "";
  tip.style.maxHeight = "";
  tip.style.marginLeft = "";
  return keep;
}

function restoreDetachedTip(tip, keep, needShow) {
  tip.style.position = keep.position;
  tip.style.top = keep.top;
  tip.style.bottom = keep.bottom;
  tip.style.left = keep.left;
  tip.style.transform = keep.transform;
  tip.style.maxHeight = keep.maxHeight;
  tip.style.marginLeft = keep.marginLeft;
  if (needShow) tip.style.display = "";
}

function clearDetachedTip(tip) {
  if (!tip) return;
  tip.style.position = "";
  tip.style.top = "";
  tip.style.bottom = "";
  tip.style.left = "";
  tip.style.transform = "";
  tip.style.maxHeight = "";
  tip.style.marginLeft = "";
}

// Shared detached-tip fitter: reset -> measure -> cap -> fixed-place.
// opts: { prefer ("up"/"down", default "up"), ceilTop (px, default TIP_EDGE),
// forceShow (measure with display:block when CSS :hover hasn't painted yet) }.
function fitDetachedTip(tip, anchor, opts) {
  if (!tip || !anchor) return;
  const o = opts || {};
  const prefer = o.prefer || "up";
  const ceilTop = (typeof o.ceilTop === "number") ? o.ceilTop : TIP_EDGE;
  const keep = resetDetachedTip(tip);
  let needShow = false;
  if (o.forceShow) {
    needShow = getComputedStyle(tip).display === "none";
    if (needShow) tip.style.display = "block";
  }
  const h = tip.offsetHeight;
  if (!h) { restoreDetachedTip(tip, keep, needShow); return; }
  const VH = window.innerHeight, VW = window.innerWidth;
  const b = anchor.getBoundingClientRect();
  const roomUp = b.top - ceilTop;
  const roomDown = VH - TIP_EDGE - b.bottom;
  let dir = prefer;
  if (prefer === "up") {
    if (roomUp < h + TIP_BREATHE && roomDown > roomUp) dir = "down";
  } else {
    if (roomDown < h + TIP_BREATHE && roomUp > roomDown) dir = "up";
  }
  const room = dir === "up" ? roomUp : roomDown;
  const cs = getComputedStyle(tip);
  const centered = cs.transform !== "none";
  const chrome = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) +
    (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  const avail = Math.floor(room - chrome);
  const cssCap = Math.min(TIP_MAX_H, VH * TIP_MAX_VH);
  const cap = avail <= 0 ? TIP_MIN_H : avail < TIP_MIN_H ? avail : Math.min(avail, cssCap);
  if (room < h + TIP_BREATHE) tip.style.maxHeight = cap + "px";
  tip.style.position = "fixed";
  tip.style.bottom = "auto";
  tip.style.marginLeft = "";
  tip.style.transform = "none";
  const w = tip.offsetWidth;
  const wantLeft = centered ? b.left + b.width / 2 - w / 2 : b.left;
  tip.style.left = Math.max(TIP_EDGE, Math.min(Math.round(wantLeft), VW - TIP_EDGE - w)) + "px";
  tip.style.top = dir === "down" ? Math.round(b.bottom - TIP_OVERLAP) + "px" : Math.round(b.top + TIP_OVERLAP - tip.offsetHeight) + "px";
  if (needShow) tip.style.display = "";
  if (typeof syncTipPointer === "function") syncTipPointer(anchor, true);
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
  const { sec, body } = makeTipSection("Skill XP");
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
    body.appendChild(row);
    refs.push({ sid, row, el: v });
  }
  sec.hidden = !anyVisible;
  tip.appendChild(sec);
  return { sec, rows: refs };
}

// Tile-requirement tooltip section ("Requires: General Store tile"),
// shared by action, upgrade, and furniture tips. Returns the section
// element (or null when the item needs no tile); render() hides it while
// the requirement is met, so it only ever shows off-store.
function appendTileRequirementSection(tip, item) {
  if (typeof tileRequirementTags !== "function") return null;
  if (!tileRequirementTags(item).length) return null;
  const { sec, body } = makeTipSection("Requires", "tip-req");
  const row = document.createElement("div");
  row.className = "tip-row";
  const s = document.createElement("span");
  s.textContent = tileRequirementLabel(item);
  row.appendChild(s);
  body.appendChild(row);
  tip.appendChild(sec);
  return sec;
}

// Shared action-tip body: the same header/tags/desc/Cost/Results/Skill
// XP/Improvement/foot/flavor/Requires tree for Work buttons and World
// Action mirrors, so both tooltips always agree. Returns the tip node
// plus the live refs render() refreshes (counts, payouts, XP rows,
// requirement visibility).
// Tile-lock tooltip section ("Locked: Hamlet"), shared the same
// way. Built for any action some modifier can lock; render() shows it
// only while the CURRENT tile bans this action.
function appendTileLockSection(tip, item) {
  if (!item || !item.id || typeof worldActionLocked !== "function") return null;
  const mods = (typeof WORLD_MODIFIERS !== "undefined") ? WORLD_MODIFIERS : [];
  const lockers = mods.filter(m => {
    const locks = Array.isArray(m.locks) ? m.locks : (m.locks === undefined ? [] : [m.locks]);
    return locks.some(l => typeof l === "string" && l.toLowerCase() === String(item.id).toLowerCase());
  });
  if (!lockers.length) return null;
  const { sec, body } = makeTipSection("Locked");
  const row = document.createElement("div");
  row.className = "tip-row";
  const s = document.createElement("span");
  s.textContent = lockers.map(m => m.name).join(" or ");
  row.appendChild(s);
  body.appendChild(row);
  sec.hidden = true;
  tip.appendChild(sec);
  return sec;
}

// Cycle-time line under the tooltip header (e.g. "Time: 6s per cycle").
// Reads the effective tick so Pillows/skill-milestone speedups show live;
// renderActionTipLive refreshes it (Work buttons and World mirrors alike).
function actionTimeText(a) {
  const t = (typeof getEffectiveTick === "function") ? getEffectiveTick(a) : (a.tickSeconds ?? 1);
  return "Time: " + formatDuration(t, (s) => formatNum(s) + "s") + " per cycle";
}

// Unlock-requirements section for action, upgrade, plan, and furniture
// tooltips: every gate that had to be met before the item appeared, so
// the player can see how they got it. Sits right before the Cost section
// (before the Fuel/Recipes block on plan tips, which have no Cost).
// Items with no gates show a single "none" row. Static config text - no
// live refs.
// Visibility is option-gated (Options > Actions, off by default): the
// section is always built and render() hides it with a body class, the
// same pattern as the action Time line.
function unlockRequirementLines(item, stationTag) {
  const lines = [];
  // Plan station gate (e.g. "Cooking Station" furniture): buying station
  // furniture is what unlocks the plan, so it reads as a requirement.
  if (typeof stationTag === "string" && stationTag) lines.push("Own " + stationTag + " furniture");
  // Furniture-only gates: requiresHome (ANY listed home opens it) and
  // requiresSeenTag (ANY listed tag seen on any item) - each reads as one
  // "or" row, unlike the AND-stacked unlock gates below.
  if (item && (item.requiresHome !== undefined || item.requiresSeenTag !== undefined)) {
    if (item.requiresHome !== undefined) {
      const ids = Array.isArray(item.requiresHome) ? item.requiresHome : [item.requiresHome];
      const names = ids.map(id => {
        const h = (typeof getHome === "function") ? getHome(id) : null;
        return h ? h.name : id;
      });
      if (names.length === 1) lines.push("Own " + names[0]);
      else if (names.length) {
        // Short form: when every option shares words ("Small Tent",
        // "Medium Tent", "Survivalist's Tent"), collapse the lengthy
        // "Own A or B or C" to "Own any Tent".
        const words = names.map(n => String(n).split(/\s+/));
        const common = words[0].filter(w => words.every(ws => ws.some(x => x.toLowerCase() === w.toLowerCase())));
        lines.push(common.length ? "Own any " + common.join(" ") : "Own " + names.join(" or "));
      }
    }
    if (item.requiresSeenTag !== undefined) {
      const tags = Array.isArray(item.requiresSeenTag) ? item.requiresSeenTag : [item.requiresSeenTag];
      if (tags.length) lines.push("Discover a " + tags.join(" or ") + " item");
    }
  }
  const u = item ? item.unlock : null;
  if (u && typeof u === "object" && !Array.isArray(u)) {
    // Seen gates (crafting plans, e.g. Make Salad's Cabbage): every
    // listed item must be discovered at least once (state.seen).
    if (u.seen !== undefined) {
      const list = Array.isArray(u.seen) ? u.seen : [u.seen];
      for (const id of list) {
        if (typeof id !== "string") continue;
        const it = (typeof getItem === "function") ? getItem(id) : null;
        lines.push("Discover " + (it ? (it.name ?? id) : id));
      }
    }
    // Currency gates: legacy { resource, amount } plus the canonical map.
    const res = {};
    if (typeof u.resource === "string" && typeof u.amount === "number" && Number.isFinite(u.amount) && u.amount > 0) res[u.resource] = Math.max(res[u.resource] ?? 0, u.amount);
    if (u.resources && typeof u.resources === "object" && !Array.isArray(u.resources)) {
      for (const [id, n] of Object.entries(u.resources)) {
        if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) continue;
        res[id] = Math.max(res[id] ?? 0, n);
      }
    }
    for (const [id, n] of Object.entries(res)) {
      const d = (typeof getResource === "function") ? getResource(id) : null;
      lines.push("Hold " + formatNum(n) + " " + (d ? displayName(d, n) : id));
    }
    // Home gates: legacy `home` plus canonical `homes` (EVERY one needed).
    const homes = [];
    for (const hk of ["home", "homes"]) {
      const v = u[hk];
      if (v === undefined) continue;
      for (const id of (Array.isArray(v) ? v : [v])) if (typeof id === "string" && !homes.includes(id)) homes.push(id);
    }
    for (const id of homes) {
      const h = (typeof getHome === "function") ? getHome(id) : null;
      lines.push("Own " + (h ? h.name : id));
    }
    // Skill gates: legacy { skill, skillLevel } plus the plural map.
    const skills = {};
    if (typeof u.skill === "string" && u.skill) {
      const sl = u.skillLevel ?? 1;
      if (Number.isInteger(sl) && sl >= 1) skills[u.skill] = Math.max(skills[u.skill] ?? 0, sl);
    }
    if (u.skills && typeof u.skills === "object" && !Array.isArray(u.skills)) {
      for (const [sid, sl] of Object.entries(u.skills)) {
        if (!Number.isInteger(sl) || sl < 1) continue;
        skills[sid] = Math.max(skills[sid] ?? 0, sl);
      }
    }
    for (const [sid, sl] of Object.entries(skills)) {
      const s = (typeof getSkill === "function") ? getSkill(sid) : null;
      lines.push("Reach " + (s ? s.name : sid) + " Level " + sl);
    }
    // Upgrade-ownership gates: legacy { upgrade, upgradeCount } plus map.
    const ups = {};
    if (typeof u.upgrade === "string" && u.upgrade) {
      const uc = u.upgradeCount ?? 1;
      if (Number.isInteger(uc) && uc >= 1) ups[u.upgrade] = Math.max(ups[u.upgrade] ?? 0, uc);
    }
    if (u.upgrades && typeof u.upgrades === "object" && !Array.isArray(u.upgrades)) {
      for (const [uid, uc] of Object.entries(u.upgrades)) {
        if (!Number.isInteger(uc) || uc < 1) continue;
        ups[uid] = Math.max(ups[uid] ?? 0, uc);
      }
    }
    for (const [uid, uc] of Object.entries(ups)) {
      const ug = (typeof getUpgrade === "function") ? getUpgrade(uid) : null;
      lines.push("Own " + (ug ? ug.name : uid) + (uc > 1 ? " ×" + uc : ""));
    }
    // Biome-visit gates: legacy `visitedBiome` plus canonical
    // `visitedBiomes` (EVERY listed biome visited at least once).
    const visits = [];
    for (const vk of ["visitedBiome", "visitedBiomes"]) {
      const v = u[vk];
      if (v === undefined) continue;
      for (const id of (Array.isArray(v) ? v : [v])) if (typeof id === "string" && !visits.some(x => String(x).toLowerCase() === String(id).toLowerCase())) visits.push(id);
    }
    for (const id of visits) {
      const b = (typeof worldBiomeDef === "function") ? worldBiomeDef(id) : null;
      const bname = b ? (b.name ?? id) : id;
      lines.push("Visit a " + bname);
    }
  }
  return lines;
}

function appendUnlockSection(tip, item, stationTag) {
  const { sec, body } = makeTipSection("Unlock requirements", "tip-unlock");
  const lines = unlockRequirementLines(item, stationTag);
  if (!lines.length) lines.push("none");
  for (const t of lines) {
    const row = document.createElement("div");
    row.className = "tip-row";
    const s = document.createElement("span");
    s.textContent = t;
    row.appendChild(s);
    body.appendChild(row);
  }
  tip.appendChild(sec);
  return sec;
}

function buildActionTipBody(a) {
  const tip = document.createElement("span");
  tip.className = "tip";
  const head = document.createElement("div");
  head.className = "tip-head";
  const title = document.createElement("span");
  title.textContent = a.improvements ? "[Lvl. " + actionLevel(a) + "] " + a.name : a.name;
  const count = document.createElement("span");
  count.className = "tip-count";
  count.textContent = "0";
  head.appendChild(title);
  head.appendChild(count);
  tip.appendChild(head);
  const headTags = buildTipTags(a);
  if (headTags) tip.appendChild(headTags);
  const timeRow = document.createElement("div");
  timeRow.className = "tip-time";
  timeRow.textContent = actionTimeText(a);
  tip.appendChild(timeRow);
  const desc = document.createElement("div");
  desc.className = "tip-desc";
  desc.textContent = a.description ?? autoActionDescription({ tickSeconds: a.tickSeconds ?? 1, costs: a.costs ?? {}, gains: a.gains ?? {} });
  tip.appendChild(desc);
  appendUnlockSection(tip, a);
  const costRefs = [];
  // Cost rows cover every tile-override key too (base + all costsByBiome +
  // all costsByTag): an override adding a new resource (e.g. forest-only
  // rope) would otherwise charge a hidden price with no tooltip row.
  // Override-only keys build at 0 and hide until their tile (see live).
  const costBase = { ...(a.costs ?? {}) };
  for (const m of Object.values(a.costsByBiome ?? {})) for (const k of Object.keys(m ?? {})) if (!(k in costBase)) costBase[k] = 0;
  for (const m of Object.values(a.costsByTag ?? {})) for (const k of Object.keys(m ?? {})) if (!(k in costBase)) costBase[k] = 0;
  const costSec = appendTipSection(tip, "Cost", costBase, costRefs) ?? null;
  // Results rows are live for improved actions (payout grows per level):
  // build rows for base gains plus any bonus-only resources, then update.
  // Furniture/home/skill-milestone "gain" effects add payout too, so their
  // resources get rows even when the base action pays nothing of them
  // (skill rows read 0 until their milestone lands, like unlevelled
  // improvement bonuses - render() fills them in live).
  const gainBase = { ...(a.gains ?? {}) };
  for (const k of Object.keys(a.improvements?.bonus ?? {})) if (!(k in gainBase)) gainBase[k] = 0;
  for (const f of FURNITURE) {
    for (const e of f.effects ?? []) {
      if (e.type === "gain" && e.action === a.id && e.resource && !(e.resource in gainBase)) gainBase[e.resource] = 0;
    }
  }
  for (const h of HOMES) {
    for (const e of h.effects ?? []) {
      if (e.type === "gain" && e.action === a.id && e.resource && !(e.resource in gainBase)) gainBase[e.resource] = 0;
    }
  }
  if (typeof allSkillMilestoneEffects === "function") {
    for (const x of allSkillMilestoneEffects()) {
      const e = x.effect;
      if (e.type === "gain" && e.action === a.id && e.resource && !(e.resource in gainBase)) gainBase[e.resource] = 0;
    }
  }
  // Vital-restoration rows (see heals in config/actionsConfig.js) stay
  // hidden until their vital unlocks: the payout is not real until then,
  // so the tooltip must not spoil it. Unlocks fire mid-session with no UI
  // rebuild, so renderActionTipLive unhides the row live (same pattern as
  // locked Skill XP rows). The value reads live like every other row - as
  // a share of max ("2% of Max"), since the grant is defined as a percent
  // (see pctOfMaxText).
  for (const k of Object.keys(a.heals ?? {})) if (!(k in gainBase)) gainBase[k] = 0;
  const gainRefs = [];
  appendTipSection(tip, "Results", gainBase, gainRefs);
  // Cap-based vital restoration displays as a percentage of max,
  // not an absolute payout.
  for (const g of gainRefs) if (g.id in (a.heals ?? {})) {
    g.pctOfMax = true;
    if (typeof resourceUnlocked === "function" && typeof getResource === "function") {
      const r = getResource(g.id);
      if ((!r || !resourceUnlocked(r)) && g.row) g.row.hidden = true;
    }
  }
  // Skill XP the action grants per cycle (e.g. Research Scrolls -> Basic
  // Knowledge). Listed right after Results so no payout goes unmentioned.
  // Rows for locked skills build hidden and unhide live in render().
  // XP rows cover every tile-override skill too (base + all xpByBiome +
  // xpByTag): a forest-only skill would otherwise grant hidden XP.
  const xpBase = { ...(a.xp ?? {}) };
  for (const m of Object.values(a.xpByBiome ?? {})) for (const k of Object.keys(m ?? {})) if (!(k in xpBase)) xpBase[k] = 0;
  for (const m of Object.values(a.xpByTag ?? {})) for (const k of Object.keys(m ?? {})) if (!(k in xpBase)) xpBase[k] = 0;
  const xpBuilt = (typeof appendTipXpSection === "function") ? appendTipXpSection(tip, xpBase) : null;
  // Gather odds (gather actions only, e.g. Forage): the current tile's
  // loot table with each item's share. Unseen items show as "???" in
  // their rarity color. Refreshed live in render() (moving tiles or
  // first-time finds rebuild the rows).
  const gatherSec = appendGatherSection(tip, a);
  // The max-level line is live (skill milestones can raise the cap), so
  // keep its row: render() refreshes the text whenever the cap moves.
  let impMaxRow = null;
  if (a.improvements) {
    const { sec: impSec, body: impBody } = makeTipSection("Improvement");
    const impMax = (typeof getEffectiveImpMax === "function") ? getEffectiveImpMax(a) : a.improvements.maxLevel;
    const impLines = ["Level up every " + a.improvements.every + " actions.", "Max level: " + (impMax === Infinity ? "none" : impMax) + "."];
    const impBonus = describeCost(a.improvements.bonus);
    if (impBonus) impLines.push("Bonus per level: +" + impBonus + ".");
    impLines.forEach((t, i) => {
      const row = document.createElement("div");
      row.className = "tip-row";
      row.textContent = t;
      impBody.appendChild(row);
      if (i === 1) impMaxRow = row;
    });
    tip.appendChild(impSec);
  }
  // Bottom line for improved actions: live progress to the next level.
  // Built before the flavor and requirement so the flavor always lands last.
  let foot = null;
  if (a.improvements) {
    foot = document.createElement("div");
    foot.className = "tip-flavor tip-teal";
    foot.textContent = improvementFooter(a);
    tip.appendChild(foot);
  }
  const reqSec = appendTileRequirementSection(tip, a);
  const lockSec = appendTileLockSection(tip, a);
  if (a.flavor) {
    const flavor = document.createElement("div");
    flavor.className = "tip-flavor";
    flavor.textContent = a.flavor;
    tip.appendChild(flavor);
  }
  return { tip, refs: { title, tc: count, tipTime: timeRow, desc, autoDesc: !!a._autoDesc, costs: costRefs, costSec, gains: gainRefs, impMax: impMaxRow, foot, xpSec: xpBuilt ? xpBuilt.sec : null, xpRows: xpBuilt ? xpBuilt.rows : null, gatherSec, reqSec, lockSec } };
}

// Gather-odds section for gather actions: one row per loot-table entry
// (name in its rarity color + percentage share), rebuilt whenever the
// current table or any entry's seen state changes. Items never found yet
// hide behind "???" (still in their rarity color). Tiles with no table
// get a single "nothing here" row. Returns { sec, sig } for the live
// refresh, or null for non-gather actions.
function appendGatherSection(tip, a) {
  if (!a || a.gather !== true) return null;
  const { sec, body: inner } = makeTipSection("Gather");
  const body = document.createElement("div");
  inner.appendChild(body);
  tip.appendChild(sec);
  const ref = { sec, body, sig: null };
  refreshGatherSection(a, ref);
  return ref;
}

// Signature for the gather-odds section: table identity plus every
// entry's seen flag. Joins the render() button sig (like the XP unlock
// sig), so a first-time find refreshes the tooltip even when nothing
// else about the button changed.
function gatherTipSig(a) {
  if (!a || a.gather !== true || typeof findForageTable !== "function") return "";
  const table = findForageTable();
  const items = (table && Array.isArray(table.items)) ? table.items : [];
  const idx = (typeof FORAGE_TABLES !== "undefined") ? FORAGE_TABLES.indexOf(table) : -1;
  return idx + "|" + items.map(e => e.item + ((state.seen && state.seen[e.item]) ? 1 : 0)).join(",");
}

function refreshGatherSection(a, ref) {
  if (!a || !ref) return;
  const sig = gatherTipSig(a);
  if (ref.sig === sig) return;
  ref.sig = sig;
  const table = (typeof findForageTable === "function") ? findForageTable() : null;
  const items = (table && Array.isArray(table.items)) ? table.items : [];
  ref.body.textContent = "";
  if (!items.length) {
    const row = document.createElement("div");
    row.className = "tip-row";
    row.textContent = "Nothing to find on this tile.";
    ref.body.appendChild(row);
    return;
  }
  let total = 0;
  for (const e of items) total += e.weight;
  for (const e of items) {
    const def = (typeof getItem === "function") ? getItem(e.item) : null;
    const row = document.createElement("div");
    row.className = "tip-row";
    const nm = document.createElement("span");
    const found = !!(state.seen && state.seen[e.item]);
    nm.textContent = found ? (def ? def.name : e.item) : "???";
    if (def && typeof itemRarityClass === "function") nm.classList.add(itemRarityClass(def));
    const pct = document.createElement("span");
    pct.textContent = (total > 0 ? formatNum(e.weight / total * 100) : 0) + "%";
    row.appendChild(nm);
    row.appendChild(pct);
    ref.body.appendChild(row);
  }
}

// Live refresh for an action tip (Work button or World mirror): leveled
// Cap-based vital restoration as a share of max ("2% of Max"): the grant
// itself is defined as a percent, so an absolute number would lie as max
// grows. Falls back to the absolute payout when max is infinite or zero.
function pctOfMaxText(id, v) {
  const max = (typeof getEffectiveMax === "function") ? getEffectiveMax(id) : Infinity;
  if (!Number.isFinite(max) || max <= 0) return formatNum(v);
  return formatNum(v / max * 100) + "% of Max";
}

// header/footer/max line, effective Results/Cost rows, XP-row unlocks,
// auto-description. Every write is a no-op when unchanged, so calling it
// on every render is cheap.
function renderActionTipLive(a, ref) {
  if (!a || !ref) return;
  const count = state.stats.actions[a.id] ?? 0;
  if (ref.tc && ref.tc.textContent !== String(count)) ref.tc.textContent = count;
  // Effective cycle time (discounts land mid-session with no UI rebuild).
  if (ref.tipTime) {
    const timeText = actionTimeText(a);
    if (ref.tipTime.textContent !== timeText) ref.tipTime.textContent = timeText;
  }
  if (a.improvements) {
    const titleText = "[Lvl. " + actionLevel(a) + "] " + a.name;
    if (ref.title && ref.title.textContent !== titleText) ref.title.textContent = titleText;
    const footText = improvementFooter(a);
    if (ref.foot && ref.foot.textContent !== footText) ref.foot.textContent = footText;
    if (ref.impMax) {
      const cap = (typeof getEffectiveImpMax === "function") ? getEffectiveImpMax(a) : a.improvements.maxLevel;
      const maxText = "Max level: " + (cap === Infinity ? "none" : cap) + ".";
      if (ref.impMax.textContent !== maxText) ref.impMax.textContent = maxText;
    }
  }
  // Results rows always show the effective payout (base + improvement
  // levels + furniture/home boosts), so tooltips stay truthful for every
  // action - e.g. Rest shows 1.25 Stamina once Blankets are owned.
  // Cap-based vital restoration (Rest's Health, flagged pctOfMax at
  // build time) reads as a share of max ("2% of Max") instead.
  {
    const effCost = (typeof effectiveCosts === "function") ? effectiveCosts(a) : { ...(a.costs ?? {}) };
    const eff = effectiveGains(a);
    for (const g of ref.gains ?? []) {
      const v = eff[g.id] ?? 0;
      const t = g.pctOfMax ? pctOfMaxText(g.id, v) : formatNum(v);
      if (g.el.textContent !== t) g.el.textContent = t;
    }
    // Vital-restoration rows stay hidden until their vital unlocks
    // (unlocks fire mid-session with no UI rebuild, same as locked Skill
    // XP rows below). Unlocks never reverse, so rows only ever appear.
    if (a.heals && typeof resourceUnlocked === "function" && typeof getResource === "function") {
      for (const g of ref.gains ?? []) if (g.id in (a.heals ?? {})) {
        const r = getResource(g.id);
        const show = !!r && resourceUnlocked(r);
        if (g.row && g.row.hidden === show) g.row.hidden = !show;
      }
    }
    // Cost rows are live for the same reason: a fresh discount changes
    // the price without changing the sig, and the per-row check is cheap.
    // Zero-price rows hide (free, like a base cost that was dropped): an
    // override-only cost shows only on its tiles, and a zero override
    // reads as free instead of "Stamina: 0".
    let anyCostVisible = false;
    for (const c of ref.costs ?? []) {
      const cv = effCost[c.id] ?? 0;
      const hide = !(cv > 0);
      if (c.row && c.row.hidden !== hide) c.row.hidden = hide;
      if (hide) continue;
      anyCostVisible = true;
      const t = formatNum(effCost[c.id] ?? 0);
      if (c.el.textContent !== t) c.el.textContent = t;
    }
    if (ref.costSec) {
      const hideSec = !anyCostVisible;
      if (ref.costSec.hidden !== hideSec) ref.costSec.hidden = hideSec;
    }
    // Skill XP rows unhide live when their skill unlocks: unlocks fire
    // mid-session with no UI rebuild (e.g. Basic Knowledge M3 revealing
    // Odd Jobs Mastery on the Odd Jobs tooltip). Unlocks never reverse,
    // so unlocks only ever appear. Zero-grant rows hide too (an override
    // silencing XP reads as no row, not "+0"), and the section follows.
    if (ref.xpSec && typeof skillUnlocked === "function") {
      let anyVisible = false;
      const ex = (typeof effectiveXp === "function") ? effectiveXp(a) : (a.xp ?? {});
      for (const x of ref.xpRows ?? []) {
        const show = skillUnlocked(x.sid) && ((ex[x.sid] ?? 0) > 0);
        if (x.row.hidden === show) x.row.hidden = !show;
        if (show) {
          anyVisible = true;
          // XP rows show the effective grant (base + improvement levels),
          // so Research Scrolls reads 1.1 once improved.
          if (x.el) {
            const t = "+" + formatNum(ex[x.sid] ?? 0);
            if (x.el.textContent !== t) x.el.textContent = t;
          }
        }
      }
      if (ref.xpSec.hidden === anyVisible) ref.xpSec.hidden = !anyVisible;
    }
    // Auto-written descriptions embed the base costs, so refresh them
    // when discounts change the price. Custom descriptions stay as-is.
    if (ref.autoDesc) {
      const showCosts = Object.fromEntries(Object.entries(effCost).filter(([, n]) => n > 0));
      const t = autoActionDescription({ tickSeconds: a.tickSeconds, costs: showCosts, gains: effectiveGains(a) });
      if (ref.desc && ref.desc.textContent !== t) ref.desc.textContent = t;
    }
  }
  // Gather odds refresh with the same section (tile moves and first-time
  // finds both land here with no UI rebuild).
  if (ref.gatherSec) refreshGatherSection(a, ref.gatherSec);
  // Requirement section only shows while the tile requirement is unmet
  // (off-store): standing on a matching tile hides it again.
  if (ref.reqSec && typeof worldShopBlocked === "function") {
    const met = !worldShopBlocked(a);
    if (ref.reqSec.hidden !== met) ref.reqSec.hidden = met;
  }
  // Lock section only shows while the current tile's modifier bans this
  // action (on town for Forage): anywhere else it hides again.
  if (ref.lockSec && typeof worldActionLocked === "function") {
    const locked = worldActionLocked(a);
    if (ref.lockSec.hidden !== !locked) ref.lockSec.hidden = !locked;
  }
}
// Action tips prefer opening upward (never grows the page/scroll area), but
// flip downward when the actions column itself scrolls and there is no room
// above the button (otherwise the tip would be cut off). Long tips also cap
// to the winning side via fitTip, so they scroll internally instead of
// blowing out the menu.
function placeActionTip(btn) {
  const tip = btn.querySelector(".tip");
  // Room is measured against the anchor's own list, so the up/down
  // preference comes from the panel the button is actually in. (World
  // mirrors don't come here - openTip detaches them via placeWorldTip.)
  const ctn = (btn.closest && btn.closest("#worldActionsCtn")) || document.getElementById("actionsCtn");
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
// Highlights toggle (Options > Actions, on by default): hovering an
// action, upgrade, or furniture rings the involved resources red/green.
// Off paints no rings. Tooltip row tints always paint.
function highlightsOn() {
  try { return (typeof state === "undefined" || !state.options) ? true : state.options.showActionHighlights !== false; }
  catch (e) { return true; }
}
function hiResources(a, on) {
  if (!highlightsOn()) on = false;
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

// Upgrade builds mirror paid action cycles: a paid build resumes for free
// (and a running build continues on what it already paid), so its tip rows
// must not glow red for a price that won't be charged again.
function tipCostsForUpgrade(u) {
  if (!u || typeof state === "undefined") return (u && u.cost) || {};
  const b = state.builds ? state.builds[u.id] : null;
  if ((b && b.paid === true) || state.activeBuildId === u.id) return {};
  return u.cost ?? {};
}

let hoverTip = null; // { key, ref, costs } of the action/upgrade whose tip is open

// Currency-ring ownership: exactly one hover owns the spend/gain rings at
// a time. Rebuilds (buy/sell re-renders its card, buildUI wipes the panel)
// can remove the hovered anchor without a mouseleave, stranding rings that
// then stack with the next hover's. A fresh hover always starts clean, a
// delayed leave from a previous anchor never kills the new hover's rings,
// and rebuilds drop ownership outright.
let hiOwnerKey = null;
function clearAllHi() {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll(".spendHi,.gainHi")) el.classList.remove("spendHi", "gainHi");
}
function resetHi() {
  hiOwnerKey = null;
  clearAllHi();
}
// Newest hover wins (applies after clearing); a release only clears when
// it still owns the rings, so a delayed leave can't kill a newer hover.
function claimHi(key) {
  clearAllHi();
  hiOwnerKey = key;
}
function releaseHi(key) {
  if (hiOwnerKey === key) { hiOwnerKey = null; clearAllHi(); return true; }
  return hiOwnerKey === null;
}

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
  // World Action mirrors detach above the strip (full size, may overlap the
  // Tile panel); everything else fits inside its own list.
  if (key.startsWith("w:") && typeof placeWorldTip === "function") placeWorldTip(btn);
  else placeActionTip(btn);
  // Heal stranded rings (anchor removed mid-hover) before applying ours.
  claimHi(key);
  hi(true);
  const ref = uiRefs.get(key);
  hoverTip = ref ? { key, ref, costs } : null;
  // Paid-resume actions tint against a free ride (see tipCostsFor).
  if (ref) tintTip(ref, key.startsWith("a:") ? tipCostsFor(getAction(key.slice(2)), costs) : costs);
}

function closeTip(key, hi) {
  // Only the current owner clears: a delayed leave from a previous anchor
  // must not kill the new hover's rings. A leave with no owner (after a
  // rebuild reset) still clears its own key's rings, harmlessly.
  if (releaseHi(key)) hi(false);
  if (hoverTip && hoverTip.key === key) {
    // Detached world tips must drop their fixed pixels: a CSS-reshown tip
    // would otherwise sit at stale viewport coords with no placer running.
    if (key.startsWith("w:") && typeof clearWorldTip === "function" && hoverTip.ref && hoverTip.ref.root) {
      const tip = hoverTip.ref.root.querySelector(":scope > .tip");
      if (tip) clearWorldTip(tip);
    }
    hoverTip = null;
  }
}

// Hover reconciliation: CSS :hover works where JS mouse events don't. Both
// Chrome and Firefox retarget mouse events off disabled buttons, so hovering
// a broke (disabled) action or upgrade shows its tip via CSS with no rings,
// no placement, and no usable scrollbar - and a button that disables
// mid-hover never fires the mouseleave that would clear its rings. This
// runs off the real :hover state, so disabled anchors highlight exactly like
// enabled ones and missed leaves heal. Keyboard hovers are focus-driven
// (tabbing sets no :hover): an owned anchor that still holds focus keeps
// its rings, so tabbing through buttons never flickers them.
function hoverKeyForAnchor(el) {
  if (!el || typeof uiRefs === "undefined") return null;
  for (const [key, ref] of uiRefs) {
    if (ref && ref.root === el && (key.startsWith("a:") || key.startsWith("w:") || key.startsWith("u:"))) return key;
  }
  return null;
}
function anchorHiFor(key) {
  if (typeof getAction !== "function" || typeof getUpgrade !== "function") return null;
  if (key.startsWith("u:")) {
    const u = getUpgrade(key.slice(2));
    if (!u) return null;
    return { hi: (on) => hiResources({ costs: u.cost, gains: effectGains(u) }, on), costs: tipCostsForUpgrade(u) };
  }
  const a = getAction(key.slice(2));
  if (!a) return null;
  const eff = (typeof effectiveCosts === "function") ? effectiveCosts(a) : (a.costs ?? {});
  return { hi: (on) => hiResources(a, on), costs: tipCostsFor(a, eff) };
}
// `found` is the CSS-hovered action/upgrade anchor (or null). Factored out
// so probes can drive it directly (synthetic events never match :hover).
function reconcileHoverTip(found) {
  const key = hoverKeyForAnchor(found);
  if (key) {
    if (hoverTip && hoverTip.key === key) {
      // Rebuilds (buy/sell re-renders, buildUI wipes the panels, timed
      // builds completing) can replace the anchor mid-hover: the cursor is
      // already over the new node, so no fresh mouseenter fires and the tip
      // would sit at its natural spot forever - clipped to a nub inside the
      // narrow World Actions strip. Re-run the open path on the current node
      // when the owner is gone (or a different node), so placement + rings
      // heal instead of sticking broken.
      const ownerEl = hoverTip.ref && hoverTip.ref.root;
      if (ownerEl && ownerEl.isConnected && ownerEl === found) return;
    }
    const h = anchorHiFor(key);
    if (!h) return;
    const ref = uiRefs.get(key);
    openTip(key, (ref && ref.root) || found, h.hi, h.costs);
    return;
  }
  if (!hoverTip) return;
  if (!(hoverTip.key.startsWith("a:") || hoverTip.key.startsWith("w:") || hoverTip.key.startsWith("u:"))) return;
  const ownerEl = hoverTip.ref && hoverTip.ref.root;
  if (!ownerEl || !ownerEl.isConnected) return;
  // Still genuinely hovered or keyboard-focused: leave it alone.
  if (ownerEl.matches(":hover") || ownerEl.matches(":focus-visible") ||
      (document.activeElement && (ownerEl === document.activeElement || ownerEl.contains(document.activeElement)))) return;
  const h = anchorHiFor(hoverTip.key);
  closeTip(hoverTip.key, h ? h.hi : () => {});
}
let lastHoverPoll = 0;
function pollHoverTip() {
  const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
  if (now - lastHoverPoll < 150) return;
  lastHoverPoll = now;
  reconcileHoverTip(document.querySelector(".actionBtn:hover, .shopBtn:hover"));
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
