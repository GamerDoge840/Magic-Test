// Labor Game upgrades: buying, timed builds, max effects, buttons.
function upgradeBuildState(id) {
  return state.builds[id] ?? (state.builds[id] = { progress: 0, paid: false });
}

// Shared completion for instant buys and finished timed builds: grant
// the purchase, apply home grants (first home auto-equips; `replaces`
// homes override the listed ones and become current instantly), log it.
function grantUpgrade(u) {
  const cap = (typeof getEffectiveUpgradeCap === "function") ? getEffectiveUpgradeCap(u) : (u.maxPurchases ?? 1);
  state.upgrades[u.id] = (state.upgrades[u.id] ?? 0) + 1;
  for (const e of u.effects ?? []) {
    if (e.type === "home" && e.home) {
      const h = getHome(e.home);
      const hadHome = ownsAnyHome();
      state.homes[e.home] = true;
      const replaces = (h && h.replaces) ? (Array.isArray(h.replaces) ? h.replaces : [h.replaces]) : [];
      for (const r of replaces) delete state.homes[r];
      if (!hadHome || replaces.length) {
        state.currentHome = e.home;
        log("You move into the " + ((h && h.name) || e.home) + ".");
      }
    }
  }
  log((u.buyLog ?? "Bought: " + u.name) + " (" + state.upgrades[u.id] + "/" + (cap === Infinity ? "no limit" : formatNum(cap)) + ").", "upgrade");
}

function buyUpgrade(id) {
  const u = getUpgrade(id);
  if (!u) return;
  // Timed purchase: costs are paid when the build starts, clicking again
  // pauses it, and resuming a paid build is free - exactly like actions.
  if (u.buildTime) { buildUpgrade(u); return; }
  const owned = state.upgrades[id] ?? 0;
  const cap = (typeof getEffectiveUpgradeCap === "function") ? getEffectiveUpgradeCap(u) : (u.maxPurchases ?? 1);
  if (owned >= cap) {
    log(u.name + " is already maxed out.");
    return;
  }
  if (!canAfford(u.cost)) {
    log("Not enough for " + u.name + " (" + describeCost(u.cost) + ").");
    return;
  }
  for (const [rid, n] of Object.entries(u.cost ?? {})) state.amounts[rid] -= n;
  grantUpgrade(u);
  render();
}

// Start/pause/resume a timed build. One build runs at a time; starting a
// new one pauses whatever was running (its progress and payment are
// kept). Each completion grants exactly one purchase, then stops.
function buildUpgrade(u) {
  const owned = state.upgrades[u.id] ?? 0;
  const cap = (typeof getEffectiveUpgradeCap === "function") ? getEffectiveUpgradeCap(u) : (u.maxPurchases ?? 1);
  if (owned >= cap) {
    log(u.name + " is already maxed out.");
    return;
  }
  // Clicking the running build pauses it; progress and payment are kept.
  if (state.activeBuildId === u.id) {
    state.activeBuildId = null;
    lastTime = performance.now();
    render();
    return;
  }
  const b = upgradeBuildState(u.id);
  if (!b.paid) {
    if (!canAfford(u.cost)) {
      log("Not enough for " + u.name + " (" + describeCost(u.cost) + ").");
      render();
      return;
    }
    for (const [rid, n] of Object.entries(u.cost ?? {})) state.amounts[rid] -= n;
    b.paid = true;
  }
  state.activeBuildId = u.id;
  lastTime = performance.now();
  render();
}

// Finish a timed build: grant the purchase, then reset so a repeatable
// timed upgrade pays again for its next purchase. Stops either way.
function completeBuild(u) {
  const cap = (typeof getEffectiveUpgradeCap === "function") ? getEffectiveUpgradeCap(u) : (u.maxPurchases ?? 1);
  state.activeBuildId = null;
  if ((state.upgrades[u.id] ?? 0) >= cap) { render(); return; }
  grantUpgrade(u);
  state.builds[u.id] = { progress: 0, paid: false };
  lastTime = performance.now();
  render();
}

function buildUpgradeBtn(u) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shopBtn";
  btn.id = "shop-" + u.id;
  const label = document.createElement("span");
  label.className = "action-label";
  label.textContent = u.name;
  btn.appendChild(label);

  const tip = document.createElement("span");
  tip.className = "tip";
  const head = document.createElement("div");
  head.className = "tip-head";
  const title = document.createElement("span");
  title.textContent = u.name;
  const count = document.createElement("span");
  count.className = "tip-count";
  head.appendChild(title);
  head.appendChild(count);
  tip.appendChild(head);
  const headTags = buildTipTags(u);
  if (headTags) tip.appendChild(headTags);
  const desc = document.createElement("div");
  desc.className = "tip-desc";
  desc.textContent = u.description ?? autoUpgradeDescription({ cost: u.cost ?? {}, effects: u.effects ?? [], buildTime: u.buildTime });
  tip.appendChild(desc);
  const costRefs = [];
  appendTipSection(tip, "Cost", u.cost ?? {}, costRefs);
  if (u.effects && u.effects.length) {
    const sec = document.createElement("div");
    sec.className = "tip-sec";
    const lab = document.createElement("div");
    lab.className = "tip-sec-label";
    lab.textContent = (u.effects ?? []).length > 1 ? "Effects" : "Effect";
    sec.appendChild(lab);
    for (const e of u.effects) {
      const row = document.createElement("div");
      row.className = "tip-row";
      const s = document.createElement("span");
      s.textContent = describeEffect(e);
      row.appendChild(s);
      sec.appendChild(row);
    }
    tip.appendChild(sec);
  }
  if (u.flavor) {
    const flavor = document.createElement("div");
    flavor.className = "tip-flavor";
    flavor.textContent = u.flavor;
    tip.appendChild(flavor);
  }
  btn.appendChild(tip);

  // Timed upgrades show action-style progress while building (refs below;
  // render fills them). Instant upgrades never activate, so it stays put.
  const progress = document.createElement("div");
  progress.className = "action-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.hidden = true; // render unhides only while a buildTime build runs
  const fill = document.createElement("div");
  fill.className = "action-fill";
  progress.appendChild(fill);
  const time = document.createElement("span");
  time.className = "action-time";
  progress.appendChild(time);
  btn.appendChild(progress);

  btn.addEventListener("click", () => {
    // Hiding mode: clicking strikes the upgrade hidden instead of buying it.
    if (hidingMode.actions) { toggleItemHidden("u:" + u.id); return; }
    buyUpgrade(u.id);
  });
  uiRefs.set("u:" + u.id, { root: btn, label, costs: costRefs, tc: count, fill, prog: progress, time });
  const hi = (on) => hiResources({ costs: u.cost, gains: effectGains(u) }, on);
  btn.addEventListener("mouseenter", () => openTip("u:" + u.id, btn, hi, u.cost));
  btn.addEventListener("mouseleave", () => closeTip("u:" + u.id, hi));
  btn.addEventListener("focus", () => openTip("u:" + u.id, btn, hi, u.cost));
  btn.addEventListener("blur", () => closeTip("u:" + u.id, hi));
  return btn;
}

