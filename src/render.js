// Labor Game frame render: resources, actions, upgrades, status, open tooltip.
function render() {
  const current = state.currentActionId ? getAction(state.currentActionId) : null;
  for (const r of RESOURCES) {
    // Shared panels: same values written to every visible copy (Work +
    // Home + later tabs). Per-ref sig-skip keeps it cheap.
    const refs = getResourceRefs(r.id);
    if (!refs.length) continue;
    const val = state.amounts[r.id] ?? 0;
    // Discovery: holding a currency marks it seen (covers every present
    // and future gain path, even ones without an explicit mark call).
    // Vitals always show; currencies hide until seen.
    if (isCurrency(r) && val > 0 && !state.seen?.[r.id]) {
      if (!state.seen) state.seen = {};
      state.seen[r.id] = true;
    }
    const discovered = currencySeen(r);
    // Net gain per second from the running action (gains minus costs).
    // Always through effectiveGains AND the effective tick time: base
    // payout plus every boost (improvement levels, furniture, current-home
    // effects), divided by the boosted cycle time - so the tooltip rate
    // automatically accounts for any boost (e.g. Pillows speeding Rest).
    let rate = 0;
    if (current) rate = ((effectiveGains(current)[r.id] ?? 0) - (current.costs[r.id] ?? 0)) / getEffectiveTick(current);
    const max = getEffectiveMax(r.id);
    // User hiding (per panel kind): ignored while that panel's hiding mode
    // is on, so struck items show for unhiding. Discovery always applies,
    // even in hiding mode (like the maxed upgrade gate). All bits are in
    // the sig so mode flips and strike toggles always repaint.
    const hideRow = !discovered || (itemHidden("r:" + r.id) && !(isCurrency(r) ? hidingMode.currencies : hidingMode.vitals));
    const struck = itemHidden("r:" + r.id);
    const sig = val + "|" + rate + "|" + (max === Infinity ? "i" : max) + "|" + (hideRow ? 1 : 0) + "|" + (struck ? 1 : 0) + "|" + (discovered ? 1 : 0);
    for (const ref of refs) {
    if (ref._sig === sig) continue;
    ref._sig = sig;
    ref.root.hidden = hideRow;
    ref.root.classList.toggle("userHidden", struck);
    if (isCurrency(r)) {
      const capText = max === Infinity ? formatNum(val) : formatNum(val) + " / " + formatNum(max);
      ref.name.textContent = displayName(r, val);
      ref.val.textContent = capText;
      // Full stacks read at a glance: the numbers glow pale yellow at cap.
      ref.val.style.color = (max !== Infinity && val >= max) ? "#FFFE40" : "";
      if (ref.tipCount) ref.tipCount.textContent = capText;
      if (ref.tipRate) {
        ref.tipRate.textContent = rate ? formatNum(rate) + "/s" : "";
        ref.tipRate.hidden = !rate;
      }
    } else {
      ref.name.textContent = r.name;
      // Fully depleted vitals show their name in red.
      if (val <= 0) ref.name.style.color = "red";
      else if (r.nameColor) ref.name.style.color = r.nameColor;
      else ref.name.style.color = "";
      ref.val.textContent = formatNum(val) + " / " + formatNum(max);
      ref.fill.style.width = Math.max(0, Math.min(100, (val / max) * 100)) + "%";
      if (ref.tipCount) ref.tipCount.textContent = formatNum(val) + " / " + formatNum(max);
      if (ref.tipRate) {
        ref.tipRate.textContent = rate ? formatNum(rate) + "/s" : "";
        ref.tipRate.hidden = !rate;
      }
    }
    }
  }

  // Collapse resource groups emptied by hiding (all mirrors stay in sync).
  for (const h of document.querySelectorAll(".js-currencies, .js-vitals")) hideEmptyGroups(h);

  for (const a of ACTIONS) {
    const ref = uiRefs.get("a:" + a.id);
    if (!ref) continue;
    const btn = ref.root;
    // unlockMet must run every frame (it logs one-time unlocks), but the
    // DOM writes below are skipped while nothing changed.
    // User hiding is ignored in hiding mode so struck actions show.
    const hidden = !unlockMet(a, "a") || (!hidingMode.actions && itemHidden("a:" + a.id));
    const isActive = state.currentActionId === a.id;
    const count = state.stats.actions[a.id] ?? 0;
    // Skill milestones can discount the price (Scroll Frugality): every
    // affordability check, cap check, and label below reads the effective
    // costs so the whole frame agrees on the true price.
    const effCost = (typeof effectiveCosts === "function") ? effectiveCosts(a) : { ...(a.costs ?? {}) };
    const disabled = hidingMode.actions ? false : (isActive ? false : (!canAfford(effCost) || gainsAreFull(effectiveGains(a))));
    const cyc = state.cycles[a.id];
    const prog = cyc ? cyc.progress : 0;
    const tick = getEffectiveTick(a);
    const pkey = isActive ? prog.toFixed(3) : "";
    const overMax = costExceedsMax(effCost);
    // Skill milestones can raise the Improvement cap without any new
    // completions, so the cap joins the sig - otherwise the tooltip's
    // max-level line would wait for the next run to refresh.
    const impCap = a.improvements ? ((typeof getEffectiveImpMax === "function") ? getEffectiveImpMax(a) : a.improvements.maxLevel) : "";
    // Skill XP rows unhide when their skill unlocks without any new
    // completions, so the unlock state joins the sig too - otherwise the
    // rows would wait for the next run to appear.
    const xpSig = (typeof skillUnlocked === "function" && ref.xpRows) ? ref.xpRows.map(x => skillUnlocked(x.sid) ? "1" : "0").join(",") : "";
    // Skill milestones can discount the price without any new completions
    // (e.g. a discount attained purely by XP granted for another reason),
    // so the effective costs join the sig too - otherwise the tooltip's
    // Cost row would wait for the next run to refresh.
    const costSig = Object.keys(effCost).sort().map(id => id + ":" + effCost[id]).join(",");
    const sig = (hidden ? 1 : 0) + "|" + (disabled ? 1 : 0) + "|" + (isActive ? 1 : 0) + "|" + pkey + "|" + count + "|" + (overMax ? 1 : 0) + "|" + (itemHidden("a:" + a.id) ? 1 : 0) + "|" + impCap + "|" + xpSig + "|" + costSig;
    if (ref._sig === sig) continue;
    ref._sig = sig;
    btn.hidden = hidden;
    btn.classList.toggle("userHidden", itemHidden("a:" + a.id));
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    // Unusable when unaffordable, or when there is nothing left to gain (e.g. Rest at full Stamina).
    btn.disabled = disabled;
    if (ref.fill) ref.fill.style.width = isActive ? Math.min(100, (prog / tick) * 100) + "%" : "0%";
    if (ref.prog) ref.prog.hidden = !isActive;
    if (ref.time) ref.time.textContent = isActive ? formatDuration(tick - prog, (s) => s.toFixed(2) + "s") : "";
    if (ref.tc) ref.tc.textContent = count;
    if (ref.label) {
      ref.label.textContent = a.name + (overMax ? "*" : "");
      ref.label.style.color = overMax ? "red" : "";
    }
    // Improved actions: live level in the header and live progress-to-next
    // in the footer (count is in the sig, so any level change lands here;
    // writes are no-ops when unchanged). The max-level line is live too:
    // skill milestones can raise the cap mid-run.
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
    // Outside the sig gate on purpose: buying furniture changes the payout
    // without changing the sig, and the per-row check keeps it cheap.
    {
      const eff = effectiveGains(a);
      for (const g of ref.gains ?? []) {
        const t = formatNum(eff[g.id] ?? 0);
        if (g.el.textContent !== t) g.el.textContent = t;
      }
      // Cost rows are live for the same reason: a fresh discount changes
      // the price without changing the sig, and the per-row check is cheap.
      for (const c of ref.costs ?? []) {
        const t = formatNum(effCost[c.id] ?? 0);
        if (c.el.textContent !== t) c.el.textContent = t;
      }
      // Skill XP rows unhide live when their skill unlocks: unlocks fire
      // mid-session with no UI rebuild (e.g. Basic Knowledge M3 revealing
      // Odd Jobs Mastery on the Odd Jobs tooltip). Unlocks never reverse,
      // so rows only ever appear, and the section follows suit.
      if (ref.xpSec && typeof skillUnlocked === "function") {
        let anyVisible = false;
        for (const x of ref.xpRows ?? []) {
          const show = skillUnlocked(x.sid);
          if (x.row.hidden === show) x.row.hidden = !show;
          if (show) anyVisible = true;
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
  }

  for (const u of UPGRADES) {
    const ref = uiRefs.get("u:" + u.id);
    if (!ref) continue;
    const btn = ref.root;
    const owned = state.upgrades[u.id] ?? 0;
    const maxed = owned >= u.maxPurchases;
    // unlockMet must run every frame (it logs one-time unlocks), but the
    // DOM writes below are skipped while nothing changed. Hiding mode only
    // reveals user-hidden items; the maxed-out gate (and locks) still apply,
    // so the Show-maxed option is respected inside hiding mode too.
    const maxedGate = maxed && !state.options.showMaxedUpgrades;
    const hidden = !unlockMet(u, "u") || maxedGate || (!hidingMode.actions && itemHidden("u:" + u.id));
    const disabled = !hidingMode.actions && (maxed || !canAfford(u.cost));
    const overMax = costExceedsMax(u.cost);
    const sig = (hidden ? 1 : 0) + "|" + (disabled ? 1 : 0) + "|" + owned + "|" + (overMax ? 1 : 0) + "|" + (itemHidden("u:" + u.id) ? 1 : 0);
    if (ref._sig === sig) continue;
    ref._sig = sig;
    btn.hidden = hidden;
    btn.classList.toggle("userHidden", itemHidden("u:" + u.id));
    btn.classList.toggle("owned", owned > 0 && !maxed);
    btn.classList.toggle("maxed", maxed);
    btn.disabled = disabled;
    if (ref.tc) ref.tc.textContent = formatNum(owned) + "/" + formatNum(u.maxPurchases);
    if (ref.label) {
      ref.label.textContent = u.name + (overMax ? "*" : "");
      ref.label.style.color = overMax ? "red" : "";
    }
  }
  hideEmptyGroups(actionsCtn);
  checkMilestones();

  // Home tab: revealed once any home is owned. Counts, buttons, and the
  // sell overflow notice update live; the tab button hides while locked.
  const hasHome = ownsAnyHome();
  if (tabHomeBtn) tabHomeBtn.hidden = !hasHome;
  if (!hasHome && !tabHome.hidden) showTab("work");
  if (hasHome) {
    const cur = currentHomeDef();
    if (homeSelectBtn && cur && homeSelectBtn.textContent !== cur.name) homeSelectBtn.textContent = cur.name;
    const used = furnitureSpaceUsed();
    const max = homeSpaceMax();
    const spaceText = "Floor Space: " + used + " / " + max;
    if (floorSpaceEl && floorSpaceEl.textContent !== spaceText) floorSpaceEl.textContent = spaceText;
    if (homeFullNote) homeFullNote.hidden = used < max;
    for (const f of FURNITURE) {
      const ref = uiRefs.get("f:" + f.id);
      if (!ref || !ref.root.isConnected) continue;
      const owned = state.furniture[f.id] ?? 0;
      const cap = getEffectiveFurnCap(f);
      const maxed = owned >= cap;
      const noSpace = used + (f.space ?? 1) > max;
      const cantAfford = !canAfford(f.cost);
      const hidden = !furnVisible(f);
      const disBuy = maxed || cantAfford || noSpace;
      const disSell = owned <= 0;
      let overflow = "";
      if (owned > 0) {
        const over = [];
        for (const [rid, n] of Object.entries(f.cost ?? {})) {
          const after = maxAfterSell(f, rid);
          if (after !== Infinity) {
            const overAmt = (state.amounts[rid] ?? 0) + n - after;
            if (overAmt > 0) {
              const def = getResource(rid);
              over.push(formatNum(overAmt) + " " + (def ? (formatNum(overAmt) === "1" || !def.plural ? def.name : def.plural) : rid));
            }
          }
        }
        if (over.length) overflow = "Selling now would destroy " + over.join(", ") + " over the cap.";
      }
      const sig = (hidden ? 1 : 0) + "|" + owned + "|" + (cap === Infinity ? "i" : cap) + "|" + (disBuy ? 1 : 0) + "|" + (disSell ? 1 : 0) + "|" + overflow;
      if (ref._sig === sig) continue;
      ref._sig = sig;
      ref.root.hidden = hidden;
      ref.owned.textContent = owned + "/" + formatNum(cap);
      ref.buy.disabled = disBuy;
      ref.sell.disabled = disSell;
      if (ref.tipCount) ref.tipCount.textContent = owned + "/" + formatNum(cap);
      if (ref.sellNotice) {
        ref.sellNotice.textContent = overflow;
        ref.sellNotice.hidden = !overflow;
      }
    }
  }

  // Player stats: base values plus attained skill-milestone boosts (INT
  // rises with Basic Knowledge). Rendered through the same sig-skip
  // pattern so future effects just work.
  for (const s of PLAYER_STATS) {
    const ref = uiRefs.get("p:" + s.id);
    if (!ref) continue;
    const val = getEffectiveStat(s.id);
    const sig = String(val);
    if (ref._sig === sig) continue;
    ref._sig = sig;
    ref.val.textContent = formatNum(val);
    if (ref.tipCount) ref.tipCount.textContent = formatNum(val);
  }

  // Skills tab: unlocked once any skill reaches Level 1; the list and
  // milestones refresh live. Guarded so stripped-down copies without the
  // skills script still run.
  if (typeof tabSkillsBtn !== "undefined" && tabSkillsBtn) {
    tabSkillsBtn.hidden = !(typeof skillsUnlocked === "function" && skillsUnlocked());
  }
  if (typeof renderSkills === "function") renderSkills();

  if (!current) {
    const stamina = state.amounts.stamina;
    if (typeof stamina === "number" && stamina <= 0) {
      statusEl.textContent = "You feel exhausted...";
    } else {
      statusEl.textContent = "Idle";
    }
  } else {
    statusEl.textContent = current.runtext ?? (current.name + "...");
  }

  const nowCard = document.getElementById("nowCard");
  const nowCancelBtn = document.getElementById("nowCancelBtn");
  if (nowCard) nowCard.classList.toggle("busy", !!state.currentActionId);
  if (nowCancelBtn) nowCancelBtn.disabled = !state.currentActionId;
  // Keep the open tooltip's row tints truthful while amounts tick by.
  // Action tips recompute the discounted price (a milestone can land while
  // the tip is open); other tips reuse the costs captured on open.
  if (hoverTip && hoverTip.ref.root.isConnected) {
    let costs = hoverTip.costs;
    if (hoverTip.key.startsWith("a:") && typeof effectiveCosts === "function") {
      const act = getAction(hoverTip.key.slice(2));
      if (act) costs = effectiveCosts(act);
    }
    tintTip(hoverTip.ref, costs);
  }
  else hoverTip = null;
}

const nowCancelBtn = document.getElementById("nowCancelBtn");
if (nowCancelBtn) nowCancelBtn.addEventListener("click", () => setAction(null));
clearLogBtn.addEventListener("click", clearLog);
if (typeof clearLogBtnHome !== "undefined" && clearLogBtnHome) clearLogBtnHome.addEventListener("click", clearLog);
resetBtn.addEventListener("click", () => {
  if (!confirm("Hard Reset will erase all progress. Are you sure?")) return;
  state = makeFreshState();
  try { localStorage.removeItem(MANUAL_SAVE_KEY); } catch (e) { /* storage unavailable */ }
  buildUI();
  log("Hard reset: progress erased.");
  render();
});
exportBtn.addEventListener("click", exportSave);
importBtn.addEventListener("click", () => importInput.click());
exportClipBtn.addEventListener("click", exportSaveToClipboard);
importClipBtn.addEventListener("click", () => {
  if (clipMode === "import" && !clipBox.hidden) {
    clipBox.hidden = true;
    clipMode = null;
  } else {
    showClipBox("import", "");
  }
});
clipLoadBtn.addEventListener("click", loadClipArea);
tabWorkBtn.addEventListener("click", () => showTab("work"));
tabHomeBtn.addEventListener("click", () => showTab("home"));
tabPlayerBtn.addEventListener("click", () => showTab("player"));
tabSkillsBtn.addEventListener("click", () => showTab("skills"));
tabOptionsBtn.addEventListener("click", () => showTab("options"));
showMaxedChk.addEventListener("change", () => {
  state.options.showMaxedUpgrades = showMaxedChk.checked;
  render();
});
if (logLimitInput) logLimitInput.addEventListener("change", () => {
  state.options.logLimit = normalizeLogLimit(logLimitInput.value);
  logLimitInput.value = state.options.logLimit;
  trimLog();
});
