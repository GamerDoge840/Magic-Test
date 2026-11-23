// Labor Game actions: cycles, improvements, tooltips, buttons.
function doTick(action) {
  // One cycle's payout gains (with the improvement bonus), counts
  // the run, grants skill XP, and fires improvement level-ups.
  const eff = effectiveGains(action);
  for (const [id, n] of Object.entries(eff)) {
    const max = getEffectiveMax(id);
    const cur = state.amounts[id] ?? 0;
    // Meal overheal parks Stamina past its cap: a capped grant (e.g. Rest
    // while hurt) must never drain the buffer back to the cap.
    if (id === OVERHEAL_RESOURCE && cur > max) state.amounts[id] = Math.max(cur, Math.min(max, cur + n));
    else state.amounts[id] = max === Infinity ? cur + n : Math.min(max, cur + n);
    if (n > 0) {
      markCurrencySeen(id);
      // Inventory discovery: first-time items appear from here on.
      if (typeof getItem === "function" && getItem(id)) {
        if (!state.seen) state.seen = {};
        state.seen[id] = true;
      }
    }
  }
  for (const [sid, n] of Object.entries(effectiveXp(action))) gainSkillXp(sid, n);
  // Gathering actions (e.g. Forage) roll their loot table once per
  // completed cycle, on top of the static payout above.
  if (action.gather === true && typeof grantGatherLoot === "function") {
    const loot = grantGatherLoot(action) ?? [];
    if (typeof logGather === "function") logGather(loot, action);
  }
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
    // Tile requirement: gated actions (e.g. Buy Scrolls at a General
    // Store) only START on a matching tile. A paid cycle picked up
    // mid-bar resumes anywhere, exactly like affordability and builds.
    // HideWhenOffTile actions (Explores, Chop Trees) stay gated while
    // paid: half-finished progress can't run on the wrong tile (it is
    // kept and resumes on return).
    if ((!cyc.paid || action.hideWhenOffTile) && (typeof worldShopBlocked === "function") && worldShopBlocked(action)) {
      log(tileBlockedMessage(action, "perform"));
      render();
      return;
    }
    // Tile locks: a modifier (e.g. Hamlet) bans some actions on its
    // tile outright - walk elsewhere. Same paid-resume rule as above.
    if ((!cyc.paid || action.hideWhenOffTile) && (typeof worldActionLocked === "function") && worldActionLocked(action)) {
      log(worldLockMessage(action));
      render();
      return;
    }
    // Locked actions can't start at all (the Work tab hides them and the
    // World mirror now does too - this refusal is defense in depth for
    // any other path that reaches here).
    if (!cyc.paid && (typeof unlockMet === "function") && !unlockMet(action, "a")) {
      log("You haven't unlocked " + action.name + " yet.");
      render();
      return;
    }
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
    // No action runs while a trip is moving: starting one pauses the
    // journey first (progress kept) - resume it afterward from the Stop
    // button or by clicking the destination tile again. Acting beside a
    // paused trip is the normal mid-travel pause, so it stays. Placed
    // after every refusal above (locks, tile gates, affordability) so a
    // refused start never pauses the trip.
    if (state.world && state.world.travel && !state.world.travel.paused) {
      state.world.travel.paused = true;
    }
    state.currentActionId = id;
    lastTime = performance.now();
    log(pickActionLog(action, "startLog", "start") ?? "Started: " + action.name, "start");
    // Gather actions accumulate their finds as bullets on this startLog
    // line (see gatherStart); any other start disarms the previous host.
    if (typeof gatherStart === "function") gatherStart(action);
  } else {
    state.currentActionId = null;
    lastTime = performance.now();
    if (prev) log(pickLog(stopMsg, null) ?? pickActionLog(prev, "stopLog", "stop") ?? "Stopped.", stopCategory);
    else log("Stopped.", stopCategory);
  }
  render();
}

// Full-stop message: a stop caused by the "Stop if Full" currency check
// gets the action's stopFullLog when it has one (falling back to fullLog),
// while vitals-full stops always use fullLog. Caller passes the same gains
// map it used for outputsAreFull: vitals-full (gainsAreFull) takes the
// classic path, anything else that stopped must be the currency branch.
function fullStopMsg(action, eff) {
  if (!gainsAreFull(eff)) {
    const s = pickActionLog(action, "stopFullLog", "stopFull");
    if (s != null) return s;
  }
  return pickActionLog(action, "fullLog", "full") ?? (action.name + " finished: vitals full.");
}

// Stopping because the next cycle is unaffordable: show the action's
// fullLog text in orange when it has one, else the plain stop message.
// (Resolves the text first so a missing fullLog never paints stopLog orange.)
function stopForFunds(action) {
  const msg = pickActionLog(action, "fullLog", "full");
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

  // Shared tip body (same tree the World mirror builds, so both agree).
  const built = buildActionTipBody(a);
  btn.appendChild(built.tip);
  const { title, tc: count, tipTime, desc, autoDesc, costs: costRefs, gains: gainRefs, impMax: impMaxRow, foot, xpSec, xpRows, reqSec, lockSec } = built.refs;

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
  uiRefs.set("a:" + a.id, { root: btn, label, title, tipTime, foot, desc, autoDesc, costs: costRefs, costSec: built.refs.costSec, gains: gainRefs, fill, prog: progress, time, tc: count, impMax: impMaxRow, xpSec, xpRows, gatherSec: built.refs.gatherSec, reqSec, lockSec });

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
