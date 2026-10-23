// Labor Game resources: currency/vital rows, bars, tooltips, panels.
function buildResourceTip(r) {
  const tip = document.createElement("span");
  tip.className = "tip";
  const head = document.createElement("div");
  head.className = "tip-head";
  const title = document.createElement("span");
  title.textContent = r.name;
  const count = document.createElement("span");
  count.className = "tip-count";
  head.appendChild(title);
  head.appendChild(count);
  tip.appendChild(head);
  const headTags = buildTipTags(r);
  if (headTags) tip.appendChild(headTags);
  const rate = document.createElement("div");
  rate.className = "tip-rate";
  rate.hidden = true;
  tip.appendChild(rate);
  if (r.tooltip) {
    const desc = document.createElement("div");
    desc.className = "tip-desc";
    desc.textContent = r.tooltip;
    tip.appendChild(desc);
  }
  return tip;
}

function buildResourceEl(r) {
  if (isCurrency(r)) {
    const line = document.createElement("div");
    line.className = "currency";
      line.id = "res-" + r.id;
      line.innerHTML = '<span class="cur-val"></span><span class="cur-name"></span>';
    line.querySelector(".cur-name").textContent = r.name;
    if (r.nameColor) line.querySelector(".cur-name").style.color = r.nameColor;
    line.tabIndex = 0;
    line.appendChild(buildResourceTip(r));
    uiRefs.set("r:" + r.id, { root: line, name: line.querySelector(".cur-name"), val: line.querySelector(".cur-val"), fill: null, tipCount: line.querySelector(".tip-count"), tipRate: line.querySelector(".tip-rate") });
    return line;
  }
  const box = document.createElement("div");
  box.className = "res";
  box.id = "res-" + r.id;
  box.innerHTML = '<span class="res-name"></span><div class="bar"><div class="fill"></div><span class="res-val"></span></div>';
  box.querySelector(".res-name").textContent = r.name;
  if (r.nameColor) box.querySelector(".res-name").style.color = r.nameColor;
  if (r.barColor) box.querySelector(".fill").style.background = r.barColor;
  box.tabIndex = 0;
  box.appendChild(buildResourceTip(r));
  uiRefs.set("r:" + r.id, { root: box, name: box.querySelector(".res-name"), val: box.querySelector(".res-val"), fill: box.querySelector(".fill"), tipCount: box.querySelector(".tip-count"), tipRate: box.querySelector(".tip-rate") });
  return box;
}

// Group slots shared by the resource panels and the actions panel.
// Items declare `group` (default per panel) and optional `header`.
// Same header = same titled header section; same header + group = same
// collapsible group. Everything renders in first-use order, so headers,
// bare groups, and their groups interleave by first appearance.
