// Labor Game frame render: resources, actions, upgrades, status, open tooltip.
function render() {
  const current = state.currentActionId ? getAction(state.currentActionId) : null;
  // Per-tick invariants, hoisted out of the loops below: every resource
  // row and action button reads the same running-action payout and speed.
  const currentEff = current ? effectiveGains(current) : null;
  const currentTick = current ? getEffectiveTick(current) : 1;
  for (const r of RESOURCES) {
    // Shared panels: same values written to every visible copy (Work +
    // Home + later tabs). Per-ref sig-skip keeps it cheap.
    const refs = getResourceRefs(r.id);
    if (!refs.length) continue;
    const val = state.amounts[r.id] ?? 0;
    // Discovery: holding a currency marks it seen (covers every present
    // and future gain path, even ones without an explicit mark call).
    // Vitals always show unless gated by `unlock`; currencies hide
    // until seen.
    if (isCurrency(r) && val > 0 && !state.seen?.[r.id]) {
      if (!state.seen) state.seen = {};
      state.seen[r.id] = true;
    }
    const discovered = currencySeen(r) && resourceUnlocked(r);
    // Net gain per second from the running action (gains minus costs).
    // Always through effectiveGains AND the effective tick time: base
    // payout plus every boost (improvement levels, furniture, current-home
    // effects), divided by the boosted cycle time - so the tooltip rate
    // automatically accounts for any boost (e.g. Pillows speeding Rest).
    let rate = 0;
    if (current) rate = ((currentEff[r.id] ?? 0) - (current.costs[r.id] ?? 0)) / currentTick;
    const max = getEffectiveMax(r.id);
    // User hiding (per panel kind): ignored while that panel's hiding mode
    // is on, so struck items show for unhiding. Discovery always applies,
    // even in hiding mode (like the maxed upgrade gate). All bits are in
    // the sig so mode flips and strike toggles always repaint.
    const hideRow = !discovered || (itemHidden("r:" + r.id) && !(isCurrency(r) ? hidingMode.currencies : hidingMode.vitals));
    const struck = itemHidden("r:" + r.id);
    // Meal overheal: Stamina past its cap grades the bar into pale green.
    const overhealed = !isCurrency(r) && r.id === OVERHEAL_RESOURCE && max !== Infinity && val > max + 1e-9;
    const sig = val + "|" + rate + "|" + (max === Infinity ? "i" : max) + "|" + (hideRow ? 1 : 0) + "|" + (struck ? 1 : 0) + "|" + (discovered ? 1 : 0) + "|" + (overhealed ? 1 : 0);
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
      ref.val.style.color = (max !== Infinity && val >= max) ? CAP_GLOW_COLOR : "";
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
      // Overhealed Stamina glows: the fill grades from its usual color
      // into pale green (#CBFFA3) until the buffer is spent.
      ref.fill.style.background = overhealed ? ("linear-gradient(to right, " + (r.barColor || DEFAULT_BAR_COLOR) + ", " + OVERHEAL_GRADIENT_END + ")") : (r.barColor || "");
      if (ref.tipCount) ref.tipCount.textContent = formatNum(val) + " / " + formatNum(max);
      if (ref.tipRate) {
        ref.tipRate.textContent = rate ? formatNum(rate) + "/s" : "";
        ref.tipRate.hidden = !rate;
      }
    }
    }
  }

  // Collapse resource/skill groups emptied by hiding (all mirrors stay in sync).
  for (const h of resPanelHosts()) hideEmptyGroups(h);
  if (typeof skillsCtn !== "undefined" && skillsCtn) hideEmptyGroups(skillsCtn);

  for (const a of ACTIONS) {
    const ref = uiRefs.get("a:" + a.id);
    if (!ref) continue;
    const btn = ref.root;
    // unlockMet must run every frame (it logs one-time unlocks), but the
    // DOM writes below are skipped while nothing changed.
    // User hiding is ignored in hiding mode so struck actions show.
    const isActive = state.currentActionId === a.id;
    // Tile gates, computed once per action per tick: the Work hide rules
    // below and the start/stop rules share them instead of re-querying.
    const shopBlock = (typeof worldShopBlocked === "function") ? worldShopBlocked(a) : false;
    const lockBlock = (typeof worldActionLocked === "function") ? worldActionLocked(a) : false;
    const tileBlocked = shopBlock || lockBlock;
    // Tile-modifier locks (e.g. Hamlet banning Forage) hide the
    // action outright instead of a red star. A running action stays
    // visible until the next tick stops it. A stopped-but-paid action stays
    // visible too, so its paid cycle can resume anywhere (the same rule
    // tileStopped uses below) instead of stranding progress behind a
    // hidden button until the player walks back.
    const cyc = state.cycles[a.id];
    const paidResume = !isActive && !!cyc && cyc.paid === true;
    // Paid progress normally stays visible/resumable anywhere - except
    // hideWhenOffTile actions (Explores, Chop Trees), whose tile gates
    // hold even when paid (progress + payment are kept, just unusable
    // until the player walks back).
    const tilePaidOk = paidResume && !a.hideWhenOffTile;
    const lockHide = lockBlock && !isActive && !tilePaidOk;
    // hideWhenOffTile (e.g. Explore Plains): an unmet tile requirement
    // hides the action outright instead of a red star, exactly like a
    // lock. A running action stays visible until the next tick stops
    // it. Before the World unlocks every requirement counts as met, so
    // the action still shows in town.
    const offTileHide = !!a.hideWhenOffTile && !isActive && !tilePaidOk && shopBlock;
    const hidden = !unlockMet(a, "a") || (!hidingMode.actions && itemHidden("a:" + a.id)) || lockHide || offTileHide;
    const count = state.stats.actions[a.id] ?? 0;
    // Skill milestones can discount the price (Scroll Frugality): every
    // affordability check, cap check, and label below reads the effective
    // costs so the whole frame agrees on the true price.
    const effCost = (typeof effectiveCosts === "function") ? effectiveCosts(a) : { ...(a.costs ?? {}) };
    // One payout read per action per tick: vitals-full, currency-full, and
    // the override lapse below all share it.
    const effGains = effectiveGains(a);
    // Currency-full never disables (only affordability does, besides
    // hiding mode): with "Stop if Full" on, a full action stays clickable
    // and shows the orange border so it can be force-started past the
    // cap. Vitals-full keeps the plain disabled look (nothing to gain).
    const vitalsFull = gainsAreFull(effGains);
    const optFull = state.options.stopIfFull !== false;
    const curFull = optFull && currencyGainsAreFull(effGains);
    // The override lapses the moment outputs drop back under cap: the
    // border goes away and auto-stop re-arms for the next fill-up.
    if (state.fullOverride && state.fullOverride[a.id] && !currencyGainsAreFull(effGains)) delete state.fullOverride[a.id];
    const ovr = !!(state.fullOverride && state.fullOverride[a.id]);
    // Tile requirement: gated actions (e.g. Buy Scrolls) only start on
    // a matching tile. A paid cycle picked up mid-bar resumes anywhere,
    // exactly like upgrades and timed builds - except hideWhenOffTile
    // actions, which stay gated while paid (see tilePaidOk above).
    // Tile-modifier locks (e.g. Hamlet banning Forage) block the
    // same way.
    const tileStopped = tileBlocked && !tilePaidOk;
    const disabled = hidingMode.actions ? false : (isActive ? false : ((!canAfford(effCost) && !paidResume) || vitalsFull || tileStopped));
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
    // Gather odds reveal on first-time finds without any new completions,
    // so the table + seen state joins the sig too (like the XP unlock sig).
    const gatherSig = (typeof gatherTipSig === "function") ? gatherTipSig(a) : "";
    const sig = (hidden ? 1 : 0) + "|" + (disabled ? 1 : 0) + "|" + (isActive ? 1 : 0) + "|" + pkey + "|" + count + "|" + (overMax ? 1 : 0) + "|" + (itemHidden("a:" + a.id) ? 1 : 0) + "|" + impCap + "|" + xpSig + "|" + costSig + "|" + (curFull ? 1 : 0) + "|" + (ovr ? 1 : 0) + "|" + (tileBlocked ? 1 : 0) + "|" + gatherSig + "|" + tick.toFixed(3);
    if (ref._sig === sig) continue;
    ref._sig = sig;
    btn.hidden = hidden;
    btn.classList.toggle("userHidden", itemHidden("a:" + a.id));
    btn.classList.toggle("active", isActive);
    // Orange while Stop-if-Full holds this action at its cap (stopped or
    // force-running past it). Vitals-full keeps the plain disabled look.
    btn.classList.toggle("fullstop", curFull && !vitalsFull);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    // Unusable when unaffordable, or when vitals are full (e.g. Rest at
    // full Stamina). Currency-full stays clickable so it can be
    // force-started past the cap (orange border).
    btn.disabled = disabled;
    // Very fast cycles (4+ fills/sec) would only jitter a discrete fill,
    // so show a full-width flowing striped bar instead (see .flowing).
    const flowing = isActive && tick <= FAST_BAR_TICK_SECONDS;
    if (ref.prog) ref.prog.classList.toggle("flowing", flowing);
    if (ref.fill) ref.fill.style.width = !isActive ? "0%" : (flowing ? "100%" : Math.min(100, (prog / tick) * 100) + "%");
    if (ref.prog) ref.prog.hidden = !isActive;
    if (ref.time) ref.time.textContent = isActive ? formatDuration(tick - prog, (s) => s.toFixed(2) + "s") : "";
    if (ref.tc) ref.tc.textContent = count;
    if (ref.label) {
      // Red "Name*" while the price exceeds a cap OR the tile requirement
      // is unmet (off-tile). The asterisk uses the unmet requirement
      // itself, not the stopped state, so a paid cycle picked up mid-bar
      // still shows it while staying clickable for its free resume.
      const reqStar = overMax || tileBlocked;
      ref.label.textContent = a.name + (reqStar ? "*" : "");
      ref.label.style.color = reqStar ? "red" : "";
    }
    // Live tooltip numbers (level header/footer, payouts, discounts, XP
    // unlocks, requirement visibility): shared with the World mirror, so
    // both copies refresh from one place.
    if (typeof renderActionTipLive === "function") renderActionTipLive(a, ref);
  }

  for (const u of UPGRADES) {
    const ref = uiRefs.get("u:" + u.id);
    if (!ref) continue;
    const btn = ref.root;
    const owned = state.upgrades[u.id] ?? 0;
    // Skill milestones can raise the purchase cap (e.g. Pouch Organizing
    // for Pockets), so the cap joins the sig - otherwise the
    // maxed gate and count would wait for the next purchase to refresh.
    const capNow = (typeof getEffectiveUpgradeCap === "function") ? getEffectiveUpgradeCap(u) : (u.maxPurchases ?? 1);
    const maxed = owned >= capNow;
    // unlockMet must run every frame (it logs one-time unlocks), but the
    // DOM writes below are skipped while nothing changed. Hiding mode only
    // reveals user-hidden items; the maxed-out gate (and locks) still apply,
    // so the Show-maxed option is respected inside hiding mode too.
    const maxedGate = maxed && !state.options.showMaxedUpgrades;
    const hidden = !unlockMet(u, "u") || maxedGate || (!hidingMode.actions && itemHidden("u:" + u.id));
    // Timed builds mirror action resume rules: a paused paid build stays
    // clickable when broke (resuming is free); only a fresh unpaid start
    // needs affording. A running build stays clickable so it can pause.
    const b = (state.builds && state.builds[u.id]) || null;
    const building = state.activeBuildId === u.id;
    const paidBuild = !building && !!b && b.paid === true;
    const bprog = b ? b.progress : 0;
    // Tile requirement: gated upgrades only buy on a matching tile (free
    // while the World is still locked). A paid build resumes anywhere,
    // exactly like affordability.
    const shopBlock = (typeof worldShopBlocked === "function") ? worldShopBlocked(u) : false;
    const shopStopped = shopBlock && !building && !paidBuild;
    const disabled = !hidingMode.actions && (maxed || (building ? false : (!canAfford(u.cost) && !paidBuild)) || shopStopped);
    const overMax = costExceedsMax(u.cost);
    const sig = (hidden ? 1 : 0) + "|" + (disabled ? 1 : 0) + "|" + owned + "|" + (overMax ? 1 : 0) + "|" + (itemHidden("u:" + u.id) ? 1 : 0) + "|" + (capNow === Infinity ? "i" : capNow) + "|" + (building ? bprog.toFixed(1) : (paidBuild ? "p" : "-")) + "|" + (shopStopped ? 1 : 0) + "|" + (shopBlock ? 1 : 0);
    if (ref._sig === sig) continue;
    ref._sig = sig;
    btn.hidden = hidden;
    btn.classList.toggle("userHidden", itemHidden("u:" + u.id));
    // Requirement section only shows while the tile requirement is unmet.
    if (ref.reqSec) ref.reqSec.hidden = !shopBlock;
    // Green means fully bought (complete), matching attained-milestone
    // green - not mere partial ownership. A cap rising under existing
    // ownership (e.g. Pockets 1/1 -> 1/4) must not paint a green "owned"
    // border when nothing new was bought.
    btn.classList.toggle("owned", owned > 0 && maxed);
    btn.classList.toggle("maxed", maxed);
    btn.classList.toggle("building", building);
    btn.disabled = disabled;
    const buildingFast = building && u.buildTime <= FAST_BAR_TICK_SECONDS;
    if (u.buildTime && ref.prog) ref.prog.classList.toggle("flowing", buildingFast);
    if (u.buildTime && ref.fill) ref.fill.style.width = !building ? "0%" : (buildingFast ? "100%" : Math.min(100, (bprog / u.buildTime) * 100) + "%");
    if (u.buildTime && ref.prog) ref.prog.hidden = !building;
    if (u.buildTime && ref.time) ref.time.textContent = building ? formatDuration(u.buildTime - bprog, (s) => s.toFixed(1) + "s") : "";
    if (ref.tc) ref.tc.textContent = formatNum(owned) + "/" + (capNow === Infinity ? "no limit" : formatNum(capNow));
    if (ref.label) {
      // Same red "Name*" as actions: over-cap price or unmet tile
      // requirement (off-store). Paid builds resuming free stay clickable.
      const reqStar = overMax || shopBlock;
      ref.label.textContent = u.name + (reqStar ? "*" : "");
      ref.label.style.color = reqStar ? "red" : "";
    }
  }
  hideEmptyGroups(actionsCtn);
  checkSpecialMessages();

  // Home tab: revealed once any home is owned. Counts, buttons, and the
  // sell overflow notice update live; the tab button hides while locked.
  const hasHome = ownsAnyHome();
  if (tabHomeBtn) tabHomeBtn.hidden = !hasHome;
  if (!hasHome && !tabHome.hidden) showTab("work");
  if (hasHome) {
    if (typeof syncHomeSelectTip === "function") syncHomeSelectTip();
    const used = furnitureSpaceUsed();
    const max = homeSpaceMax();
    const spaceText = used + " / " + max;
    if (floorSpaceEl && floorSpaceEl.textContent !== spaceText) {
      floorSpaceEl.textContent = spaceText;
      if (floorSpaceFill) {
        const t = max > 0 ? Math.min(1, used / max) : 0;
        floorSpaceFill.style.width = (t * 100) + "%";
        // Capacity color: light-green when empty, fading into amber as the
        // house fills (lightgreen #90EE90 -> amber #E0A458).
        floorSpaceFill.style.background = "rgb(" + Math.round(144 + (224 - 144) * t) + "," + Math.round(238 + (164 - 238) * t) + "," + Math.round(144 + (88 - 144) * t) + ")";
      }
    }
    if (homeFullNote) homeFullNote.hidden = used < max;
    // Furniture search (String-coerced like inventory search: a non-string
    // value would otherwise throw on .trim() and freeze the tick loop).
    // AND-combined with every furnVisible gate below. The field is static
    // markup, so sync without clobbering in-progress typing.
    const furnQuery = String((state.options && state.options.furnSearch) || "").trim().toLowerCase();
    const furnQuerySing = furnQuery && typeof invWordSingulars === "function" ? invWordSingulars(furnQuery) : null;
    if (typeof furnSearchInput !== "undefined" && furnSearchInput && document.activeElement !== furnSearchInput && furnSearchInput.value !== (state.options.furnSearch ?? "")) furnSearchInput.value = state.options.furnSearch ?? "";
    for (const f of FURNITURE) {
      // One-time unlock message (see unlockLog in the config): fires the
      // first frame the entry is visible, then never again - the flag is
      // saved with the other unlocks, so imports that already qualify
      // log it once on load like actions/upgrades do.
      if (f.unlockLog && unlockFurniture(f) && !state.unlocked["f:" + f.id]) {
        state.unlocked["f:" + f.id] = true;
        log(f.unlockLog, "unlock");
      }
      const ref = uiRefs.get("f:" + f.id);
      if (!ref || !ref.root.isConnected) continue;
      const owned = state.furniture[f.id] ?? 0;
      const cap = getEffectiveFurnCap(f);
      const maxed = owned >= cap;
      const noSpace = used + (f.space ?? 1) > max;
      const cantAfford = !canAfford(f.cost);
      // User hiding (like actions/upgrades): ignored while furniture-hiding mode
      // is on, so struck cards show for unhiding. Gates still apply in hiding mode.
      const fHidden = itemHidden("f:" + f.id);
      const hidden = !furnVisible(f) || !furnSearchMatch(f, furnQuery, furnQuerySing) || (!hidingMode.furniture && fHidden);
      // Tile requirement mirrors upgrades: gated furniture only buys on a
      // matching tile (free while the World is still locked).
      const shopBlock = (typeof worldShopBlocked === "function") ? worldShopBlocked(f) : false;
      const disBuy = hidingMode.furniture ? false : (maxed || cantAfford || noSpace || shopBlock);
      const disSell = hidingMode.furniture ? false : owned <= 0;
      // Same red "Name*" as actions/upgrades: a price above its cap can
      // never be saved up for, the tile requirement is unmet, or the
      // house's Floor Space is full (nothing more fits until room frees).
      const overMax = (typeof costExceedsMax === "function") ? costExceedsMax(f.cost ?? {}) : false;
      const spaceFull = used >= max;
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
        if (over.length === 1) overflow = "Selling now would destroy " + over[0] + " over the cap.";
        else if (over.length === 2) overflow = "Selling now would destroy " + over[0] + " and " + over[1] + " over the cap.";
        else if (over.length) overflow = "Selling now would destroy " + over.slice(0, -1).join(", ") + ", and " + over[over.length - 1] + " over the cap.";
      }
      const sig = (hidden ? 1 : 0) + "|" + owned + "|" + (cap === Infinity ? "i" : cap) + "|" + (disBuy ? 1 : 0) + "|" + (disSell ? 1 : 0) + "|" + overflow + "|" + (shopBlock ? 1 : 0) + "|" + (overMax ? 1 : 0) + "|" + (spaceFull ? 1 : 0) + "|" + (fHidden ? 1 : 0) + "|" + (hidingMode.furniture ? 1 : 0);
      if (ref._sig === sig) continue;
      ref._sig = sig;
      ref.root.hidden = hidden;
      ref.root.classList.toggle("userHidden", fHidden);
      if (ref.name) {
        const reqStar = overMax || shopBlock || spaceFull;
        const want = f.name + (reqStar ? "*" : "");
        if (ref.name.textContent !== want) ref.name.textContent = want;
        if ((ref.name.style.color || "") !== (reqStar ? "red" : "")) ref.name.style.color = reqStar ? "red" : "";
      }
      ref.owned.textContent = owned + "/" + formatNum(cap);
      ref.buy.disabled = disBuy;
      ref.sell.disabled = disSell;
      // Requirement section only shows while the tile requirement is unmet.
      if (ref.reqSec) ref.reqSec.hidden = !shopBlock;
      if (ref.tipCount) ref.tipCount.textContent = owned + "/" + formatNum(cap);
      if (ref.sellNotice) {
        ref.sellNotice.textContent = overflow;
        ref.sellNotice.hidden = !overflow;
      }
    }
    // Search empty-state: shown only while a query hides every card.
    const furnNoMatch = document.getElementById("furnNoMatch");
    if (furnNoMatch && furnNoMatch.isConnected) {
      let anyShown = false;
      for (const f of FURNITURE) {
        const r = uiRefs.get("f:" + f.id);
        if (r && r.root.isConnected && !r.root.hidden) { anyShown = true; break; }
      }
      furnNoMatch.hidden = anyShown || !furnQuery;
    }
  }

  // Player title: sticky unlock catch-up, then the name-row suffix
  // ("Jimmy, Civilian"; bare name on None). Both change-guarded so the
  // DOM only touches when something actually flips.
  if (typeof unlockTitles === "function") unlockTitles();
  if (typeof playerTitleBtn !== "undefined" && playerTitleBtn) {
    const selTitle = (typeof selectedTitleDef === "function") ? selectedTitleDef() : null;
    const titleTxt = selTitle ? ", " + selTitle.name : "";
    if (playerTitleBtn.textContent !== titleTxt) playerTitleBtn.textContent = titleTxt;
  }
  // Player stats: base values plus attained skill-milestone boosts (INT
  // rises with Basic Knowledge). Crafting-tagged stats (Cooking Speed,
  // Woodworking Speed) hide with their section header until their own
  // crafting group opens (see craftStatOpen) - a Woodworking Speed with
  // no Woodworking plans stays hidden while Cooking shows. Rendered
  // through the same sig-skip pattern so future effects just work.
  const craftOpen = (typeof cookingUnlocked === "function") ? cookingUnlocked() : true;
  if (typeof craftStatsHead !== "undefined" && craftStatsHead && craftStatsHead.hidden !== !craftOpen) craftStatsHead.hidden = !craftOpen;
  for (const s of PLAYER_STATS) {
    const ref = uiRefs.get("p:" + s.id);
    if (!ref) continue;
    const val = getEffectiveStat(s.id);
    const hidden = getTags(s).includes(CRAFTING_TAG) && !(typeof craftStatOpen === "function" ? craftStatOpen(s.id) : craftOpen);
    const sig = String(val) + "|" + (hidden ? 1 : 0);
    if (ref._sig === sig) continue;
    ref._sig = sig;
    ref.root.hidden = hidden;
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
  // World tab: visibility gating lives in renderWorld (locked until
  // Explore Outskirts is performed), plus the map/travel repaint.
  if (typeof renderWorld === "function") renderWorld();
  // Inventory tab: unlocked alongside the World tab; the item grid
  // repaints live from amounts/seen through renderInventory.
  if (typeof tabInventoryBtn !== "undefined" && tabInventoryBtn) {
    const invOpen = (typeof worldUnlocked === "function") ? worldUnlocked() : true;
    tabInventoryBtn.hidden = !invOpen;
    if (!invOpen && typeof tabInventory !== "undefined" && tabInventory && !tabInventory.hidden) showTab("work");
  }
  if (typeof renderInventory === "function") renderInventory();
  if (typeof renderCrafting === "function") renderCrafting();

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

  // Tooltip time lines hide outright while the option is off (on by
  // default): a body class beats rebuilding every tooltip.
  document.body.classList.toggle("hide-action-time", state.options.showActionTime === false);
  // Unlock-requirement sections hide outright while the option is off
  // (off by default, to keep tooltips compact): same body-class pattern.
  document.body.classList.toggle("hide-unlock-reqs", state.options.showUnlockReqs !== true);
  // Manual theme override (Options > Display): force light/dark via body
  // classes, or follow the OS when "system" (the CSS media queries handle
  // the auto case). Runs every render so loads and option changes apply.
  applyTheme();
  const nowCard = document.getElementById("nowCard");
  const nowCancelBtn = document.getElementById("nowCancelBtn");
  if (nowCard) nowCard.classList.toggle("busy", !!state.currentActionId);
  if (nowCancelBtn) nowCancelBtn.disabled = !state.currentActionId;
  // Keep the open tooltip's row tints truthful while amounts tick by.
  // Action tips recompute the discounted price (a milestone can land while
  // the tip is open); upgrade tips go free on paid builds; other tips reuse
  // the costs captured on open. The hover poll runs here too: it opens rings
  // for CSS-hovered anchors whose mouse events never fire (disabled buttons)
  // and heals missed leaves.
  if (typeof pollHoverTip === "function") pollHoverTip();
  if (hoverTip && hoverTip.ref.root.isConnected) {
    let costs = hoverTip.costs;
    if ((hoverTip.key.startsWith("a:") || hoverTip.key.startsWith("w:")) && typeof effectiveCosts === "function") {
      const act = getAction(hoverTip.key.slice(2));
      if (act) costs = tipCostsFor(act, effectiveCosts(act));
    } else if (hoverTip.key.startsWith("u:") && typeof getUpgrade === "function") {
      const u = getUpgrade(hoverTip.key.slice(2));
      if (u && typeof tipCostsForUpgrade === "function") costs = tipCostsForUpgrade(u);
    }
    tintTip(hoverTip.ref, costs);
    if (typeof syncTipPointer === "function") syncTipPointer(hoverTip.ref.root);
  }
  else hoverTip = null;
}

const nowCancelBtn = document.getElementById("nowCancelBtn");
if (nowCancelBtn) nowCancelBtn.addEventListener("click", () => setAction(null));
clearLogBtn.addEventListener("click", clearLog);
if (typeof clearLogBtnHome !== "undefined" && clearLogBtnHome) clearLogBtnHome.addEventListener("click", clearLog);
if (typeof clearLogBtnWorld !== "undefined" && clearLogBtnWorld) clearLogBtnWorld.addEventListener("click", clearLog);
if (typeof clearLogBtnInv !== "undefined" && clearLogBtnInv) clearLogBtnInv.addEventListener("click", clearLog);
if (typeof clearLogBtnCraft !== "undefined" && clearLogBtnCraft) clearLogBtnCraft.addEventListener("click", clearLog);
if (typeof clearLogBtnOptions !== "undefined" && clearLogBtnOptions) clearLogBtnOptions.addEventListener("click", clearLog);
resetBtn.addEventListener("click", () => {
  if (!confirm("Hard Reset will erase all progress. Are you sure?")) return;
  state = makeFreshState();
  try { localStorage.removeItem(MANUAL_SAVE_KEY); } catch (e) { /* storage unavailable */ }
  for (const k of Object.keys(hidingMode)) hidingMode[k] = false;
  if (typeof syncHideButtons === "function") syncHideButtons();
  if (typeof invSelling !== "undefined" && invSelling) invSelling = false;
  if (typeof sellQty !== "undefined") sellQty = 1;
  if (typeof autosaveAcc !== "undefined") autosaveAcc = 0;
  if (typeof consumeAcc !== "undefined") consumeAcc = null;
  if (typeof sellAcc !== "undefined") sellAcc = null;
  if (typeof skillXpAcc !== "undefined") skillXpAcc = null;
  if (typeof skillXpLast !== "undefined") skillXpLast = {};
  if (typeof craftAcc !== "undefined") craftAcc = null;
  if (typeof selectedSkillId !== "undefined") selectedSkillId = null;
  buildUI();
  clearLog();
  log("Hard reset: progress erased.");
  logIntro();
  if (typeof showOptionsSub === "function") showOptionsSub("actions");
  showTab("work");
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
if (typeof tabWorldBtn !== "undefined" && tabWorldBtn) tabWorldBtn.addEventListener("click", () => showTab("world"));
if (typeof tabInventoryBtn !== "undefined" && tabInventoryBtn) tabInventoryBtn.addEventListener("click", () => showTab("inventory"));
if (typeof tabCraftingBtn !== "undefined" && tabCraftingBtn) tabCraftingBtn.addEventListener("click", () => showTab("crafting"));
showMaxedChk.addEventListener("change", () => {
  state.options.showMaxedUpgrades = showMaxedChk.checked;
  render();
});
stopIfFullChk.addEventListener("change", () => {
  state.options.stopIfFull = stopIfFullChk.checked;
  render();
});
if (typeof hideEmptyInvChk !== "undefined" && hideEmptyInvChk) hideEmptyInvChk.addEventListener("change", () => {
  state.options.hideEmptyInv = hideEmptyInvChk.checked;
  render();
});
if (typeof sellWarnChk !== "undefined" && sellWarnChk) sellWarnChk.addEventListener("change", () => {
  state.options.sellWarn = sellWarnChk.checked;
  render();
});
if (typeof showActionTimeChk !== "undefined" && showActionTimeChk) showActionTimeChk.addEventListener("change", () => {
  state.options.showActionTime = showActionTimeChk.checked;
  render();
});
if (typeof showUnlockReqsChk !== "undefined" && showUnlockReqsChk) showUnlockReqsChk.addEventListener("change", () => {
  state.options.showUnlockReqs = showUnlockReqsChk.checked;
  render();
});
if (typeof showActionHighlightsChk !== "undefined" && showActionHighlightsChk) showActionHighlightsChk.addEventListener("change", () => {
  state.options.showActionHighlights = showActionHighlightsChk.checked;
  // Rings only repaint on hover events, so clear any mid-hover rings
  // outright; the next render re-tints the open tip.
  if (typeof clearAllHi === "function") clearAllHi();
  render();
});
// Theme override: "system" follows the OS, "light"/"dark" force that
// scheme. Body classes beat the media-query blocks (see index.html);
// documentElement colorScheme keeps native controls/scrollbars in sync.
function applyTheme() {
  const t = normalizeTheme(state.options && state.options.theme);
  document.body.classList.toggle("force-light", t === "light");
  document.body.classList.toggle("force-dark", t === "dark");
  document.documentElement.style.colorScheme = t === "light" ? "light" : t === "dark" ? "dark" : "light dark";
}
if (typeof themeSel !== "undefined" && themeSel) themeSel.addEventListener("change", () => {
  state.options.theme = normalizeTheme(themeSel.value);
  themeSel.value = state.options.theme;
  render();
});
if (logLimitInput) logLimitInput.addEventListener("change", () => {
  state.options.logLimit = normalizeLogLimit(logLimitInput.value);
  logLimitInput.value = state.options.logLimit;
  trimLog();
});
if (typeof autosaveChk !== "undefined" && autosaveChk) autosaveChk.addEventListener("change", () => {
  state.options.autosave = autosaveChk.checked;
  render();
});
if (typeof autosaveEverySel !== "undefined" && autosaveEverySel) autosaveEverySel.addEventListener("change", () => {
  state.options.autosaveEvery = normalizeAutosaveEvery(autosaveEverySel.value);
  autosaveEverySel.value = String(state.options.autosaveEvery);
  render();
});
if (typeof autosaveLogChk !== "undefined" && autosaveLogChk) autosaveLogChk.addEventListener("change", () => {
  state.options.logAutosaves = autosaveLogChk.checked;
  render();
});
