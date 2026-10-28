// Labor Game actions: cycles, improvements, tooltips, buttons.
function doTick(action) {
  // One cycle's payout gains (with the improvement bonus), counts
  // the run, grants skill XP, and fires improvement level-ups.
  const eff = effectiveGains(action);
  for (const [id, n] of Object.entries(eff)) {
    const max = getEffectiveMax(id);
    const cur = state.amounts[id] ?? 0;
    state.amounts[id] = max === Infinity ? cur + n : Math.min(max, cur + n);
    if (n > 0) markCurrencySeen(id);
  }
  for (const [sid, n] of Object.entries(effectiveXp(action))) gainSkillXp(sid, n);
  const count = (state.stats.actions[action.id] ?? 0) + 1;
  state.stats.actions[action.id] = count;
  const imp = action.improvements;
  if (imp) {
    const lvl = actionLevel(action, count);
    if (lvl > actionLevel(action, count - 1)) {
      const bonus = describeCost(imp.bonus);
      log(pickLog(imp.improvementLog, action.name + " reached Improvement Level " + lvl + (bonus ? " (+" + bonus + " per cycle)." : ".")), "improvement");
    }
  }
}

function setAction(id, stopMsg, stopCategory = "stop") {  const prev = state.currentActionId ? getAction(state.currentActionId) : null;
  const action = id ? getAction(id) : null;
  if (action) {
    // Costs are per cycle, paid up front: starting a fresh (unpaid) cycle
    // charges, while resuming a paid cycle picked up mid-bar is free.
    // Progress is tracked per action, so stopping never loses it. Skill
    // milestones can discount the price (Scroll Frugality), so every
    // check and payment below reads through effectiveCosts.
    const cyc = state.cycles[id] ?? (state.cycles[id] = { progress: 0, paid: false });
    if (!cyc.paid) {
      const startCost = (typeof effectiveCosts === "function") ? effectiveCosts(action) : { ...(action.costs ?? {}) };
      if (!canAfford(startCost)) {
        log("Not enough for " + action.name + " (" + describeCost(startCost) + ").");
        render();
        return;
      }
      payCosts(startCost);
      cyc.paid = true;
    }
    // "Stop if Full" override: starting an action whose currency outputs
    // are full forces it to run anyway (orange border) until they drop
    // back under cap, which clears the override and re-arms auto-stop.
    if (!state.fullOverride) state.fullOverride = {};
    if (state.options.stopIfFull !== false && currencyGainsAreFull(effectiveGains(action))) state.fullOverride[action.id] = true;
    else delete state.fullOverride[action.id];
    state.currentActionId = id;
    lastTime = performance.now();
    log(pickLog(action.startLog, "Started: " + action.name), "start");
  } else {
    state.currentActionId = null;
    lastTime = performance.now();
    if (prev) log(pickLog(stopMsg, null) ?? pickLog(prev.stopLog, "Stopped."), stopCategory);
    else log("Stopped.", stopCategory);
  }
  render();
}

// Stopping because the next cycle is unaffordable: show the action's
// fullLog text in orange when it has one, else the plain stop message.
// (Resolves the text first so a missing fullLog never paints stopLog orange.)
function stopForFunds(action) {
  const msg = pickLog(action.fullLog, null);
  if (msg) setAction(null, msg, "full");
  else setAction(null, undefined);
}

function buildActionBtn(a) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "actionBtn";
  btn.id = "action-" + a.id;
  const label = document.createElement("span");
  label.className = "action-label";
  label.textContent = a.name;
  btn.appendChild(label);

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
  const desc = document.createElement("div");
  desc.className = "tip-desc";
  desc.textContent = a.description ?? autoActionDescription({ tickSeconds: a.tickSeconds ?? 1, costs: a.costs ?? {}, gains: a.gains ?? {} });
  tip.appendChild(desc);
  const costRefs = [];
  appendTipSection(tip, "Cost", a.costs ?? {}, costRefs);
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
  const gainRefs = [];
  appendTipSection(tip, "Results", gainBase, gainRefs);
  // Skill XP the action grants per cycle (e.g. Research Scrolls -> Basic
  // Knowledge). Listed right after Results so no payout goes unmentioned.
  // Rows for locked skills build hidden and unhide live in render().
  const xpBuilt = (typeof appendTipXpSection === "function") ? appendTipXpSection(tip, a.xp) : null;
  // The max-level line is live (skill milestones can raise the cap), so
  // keep its row: render() refreshes the text whenever the cap moves.
  let impMaxRow = null;
  if (a.improvements) {
    const impSec = document.createElement("div");
    impSec.className = "tip-sec";
    const impLab = document.createElement("div");
    impLab.className = "tip-sec-label";
    impLab.textContent = "Improvement";
    impSec.appendChild(impLab);
    const impMax = (typeof getEffectiveImpMax === "function") ? getEffectiveImpMax(a) : a.improvements.maxLevel;
    const impLines = ["Level up every " + a.improvements.every + " actions.", "Max level: " + (impMax === Infinity ? "none" : impMax) + "."];
    const impBonus = describeCost(a.improvements.bonus);
    if (impBonus) impLines.push("Bonus per level: +" + impBonus + ".");
    impLines.forEach((t, i) => {
      const row = document.createElement("div");
      row.className = "tip-row";
      row.textContent = t;
      impSec.appendChild(row);
      if (i === 1) impMaxRow = row;
    });
    tip.appendChild(impSec);
  }
  // Bottom line for improved actions: live progress to the next level.
  // Built before the flavor so the flavor always lands last: description,
  // Cost, Results, Skill XP, Improvement, "% to next", then flavor.
  let foot = null;
  if (a.improvements) {
    foot = document.createElement("div");
    foot.className = "tip-flavor";
    foot.textContent = improvementFooter(a);
    tip.appendChild(foot);
  }
  if (a.flavor) {
    const flavor = document.createElement("div");
    flavor.className = "tip-flavor";
    flavor.textContent = a.flavor;
    tip.appendChild(flavor);
  }
  btn.appendChild(tip);

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
  uiRefs.set("a:" + a.id, { root: btn, label, title, foot, desc, autoDesc: !!a._autoDesc, costs: costRefs, gains: gainRefs, fill, prog: progress, time, tc: count, impMax: impMaxRow, xpSec: xpBuilt ? xpBuilt.sec : null, xpRows: xpBuilt ? xpBuilt.rows : null });

  btn.addEventListener("click", () => {
    // Hiding mode: clicking strikes the action hidden instead of running it.
    if (hidingMode.actions) { toggleItemHidden("a:" + a.id); return; }
    if (state.currentActionId === a.id) setAction(null);
    else setAction(a.id);
  });
  const hi = (on) => hiResources(a, on);
  // Tints compare live amounts against the price, so hover passes the
  // discounted costs (not the base ones) for the unaffordable glow.
  const effForTip = () => (typeof effectiveCosts === "function") ? effectiveCosts(a) : (a.costs ?? {});
  btn.addEventListener("mouseenter", () => openTip("a:" + a.id, btn, hi, effForTip()));
  btn.addEventListener("mouseleave", () => closeTip("a:" + a.id, hi));
  btn.addEventListener("focus", () => openTip("a:" + a.id, btn, hi, effForTip()));
  btn.addEventListener("blur", () => closeTip("a:" + a.id, hi));
  return btn;
}

