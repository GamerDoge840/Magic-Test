// Labor Game skills: XP, levels, milestones, balloons, tab UI.
// Actions grant XP per cycle (see action `xp`); each skill tracks its own
// XP and level. Level curve lives here so baseXp/scaling stay config-only:
// 0 -> 1 always costs 1 XP, 1 -> 2 costs baseXp, later levels multiply by
// scaling each time. Milestone effects apply while attained (see SKILLS).

// XP to rise from `level` to `level + 1`.
function xpForSkillLevel(skill, level) {
  if (level <= 0) return 1;
  return skill.baseXp * Math.pow(skill.scaling, level - 1);
}

function skillState(id) {
  const st = state.skills[id];
  if (st && typeof st.xp === "number" && typeof st.level === "number") return st;
  const fresh = { xp: 0, level: 0 };
  state.skills[id] = fresh;
  return fresh;
}

function skillLevel(id) {
  return skillState(id).level;
}

// Skills tab unlock: any skill at Level 1+ (XP alone, Level 0, shows nothing).
function skillsUnlocked() {
  return SKILLS.some(s => skillLevel(s.id) >= 1);
}

// Skill unlocks: a skill is locked while any milestone effect targets it
// ({ type: "skill", skill }) without being attained - e.g. Odd Jobs
// Mastery and Sleeping unlock at Basic Knowledge Level 3. Targeted
// skills earn no XP and hide from tooltips; untargeted skills (like
// Basic Knowledge) are always unlocked.
function skillUnlocked(id) {
  let targeted = false;
  for (const x of allSkillMilestoneEffects()) {
    if (x.effect.type === "skill" && x.effect.skill === id) {
      targeted = true;
      if (skillLevel(x.source) >= x.req) return true;
    }
  }
  return !targeted;
}

// Improvement headroom from attained milestones: extra earnable levels
// past an action's base max (see actionLevel for the non-retroactive math).
function improvementCapBonus(actionId) {
  let bonus = 0;
  for (const x of attainedSkillMilestoneEffects()) {
    if (x.effect.type === "improvementCap" && x.effect.action === actionId) bonus += x.effect.amount;
  }
  return bonus;
}

// Grant XP (called from doTick): level-ups log green; each newly attained
// milestone fires a balloon. Loops, so big grants can multi-level.
// Locked skills earn nothing yet; improvementCap milestones snapshot the
// action's run count so the new levels must be re-earned (see actionLevel).
function gainSkillXp(sid, amount) {
  const skill = getSkill(sid);
  if (!skill || !(amount > 0)) return;
  if (!skillUnlocked(sid)) return;
  const st = skillState(sid);
  if (st.level >= skill.maxLevel) return;
  st.xp += amount;
  while (st.level < skill.maxLevel && st.xp >= xpForSkillLevel(skill, st.level)) {
    st.xp -= xpForSkillLevel(skill, st.level);
    st.level++;
    log("[Skill Level Up] Attained Level " + st.level + " in " + skill.name + ".", "skillup");
    for (const m of skill.milestones ?? []) {
      if (m.level === st.level) {
        balloon("New " + skill.name + " Milestone!", m.text, "skillMilestone");
        if (!state.impBase) state.impBase = {};
        for (const e of m.effects ?? []) {
          if (e.type === "improvementCap" && e.action && state.impBase[e.action] === undefined) {
            state.impBase[e.action] = state.stats.actions[e.action] ?? 0;
          }
        }
      }
    }
  }
  renderSkills();
}

// Main Stat totals: base value plus every attained milestone's "stat"
// effect (times the skill's level when perLevel).
function getEffectiveStat(statId) {
  const def = getPlayerStat(statId);
  let v = state.playerStats[statId] ?? def?.start ?? 1;
  for (const x of attainedSkillMilestoneEffects()) {
    const e = x.effect;
    if (e.type === "stat" && e.stat === statId) v += e.amount * (e.perLevel ? skillLevel(x.source) : 1);
  }
  return v;
}

// Skill-milestone cost discounts: every attained "cost" effect whose
// action + resource match shaves its amount off that action's cycle cost
// (floored at zero, stacking across milestones). Read through
// effectiveCosts so all checks, payments, and tooltips agree.
function costReductionFor(actionId, resourceId) {
  let cut = 0;
  for (const x of attainedSkillMilestoneEffects()) {
    const e = x.effect;
    if (e.type === "cost" && e.action === actionId && e.resource === resourceId) cut += e.amount;
  }
  return cut;
}

// One cycle's true price: base costs minus attained skill discounts.
function effectiveCosts(action) {
  const out = { ...(action.costs ?? {}) };
  for (const id of Object.keys(out)) {
    out[id] = Math.max(0, out[id] - costReductionFor(action.id, id));
  }
  return out;
}

// Balloon notifications: cards in the screen's right corner, X dismisses,
// auto-gone after 15 seconds. Categories (currently just "skillMilestone")
// each have a Notification Balloons filter toggle; unknown ones show.
function balloon(title, body, category) {
  if (category === "skillMilestone" && state.options.balloonSkillMilestones === false) return;
  const wrap = document.getElementById("balloons");
  if (!wrap) {
    log(title + " " + body);
    return;
  }
  const el = document.createElement("div");
  el.className = "balloon";
  const head = document.createElement("div");
  head.className = "balloon-head";
  const t = document.createElement("span");
  t.textContent = title;
  const x = document.createElement("button");
  x.type = "button";
  x.className = "balloon-x";
  x.textContent = "X";
  x.setAttribute("aria-label", "Dismiss notification");
  x.addEventListener("click", () => el.remove());
  head.appendChild(t);
  head.appendChild(x);
  const bd = document.createElement("div");
  bd.className = "balloon-body";
  bd.textContent = body;
  el.appendChild(head);
  el.appendChild(bd);
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 15000);
}

// Right-panel selection (runtime only): the selected skill, defaulting to
// the first skill at Level 1+ (locked and unstarted skills stay unshown).
let selectedSkillId = null;
function selectedSkill() {
  if (selectedSkillId) {
    const s = getSkill(selectedSkillId);
    if (s) return s;
  }
  return SKILLS.find(s => skillLevel(s.id) >= 1) ?? SKILLS[0] ?? null;
}

const skillsCtn = document.getElementById("skillsCtn");
const milesCtn = document.getElementById("milesCtn");
const milesSkillEl = document.getElementById("milesSkillEl");
const showMaxedSkillsChk = document.getElementById("showMaxedSkillsChk");

function buildSkillTip(s) {
  const tip = document.createElement("span");
  tip.className = "tip";
  const head = document.createElement("div");
  head.className = "tip-head";
  const title = document.createElement("span");
  head.appendChild(title);
  const count = document.createElement("span");
  count.className = "tip-count";
  head.appendChild(title);
  head.appendChild(count);
  tip.appendChild(head);
  const headTags = buildTipTags(s);
  if (headTags) tip.appendChild(headTags);
  if (s.description) {
    const desc = document.createElement("div");
    desc.className = "tip-desc";
    desc.textContent = s.description;
    tip.appendChild(desc);
  }
  const xpRefs = [];
  appendTipSection(tip, "Progress", { XP: 0 }, xpRefs);
  // Flavor works exactly like actions: config `flavor` shows as the italic
  // line, and skills without one show no flavor line at all.
  if (s.flavor) {
    const flavor = document.createElement("div");
    flavor.className = "tip-flavor";
    flavor.textContent = s.flavor;
    tip.appendChild(flavor);
  }
  return { tip, title, count, xpRefs };
}

function buildSkillRow(s) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "skillRow";
  btn.id = "skill-" + s.id;
  const top = document.createElement("div");
  top.className = "skillTop";
  const nm = document.createElement("span");
  nm.className = "skillName";
  top.appendChild(nm);
  btn.appendChild(top);
  const bar = document.createElement("div");
  bar.className = "skillXbar";
  bar.setAttribute("aria-hidden", "true");
  const fill = document.createElement("div");
  fill.className = "skillXfill";
  bar.appendChild(fill);
  btn.appendChild(bar);
  const sub = document.createElement("div");
  sub.className = "skillSub";
  btn.appendChild(sub);
  const tipBuilt = buildSkillTip(s);
  btn.appendChild(tipBuilt.tip);
  uiRefs.set("k:" + s.id, { root: btn, name: nm, fill, sub, tipTitle: tipBuilt.title, tipCount: tipBuilt.count, xpRefs: tipBuilt.xpRefs });
  btn.addEventListener("click", () => {
    selectedSkillId = s.id;
    renderSkills();
  });
  // Automatic placement: long skill tips flip below the row and cap their
  // height instead of clipping through the top of the screen.
  const skillTip = tipBuilt.tip;
  const fitSkill = () => { if (typeof fitTip === "function") fitTip(skillTip, btn, "up"); if (typeof syncTipPointer === "function") syncTipPointer(btn, true); };
  btn.addEventListener("mouseenter", fitSkill);
  btn.addEventListener("focus", fitSkill);
  return btn;
}

function buildSkillsTab() {
  if (!skillsCtn) return;
  // Collapsed groups survive rebuilds (same snapshot/restore as the
  // actions panel and resource panels).
  const open = (typeof snapDetailsOpen === "function") ? snapDetailsOpen(skillsCtn) : null;
  skillsCtn.innerHTML = "";
  // Skill groups work exactly like currency/action groups: `group` (plus
  // optional `header`) files rows into collapsible sections in first-use
  // order. Ungrouped skills land in "General".
  const { top, slotFor } = makeSlotCollector();
  for (const s of SKILLS) slotFor(s, "General").items.push(s);
  const buildButtons = (slot, wrap) => {
    for (const s of slot.items) wrap.appendChild(buildSkillRow(s));
  };
  if (!top.length) {
    const d = document.createElement("div");
    d.className = "emptyNote";
    d.textContent = "No skills yet.";
    skillsCtn.appendChild(d);
  }
  for (const entry of top) {
    if (entry.kind === "header") skillsCtn.appendChild(buildHeaderSection(entry, "skillBtns", buildButtons));
    else skillsCtn.appendChild(buildGroupDetails(entry.slot, "skillBtns", buildButtons));
  }
  if (typeof restoreDetailsOpen === "function") restoreDetailsOpen(skillsCtn, open);
  if (showMaxedSkillsChk) showMaxedSkillsChk.checked = !!state.options.showMaxedSkills;
  if (selectedSkillId && !getSkill(selectedSkillId)) selectedSkillId = null;
  // Milestones panel rebuilds on first render via its sig.
  if (milesCtn) milesCtn._sig = null;
}

// Left list + right milestones, refreshed every frame while visible.
// Rows hide below Level 1 (skills appear once started) and when maxed and
// the toggle is off; the right panel rebuilds only when the selection or
// any level changes.
function renderSkills() {
  const sel = selectedSkill();
  for (const s of SKILLS) {
    const ref = uiRefs.get("k:" + s.id);
    if (!ref) continue;
    const st = skillState(s.id);
    const maxed = st.level >= s.maxLevel;
    const hidden = st.level < 1 || (maxed && !state.options.showMaxedSkills);
    const need = maxed ? 0 : xpForSkillLevel(s, st.level);
    const sig = st.level + "|" + st.xp + "|" + (hidden ? 1 : 0) + "|" + (sel && sel.id === s.id ? 1 : 0);
    if (ref._sig === sig) continue;
    ref._sig = sig;
    ref.root.hidden = hidden;
    ref.root.classList.toggle("selected", !!sel && sel.id === s.id);
    ref.name.textContent = maxed ? "[MAX] " + s.name : "[Lvl. " + st.level + "] " + s.name;
    ref.fill.style.width = maxed ? "100%" : Math.max(0, Math.min(100, (st.xp / need) * 100)) + "%";
    ref.sub.textContent = maxed ? "MAX" : formatNum(st.xp) + " / " + formatNum(need) + " XP";
    if (ref.tipTitle) ref.tipTitle.textContent = s.name;
    if (ref.tipCount) ref.tipCount.textContent = maxed ? "MAX" : "Lvl. " + st.level + " / " + s.maxLevel;
    for (const g of ref.xpRefs ?? []) g.el.textContent = formatNum(st.xp) + " / " + formatNum(need);
  }
  if (milesCtn) {
    // Per-milestone hidden state joins the sig so (un)hiding repaints.
    const mkeys = sel ? (sel.milestones ?? []).map(m => itemHidden("m:" + sel.id + ":" + m.level) ? "1" : "0").join(",") : "";
    const msig = (sel ? sel.id : "-") + "|" + SKILLS.map(s => skillLevel(s.id)).join(",") + "|" + mkeys + "|" + (hidingMode.milestones ? 1 : 0);
    if (milesCtn._sig !== msig) {
      milesCtn._sig = msig;
      buildMilesPanel(sel);
    }
  }
}

// Right side: selected skill's name + attained milestones and the next one.
// Attained rows glow light-green; the next one looks like other UI.
// Milestones hide individually ("m:<skillId>:<level>"): while
// milestones-hiding mode is armed, clicking a row toggles just that row;
// otherwise hidden rows are skipped (a fully-hidden list shows a
// "Milestones hidden." note instead). Like all user hiding this is
// display-only: effects keep applying and milestones still attain.
function buildMilesPanel(sel) {
  milesCtn.innerHTML = "";
  if (milesSkillEl) milesSkillEl.textContent = sel ? sel.name : "No skills yet";
  if (!sel) return;
  const lvl = skillLevel(sel.id);
  const mkey = (m) => "m:" + sel.id + ":" + m.level;
  let shownNext = false;
  let any = false;
  for (const m of sel.milestones ?? []) {
    const attained = m.level <= lvl;
    if (!attained) {
      if (shownNext) continue;
      shownNext = true;
    }
    // Hidden rows still render (struck-through) while the mode is armed
    // so they can be unhidden; otherwise they are skipped entirely.
    const mHidden = itemHidden(mkey(m));
    if (mHidden && !hidingMode.milestones) continue;
    any = true;
    const row = document.createElement("div");
    row.className = "mileRow" + (attained ? " attained" : "") + (mHidden ? " userHidden" : "");
    row.addEventListener("click", () => {
      if (!hidingMode.milestones) return;
      // Drop any legacy per-skill key (superseded by per-milestone keys).
      delete state.options.hidden["m:" + sel.id];
      toggleItemHidden(mkey(m));
    });
    const head = document.createElement("div");
    head.className = "mileHead";
    // Custom names render with the level auto-prepended: "[Lvl. 2] Scroll
    // Frugality". Without one the header reads "[Lvl. N] Milestone".
    head.textContent = "[Lvl. " + m.level + "] " + (m.name || "Milestone");
    const body = document.createElement("div");
    body.className = "mileBody";
    body.textContent = m.text;
    row.appendChild(head);
    row.appendChild(body);
    milesCtn.appendChild(row);
  }
  if (!any) {
    const d = document.createElement("div");
    d.className = "emptyNote";
    d.textContent = (sel.milestones ?? []).length ? "Milestones hidden." : "No milestones defined.";
    milesCtn.appendChild(d);
  }
}

if (showMaxedSkillsChk) showMaxedSkillsChk.addEventListener("change", () => {
  state.options.showMaxedSkills = showMaxedSkillsChk.checked;
  renderSkills();
});
