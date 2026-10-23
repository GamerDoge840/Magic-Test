// Labor Game collapsible groups and titled group headers (shared by resources/actions).
function makeSlotCollector() {
  const top = [];
  const headers = new Map();
  const slots = new Map();
  const slotFor = (item, defaultGroup) => {
    const group = item.group || defaultGroup;
    const header = item.header || null;
    const key = header ? "H:" + header + "\n" + group : "G:" + group;
    let slot = slots.get(key);
    if (!slot) {
      slot = { header, group, actions: [], upgrades: [], items: [] };
      slots.set(key, slot);
      if (header) {
        let entry = headers.get(header);
        if (!entry) {
          entry = { kind: "header", name: header, groups: [] };
          headers.set(header, entry);
          top.push(entry);
        }
        entry.groups.push(slot);
      } else {
        top.push({ kind: "group", slot });
      }
    }
    return slot;
  };
  return { top, slotFor };
}

function buildGroupDetails(slot, btnsClass, buildButtons) {
  const group = document.createElement("details");
  group.className = "taskGroup";
  group.open = true;
  const summary = document.createElement("summary");
  summary.textContent = slot.group;
  group.appendChild(summary);
  const btns = document.createElement("div");
  btns.className = btnsClass;
  buildButtons(slot, btns);
  group.appendChild(btns);
  return group;
}

function buildHeaderSection(entry, btnsClass, buildButtons) {
  const sec = document.createElement("section");
  sec.className = "taskHeader";
  const title = document.createElement("div");
  title.className = "taskHeader-title";
  title.textContent = entry.name;
  sec.appendChild(title);
  for (const slot of entry.groups) sec.appendChild(buildGroupDetails(slot, btnsClass, buildButtons));
  return sec;
}

function appendGroupedResources() {
  // Unified resource groups: currencies and vitals share one namespace,
  // exactly like actions + upgrades. Same group name = same collapsible
  // section, with currency rows and vital bars mixed together in RESOURCES
  // order. A group's panel (Currencies on the left vs Vitals on the right)
  // is set by its first item; later items join it wherever it lives.
  // A resource can also set `header` to file its group under a titled
  // header section instead of standing alone.
  const { top, slotFor } = makeSlotCollector();
  for (const r of RESOURCES) slotFor(r, isCurrency(r) ? "Basic" : "Body").items.push(r);
  const buildButtons = (slot, wrap) => {
    for (const r of slot.items) wrap.appendChild(buildResourceEl(r));
  };
  currenciesCtn.innerHTML = "";
  vitalsCtn.innerHTML = "";
  if (!top.length) {
    for (const emptyCtn of [currenciesCtn, vitalsCtn]) {
      const d = document.createElement("div");
      d.className = "emptyNote";
      d.textContent = "None yet.";
      emptyCtn.appendChild(d);
    }
    return;
  }
  for (const entry of top) {
    if (entry.kind === "header") {
      const home = isCurrency(entry.groups[0].items[0]) ? currenciesCtn : vitalsCtn;
      home.appendChild(buildHeaderSection(entry, "taskBtns stack", buildButtons));
    } else {
      const home = isCurrency(entry.slot.items[0]) ? currenciesCtn : vitalsCtn;
      home.appendChild(buildGroupDetails(entry.slot, "taskBtns stack", buildButtons));
    }
  }
}

