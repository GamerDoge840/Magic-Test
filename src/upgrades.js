// Labor Game upgrades: buying, max effects, buttons.
function buyUpgrade(id) {
  const u = getUpgrade(id);
  if (!u) return;
  const owned = state.upgrades[id] ?? 0;
  if (owned >= u.maxPurchases) {
    log(u.name + " is already maxed out.");
    return;
  }
  if (!canAfford(u.cost)) {
    log("Not enough for " + u.name + " (" + describeCost(u.cost) + ").");
    return;
  }
  for (const [rid, n] of Object.entries(u.cost ?? {})) state.amounts[rid] -= n;
  state.upgrades[id] = owned + 1;
  // Home grants: the first home ever acquired also becomes current.
  // Homes with `replaces` override (remove) the listed homes and become
  // current instantly - e.g. Medium Tent replaces Small Tent.
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
  const cap = u.maxPurchases === Infinity ? "no limit" : formatNum(u.maxPurchases);
  log((u.buyLog ?? "Bought: " + u.name) + " (" + state.upgrades[id] + "/" + cap + ").", "upgrade");
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
  desc.textContent = u.description ?? autoUpgradeDescription({ cost: u.cost ?? {}, effects: u.effects ?? [] });
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

  btn.addEventListener("click", () => buyUpgrade(u.id));
  uiRefs.set("u:" + u.id, { root: btn, label, costs: costRefs, tc: count });
  const hi = (on) => hiResources({ costs: u.cost, gains: effectGains(u) }, on);
  btn.addEventListener("mouseenter", () => openTip("u:" + u.id, btn, hi, u.cost));
  btn.addEventListener("mouseleave", () => closeTip("u:" + u.id, hi));
  btn.addEventListener("focus", () => openTip("u:" + u.id, btn, hi, u.cost));
  btn.addEventListener("blur", () => closeTip("u:" + u.id, hi));
  return btn;
}

