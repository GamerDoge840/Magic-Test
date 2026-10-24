// Labor Game UI shell: buildUI, tabs, options, filter window, file wiring.
function buildUI() {
  uiRefs.clear();
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
  showMaxedChk.checked = !!state.options.showMaxedUpgrades;
  if (logLimitInput) logLimitInput.value = getLogLimit();
  applyLogFilters();
}

logFilterBtn.addEventListener("click", () => {
  logActionsChk.checked = state.options.logActions !== false;
  logUpgradesChk.checked = state.options.logUpgrades !== false;
  logUnlocksChk.checked = state.options.logUnlocks !== false;
  logImprovementsChk.checked = state.options.logImprovements !== false;
  logFilterModal.hidden = false;
});
logFilterCloseBtn.addEventListener("click", () => { logFilterModal.hidden = true; });
logFilterModal.addEventListener("click", (e) => { if (e.target === logFilterModal) logFilterModal.hidden = true; });
logActionsChk.addEventListener("change", () => { state.options.logActions = logActionsChk.checked; applyLogFilters(); });
logUpgradesChk.addEventListener("change", () => { state.options.logUpgrades = logUpgradesChk.checked; applyLogFilters(); });
logUnlocksChk.addEventListener("change", () => { state.options.logUnlocks = logUnlocksChk.checked; applyLogFilters(); });
logImprovementsChk.addEventListener("change", () => { state.options.logImprovements = logImprovementsChk.checked; applyLogFilters(); });
importInput.addEventListener("change", () => {
  if (importInput.files && importInput.files[0]) importSaveFile(importInput.files[0]);
});
manualSaveBtn.addEventListener("click", saveManualGame);
manualLoadBtn.addEventListener("click", loadManualGame);

