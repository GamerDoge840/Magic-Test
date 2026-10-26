// Labor Game UI shell: buildUI, tabs, options, filter window, file wiring.
// Rebuilds wipe their containers' DOM, which would pop every
// user-collapsed group back open (e.g. buying furniture rebuilds the
// actions panel too). Snapshot/restore <details> open states around the
// rebuild so collapsed sections stay collapsed. Structure is deterministic
// (same config = same order), so per-container index mapping lines up.
function snapDetailsOpen(ctn) {
  return [...ctn.querySelectorAll("details")].map(d => d.open);
}
function restoreDetailsOpen(ctn, arr) {
  if (!arr) return;
  const ds = ctn.querySelectorAll("details");
  for (let i = 0; i < ds.length && i < arr.length; i++) ds[i].open = arr[i];
}

function buildUI() {
  uiRefs.clear();
  const actOpen = snapDetailsOpen(actionsCtn);
  const hostOpen = new Map();
  for (const h of document.querySelectorAll(".js-currencies, .js-vitals")) hostOpen.set(h, snapDetailsOpen(h));
  appendGroupedResources();

  actionsCtn.innerHTML = "";
  // Unified action groups: ACTIONS and UPGRADES share one namespace.
  // Same group name = same collapsible section (actions first, then
  // upgrades). Sections appear in first-use order: actions first, then
  // upgrades that introduce a new name. Both default to "Tasks"; "Shop"
  // is just a regular group name used by the example upgrade below.
  // Any action/upgrade can also set `header` to file its group under a
  // titled header section (groups for groups).
  const { top, slotFor } = makeSlotCollector();
  for (const a of ACTIONS) slotFor(a, "Tasks").actions.push(a);
  for (const u of UPGRADES) slotFor(u, "Tasks").upgrades.push(u);
  const buildButtons = (slot, btns) => {
    if (!slot.actions.length && !slot.upgrades.length) {
      const d = document.createElement("div");
      d.className = "emptyNote";
      d.textContent = "None yet.";
      btns.appendChild(d);
    }
    for (const a of slot.actions) btns.appendChild(buildActionBtn(a));
    for (const u of slot.upgrades) btns.appendChild(buildUpgradeBtn(u));
  };
  if (!top.length) {
    const group = document.createElement("details");
    group.className = "taskGroup";
    group.open = true;
    const summary = document.createElement("summary");
    summary.textContent = "Tasks";
    group.appendChild(summary);
    const btns = document.createElement("div");
    btns.className = "taskBtns";
    buildButtons({ actions: [], upgrades: [] }, btns);
    group.appendChild(btns);
    actionsCtn.appendChild(group);
  }
  for (const entry of top) {
    if (entry.kind === "header") actionsCtn.appendChild(buildHeaderSection(entry, "taskBtns", buildButtons));
    else actionsCtn.appendChild(buildGroupDetails(entry.slot, "taskBtns", buildButtons));
  }
  restoreDetailsOpen(actionsCtn, actOpen);
  for (const [h, arr] of hostOpen) restoreDetailsOpen(h, arr);
  showMaxedChk.checked = !!state.options.showMaxedUpgrades;
  if (logLimitInput) logLimitInput.value = getLogLimit();
  buildPlayerTab();
  if (typeof buildSkillsTab === "function") buildSkillsTab();
  buildFurnitureCards();
  updateSortButtons();
  syncFurnFilters();
  buildFurnTypeFilters();
  applyLogFilters();
}

function syncFurnFilters() {
  const flt = state.options.furnFilters ?? {};
  if (furnMaxedChk) furnMaxedChk.checked = flt.maxed !== false;
  if (furnOwnedChk) furnOwnedChk.checked = flt.owned !== false;
  if (furnUnownedChk) furnUnownedChk.checked = flt.unowned !== false;
  if (furnBlockedChk) furnBlockedChk.checked = flt.blocked !== false;
}

// Type sub-section of the Furniture Filters modal: one checkbox per
// discriminative furniture tag, rebuilt every buildUI so new tags appear
// with no extra work. Counts update live with the config.
function buildFurnTypeFilters() {
  const grid = document.getElementById("furnTypeGrid");
  const sec = document.getElementById("furnTypeSec");
  if (!grid || !sec) return;
  grid.innerHTML = "";
  const types = furnitureTypeTags();
  for (const t of types) {
    const item = document.createElement("div");
    item.className = "filterItem";
    const lab = document.createElement("label");
    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = furnTypeOn(t);
    chk.addEventListener("change", () => {
      state.options.furnTypes = state.options.furnTypes ?? {};
      state.options.furnTypes[t] = chk.checked;
      render();
    });
    lab.appendChild(chk);
    lab.appendChild(document.createTextNode(" " + t));
    item.appendChild(lab);
    const n = FURNITURE.filter(f => getTags(f).includes(t)).length;
    const sub = document.createElement("div");
    sub.className = "modalSub";
    sub.textContent = n === 1 ? "1 furnishing." : n + " furnishings.";
    item.appendChild(sub);
    grid.appendChild(item);
  }
  sec.hidden = !types.length;
}

// Player tab: name row + stat rows (same tooltip style as resources).
// Unlocked by default - the tab button is always visible.
function buildPlayerTab() {
  playerNameEl.textContent = state.playerName;
  playerNameInput.value = state.playerName;
  playerNameInput.hidden = true;
  playerNameEl.hidden = false;
  playerStatsCtn.innerHTML = "";
  for (const s of PLAYER_STATS) playerStatsCtn.appendChild(buildPlayerStatEl(s));
}

function buildPlayerStatTip(s) {
  const tip = document.createElement("span");
  tip.className = "tip";
  const head = document.createElement("div");
  head.className = "tip-head";
  const title = document.createElement("span");
  title.textContent = s.abbr ? s.name + " (" + s.abbr + ")" : s.name;
  const count = document.createElement("span");
  count.className = "tip-count";
  head.appendChild(title);
  head.appendChild(count);
  tip.appendChild(head);
  const headTags = buildTipTags(s);
  if (headTags) tip.appendChild(headTags);
  if (s.tooltip) {
    const desc = document.createElement("div");
    desc.className = "tip-desc";
    desc.textContent = s.tooltip;
    tip.appendChild(desc);
  }
  return tip;
}

function buildPlayerStatEl(s) {
  const line = document.createElement("div");
  line.className = "currency";
  line.id = "stat-" + s.id;
  line.innerHTML = '<span class="cur-val"></span><span class="cur-name"></span>';
  line.querySelector(".cur-name").textContent = s.abbr || s.name;
  if (s.nameColor) line.querySelector(".cur-name").style.color = s.nameColor;
  line.tabIndex = 0;
  line.appendChild(buildPlayerStatTip(s));
  uiRefs.set("p:" + s.id, { root: line, name: line.querySelector(".cur-name"), val: line.querySelector(".cur-val"), tipCount: line.querySelector(".tip-count") });
  // Automatic placement: tall stat tips flip/cap instead of clipping.
  const statTip = line.querySelector(".tip");
  if (statTip) {
    const fit = () => { if (typeof fitTip === "function") fitTip(statTip, line, "down"); };
    line.addEventListener("mouseenter", fit);
    line.addEventListener("focus", fit);
  }
  return line;
}

// Rename: pencil opens an inline editor; Enter/blur commits, Escape cancels.
// Cosmetic only - nothing reads the name yet.
function startNameEdit() {
  playerNameInput.value = state.playerName;
  playerNameEl.hidden = true;
  playerNameInput.hidden = false;
  playerNameInput.focus();
  playerNameInput.select();
}
function commitNameEdit() {
  if (playerNameInput.hidden) return;
  state.playerName = normalizePlayerName(playerNameInput.value);
  playerNameEl.textContent = state.playerName;
  playerNameInput.value = state.playerName;
  playerNameInput.hidden = true;
  playerNameEl.hidden = false;
  playerNameEditBtn.focus();
}
function cancelNameEdit() {
  playerNameInput.value = state.playerName;
  playerNameInput.hidden = true;
  playerNameEl.hidden = false;
  playerNameEditBtn.focus();
}
playerNameEditBtn.addEventListener("click", startNameEdit);
playerNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") commitNameEdit();
  else if (e.key === "Escape") cancelNameEdit();
});
playerNameInput.addEventListener("blur", commitNameEdit);

logFilterBtn.addEventListener("click", () => {
  logBeginChk.checked = state.options.logActionBegin !== false;
  logStopChk.checked = state.options.logActionStop !== false;
  logUpgradesChk.checked = state.options.logUpgrades !== false;
  logUnlocksChk.checked = state.options.logUnlocks !== false;
  logImprovementsChk.checked = state.options.logImprovements !== false;
  logFilterModal.hidden = false;
});
// Home-tab Work Log mirror: same modal, same clear - every copy stays synced.
if (logFilterBtnHome) logFilterBtnHome.addEventListener("click", () => {
  logBeginChk.checked = state.options.logActionBegin !== false;
  logStopChk.checked = state.options.logActionStop !== false;
  logUpgradesChk.checked = state.options.logUpgrades !== false;
  logUnlocksChk.checked = state.options.logUnlocks !== false;
  logImprovementsChk.checked = state.options.logImprovements !== false;
  logFilterModal.hidden = false;
});
logFilterCloseBtn.addEventListener("click", () => { logFilterModal.hidden = true; });
logFilterModal.addEventListener("click", (e) => { if (e.target === logFilterModal) logFilterModal.hidden = true; });
logBeginChk.addEventListener("change", () => { state.options.logActionBegin = logBeginChk.checked; applyLogFilters(); });
logStopChk.addEventListener("change", () => { state.options.logActionStop = logStopChk.checked; applyLogFilters(); });
logUpgradesChk.addEventListener("change", () => { state.options.logUpgrades = logUpgradesChk.checked; applyLogFilters(); });
logUnlocksChk.addEventListener("change", () => { state.options.logUnlocks = logUnlocksChk.checked; applyLogFilters(); });
logImprovementsChk.addEventListener("change", () => { state.options.logImprovements = logImprovementsChk.checked; applyLogFilters(); });
sortSpaceBtn.addEventListener("click", () => setFurnSort("space"));
sortNameBtn.addEventListener("click", () => setFurnSort("name"));
homeSelectBtn.addEventListener("click", () => {
  buildHomeList();
  homeModal.hidden = false;
});
homeCloseBtn.addEventListener("click", () => { homeModal.hidden = true; });
homeModal.addEventListener("click", (e) => { if (e.target === homeModal) homeModal.hidden = true; });
furnFilterBtn.addEventListener("click", () => {
  syncFurnFilters();
  buildFurnTypeFilters();
  furnFilterModal.hidden = false;
});
furnFilterCloseBtn.addEventListener("click", () => { furnFilterModal.hidden = true; });
furnFilterModal.addEventListener("click", (e) => { if (e.target === furnFilterModal) furnFilterModal.hidden = true; });
furnMaxedChk.addEventListener("change", () => { state.options.furnFilters.maxed = furnMaxedChk.checked; render(); });
furnOwnedChk.addEventListener("change", () => { state.options.furnFilters.owned = furnOwnedChk.checked; render(); });
furnUnownedChk.addEventListener("change", () => { state.options.furnFilters.unowned = furnUnownedChk.checked; render(); });
furnBlockedChk.addEventListener("change", () => { state.options.furnFilters.blocked = furnBlockedChk.checked; render(); });
importInput.addEventListener("change", () => {
  if (importInput.files && importInput.files[0]) importSaveFile(importInput.files[0]);
});
// Item hiding (purely visual): the panel's Hide button arms hiding mode
// (button brightens to Done); every unlocked item in that panel shows, and
// clicking one strikes it hidden (click again to unhide). Clicking Done
// exits and the hiding applies. Hidden things keep working - this only
// changes what is drawn. Saved in state.options.hidden.
function toggleItemHidden(key) {
  if (state.options.hidden[key]) delete state.options.hidden[key];
  else state.options.hidden[key] = true;
  render();
}

function syncHideButtons() {
  const pairs = [
    [hidingMode.currencies, [currenciesHideBtn, currenciesHideBtnHome]],
    [hidingMode.vitals, [vitalsHideBtn]],
    [hidingMode.actions, [actionsHideBtn]],
    [hidingMode.milestones, [milesHideBtn]],
  ];
  let any = false;
  for (const [on, btns] of pairs) {
    if (on) any = true;
    for (const b of btns) {
      if (!b) continue;
      b.textContent = on ? "Done" : "⛒";
      b.classList.toggle("on", on);
    }
  }
  document.body.classList.toggle("hiding", any);
}

function toggleHidingMode(kind) {
  hidingMode[kind] = !hidingMode[kind];
  syncHideButtons();
  render();
}

if (currenciesHideBtn) currenciesHideBtn.addEventListener("click", () => toggleHidingMode("currencies"));
if (currenciesHideBtnHome) currenciesHideBtnHome.addEventListener("click", () => toggleHidingMode("currencies"));
if (vitalsHideBtn) vitalsHideBtn.addEventListener("click", () => toggleHidingMode("vitals"));
if (actionsHideBtn) actionsHideBtn.addEventListener("click", () => toggleHidingMode("actions"));
if (milesHideBtn) milesHideBtn.addEventListener("click", () => toggleHidingMode("milestones"));
// Escape closes any open modal (Filters, Select Home) and drops focus from
// whatever it held, so keyboard users are never stuck in a dialog.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" && e.key !== "Esc") return;
  let moved = null;
  for (const m of [logFilterModal, furnFilterModal, homeModal]) {
    if (m && !m.hidden) {
      if (m.contains(document.activeElement)) moved = document.activeElement;
      m.hidden = true;
    }
  }
  if (moved && moved.blur) moved.blur();
});
manualSaveBtn.addEventListener("click", saveManualGame);
manualLoadBtn.addEventListener("click", loadManualGame);

