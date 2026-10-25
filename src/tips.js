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

// Action tips prefer opening upward (never grows the page/scroll area), but
// flip downward when the actions column itself scrolls and there is no room
// above the button (otherwise the tip would be cut off).
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
  if (roomUp >= h + 8 || roomUp >= roomDown) {
    tip.style.top = "auto";
    tip.style.bottom = "110%";
  } else {
    tip.style.top = "110%";
    tip.style.bottom = "auto";
  }
}

function describeEffect(e) {
  if (e.type === "max") {
    const def = getResource(e.resource);
    return "+" + formatNum(e.amount) + " " + (def ? def.name : e.resource) + " max";
  }
  if (e.type === "gain") {
    const def = getResource(e.resource);
    const act = e.action ? getAction(e.action) : null;
    return "+" + formatNum(e.amount) + " " + (def ? def.name : e.resource) + " to " + (act ? act.name : e.action);
  }
  if (e.type === "home") {
    const h = e.home ? getHome(e.home) : null;
    return "Home: " + (h ? h.name : e.home);
  }
  if (e.type === "furnitureCap") {
    const f = e.furniture ? getFurniture(e.furniture) : null;
    return "+" + formatNum(e.amount) + " " + (f ? f.name : e.furniture) + " purchase cap";
  }
  if (e.type === "time") {
    const act = e.action ? getAction(e.action) : null;
    return "-" + formatNum(e.amount) + "s " + (act ? act.name : e.action) + " time";
  }
  return e.type + (e.resource ? " " + e.resource : "");
}

function autoActionDescription(a) {
  const tick = formatDuration(a.tickSeconds, (s) => formatNum(s) + "s");
  const hasCosts = a.costs && Object.keys(a.costs).length > 0;
  const hasGains = a.gains && Object.keys(a.gains).length > 0;
  if (hasCosts && hasGains) return "Spend " + describeCost(a.costs) + " \u2192 +" + describeCost(a.gains) + " (" + tick + ").";
  if (hasGains) return "+" + describeCost(a.gains) + " (" + tick + ").";
  if (hasCosts) return "Spend " + describeCost(a.costs) + " (" + tick + ").";
  return "Takes " + tick + ".";
}

function autoUpgradeDescription(u) {
  const hasCost = u.cost && Object.keys(u.cost).length > 0;
  const hasFx = u.effects && u.effects.length > 0;
  if (hasCost && hasFx) return describeCost(u.cost) + " \u2192 " + u.effects.map(describeEffect).join(", ") + ".";
  if (hasFx) return u.effects.map(describeEffect).join(", ") + ".";
  if (hasCost) return "Costs " + describeCost(u.cost) + ".";
  return "No effect.";
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

let hoverTip = null; // { key, ref, costs } of the action/upgrade whose tip is open

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
  if (ref) tintTip(ref, costs);
}

function closeTip(key, hi) {
  hi(false);
  if (hoverTip && hoverTip.key === key) hoverTip = null;
}

