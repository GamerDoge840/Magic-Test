// Labor Game boot: state init, first render, game loop, manual-save autoload.
// Tick length lives in core.js (MAIN_TICK_MS) - one copy.
// Autosave timer: while enabled (Options > Saving) the browser save
// rewrites itself every 1/5/10 minutes (accumulated game time, so a
// hidden-tab gap fires once on return instead of queuing).
let autosaveAcc = 0;
setInterval(() => {
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (state.options.autosave) {
    autosaveAcc += dt;
    if (autosaveAcc >= normalizeAutosaveEvery(state.options.autosaveEvery) * 60) {
      autosaveAcc = 0;
      if (typeof autosaveGame === "function") autosaveGame();
    }
  } else autosaveAcc = 0;

  // Timed upgrade builds (see buildTime): one runs at a time, progress
  // and payment survive pauses - exactly like action cycles. Each
  // completion grants one purchase, then stops (even if repeatable).
  // Ticks independently of actions (no action need be running) - and
  // deliberately alongside them: a build and an action can progress
  // together, so Explore Outskirts finishes while you keep working.
  if (state.activeBuildId) {
    const bu = (typeof getUpgrade === "function") ? getUpgrade(state.activeBuildId) : null;
    const bb = (bu && state.builds) ? state.builds[bu.id] : null;
    if (!bu || !bu.buildTime || !bb) state.activeBuildId = null;
    else if ((state.upgrades[bu.id] ?? 0) >= getEffectiveUpgradeCap(bu)) state.activeBuildId = null;
    else {
      bb.progress += dt;
      if (bb.progress >= bu.buildTime) completeBuild(bu);
    }
  }

  // Travel runs on its own clock: starting an action pauses a moving
  // trip first (resume it after), so actions never run mid-travel.
  // Crafting and timed builds are not actions - they keep running
  // alongside travel untouched. At 0 Stamina the trip stalls until
  // Stamina returns.
  if (typeof worldTick === "function") worldTick(dt);

  // Crafting runs on its own clock too (no Stamina cost): loaded plans
  // keep working while actions run, you travel, or tabs sit idle.
  if (typeof craftTick === "function") craftTick(dt);

  const current = state.currentActionId ? getAction(state.currentActionId) : null;
  if (!current) { render(); return; }
  const eff = effectiveGains(current);

  // If outputs are already full (e.g. Rest at max Stamina, or Buy
  // Scrolls with full storage while "Stop if Full" is on), stop cleanly.
  if (outputsAreFull(eff, current.id)) {
    setAction(null, fullStopMsg(current, eff), "full");
    return;
  }

  // A running cycle is always paid for (charged at start, or for the next
  // cycle right at completion). This is just a safety net for odd states.
  // Skill milestones can discount the price, so this reads the effective
  // costs - same as the start/continue payments below.
  const effTickCost = (typeof effectiveCosts === "function") ? effectiveCosts(current) : { ...(current.costs ?? {}) };
  const cyc = state.cycles[current.id] ?? (state.cycles[current.id] = { progress: 0, paid: false });
  // Tile requirement: a gated action (e.g. Buy Scrolls) stops when an
  // unpaid cycle comes due off its tile - a paid cycle picked up mid-bar
  // still finishes. Progress is kept like an out-of-funds stop, so
  // walking back onto the tile resumes it.
  // Tile locks (e.g. Hamlet banning Forage) stop the same way, with
  // their own message.
  const tileStop = (typeof worldShopBlocked === "function") && worldShopBlocked(current);
  const lockStop = (typeof worldActionLocked === "function") && worldActionLocked(current);
  // HideWhenOffTile actions (Explores, Chop Trees) stop off-tile even
  // when paid - the payment and progress are kept, so walking back
  // resumes them for free.
  const hideGate = !!current.hideWhenOffTile && (tileStop || lockStop);
  if ((!cyc.paid && (tileStop || lockStop)) || hideGate) {
    if (!hideGate) cyc.paid = false;
    setAction(null, lockStop ? worldLockMessage(current) : tileBlockedMessage(current, "perform"));
    return;
  }
  if (!cyc.paid) {
    if (!canAfford(effTickCost)) {
      stopForFunds(current);
      return;
    }
    payCosts(effTickCost);
    cyc.paid = true;
  }

  cyc.progress += dt;
  let guarded = 0;
  const tick = getEffectiveTick(current);
  while (cyc.progress >= tick && guarded < MAX_CYCLES_PER_TICK) {
    guarded++;
    cyc.progress -= tick;
    doTick(current);
    const effNow = effectiveGains(current);
    if (outputsAreFull(effNow, current.id)) {
      cyc.progress = 0;
      cyc.paid = false;
      setAction(null, fullStopMsg(current, effNow), "full");
      return;
    }
    // The next cycle starts now: charge up front so stopping later never
    // loses paid time. A gated action stops instead when the next cycle
    // comes due off its tile (progress kept, resumes on return).
    // A locked action (tile modifier ban) stops here too.
    const tileStopNow = (typeof worldShopBlocked === "function") && worldShopBlocked(current);
    const lockStopNow = (typeof worldActionLocked === "function") && worldActionLocked(current);
    // HideWhenOffTile actions stay gated while paid (see above) - the
    // payment is kept so the player resumes for free on return.
    const hideGateNow = !!current.hideWhenOffTile && (tileStopNow || lockStopNow);
    if (tileStopNow || lockStopNow) {
      if (!hideGateNow) cyc.paid = false;
      setAction(null, lockStopNow ? worldLockMessage(current) : tileBlockedMessage(current, "perform"));
      return;
    }
    if (!canAfford(effTickCost)) {
      cyc.paid = false;
      stopForFunds(current);
      return;
    }
    payCosts(effTickCost);
  }
  render();
  // Per-tick refresh keeps the action-bar countdowns smooth. Action speed is
  // unaffected: progress accumulates from real elapsed time (dt above).
}, MAIN_TICK_MS);

buildUI();
render();
// A browser Manual Save autoloads here (the Save/Load buttons live in
// Options). Fresh players get the intro line instead.
loadManualSave().then((loaded) => {
  if (loaded === true) {
    buildUI();
    render();
    log("Save loaded.");
  } else {
    logIntro();
    if (loaded === "corrupt") log("Saved game was corrupt and could not be loaded.");
  }
});
for (const w of configWarnings) {
  console.warn("[config] " + w);
  try { log(w); } catch (e) { /* log panel not ready */ }
}
