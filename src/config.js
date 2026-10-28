// Labor Game config: RESOURCES, ACTIONS, UPGRADES. Edit freely; the engine reads these lists.
/* ============================================================
   LABOR GAME CONFIG - EDIT EVERYTHING HERE
   ------------------------------------------------------------
   Adding more is copy/paste:
     1. Resource? Add one line to RESOURCES (QUICK ADD below).
     2. Action?   Copy the minimal action into ACTIONS.
     3. Upgrade?  Copy the minimal upgrade into UPGRADES.
   Groups auto-create: same group name = same collapsible section,
   in first-use order. Only id + name are ever required; everything
   else has a default and missing descriptions are auto-written.

   RESOURCES: every tracked number, currencies + vitals in one list.
     QUICK ADD currency: { id: "wood", name: "Wood" },
     QUICK ADD vital:    { id: "health", name: "Health", max: 10 },
      - id:    short code used by actions/costs (no spaces, e.g. "wood")
      - name:  label shown on screen (defaults to id)
      - start: (optional, default 0) amount you begin with
      - max:   (optional, default Infinity) cap, shown as "3 / 5".
               Producing past the cap still runs; the excess is destroyed.
      - group: (optional) section name. Currencies default to "Basic",
               vitals to "Body". Same name mixes currencies + vitals
               in one section; the panel follows the first item.
      - plural: (optional) plural for currencies at != 1, e.g. "Coins".
       - tags: (optional) identifying chips under the tooltip header,
                e.g. tags: ["Currency"]. Check from code with
                hasTag(item, "Currency") or itemsWithTag("Currency").
       - header: (optional) file this group under a titled header
                section, e.g. header: "Elements". Same header = same
                section; groups for groups.
      - nameColor / barColor / tooltip: (optional) styling + hover text.
        The tooltip always shows the amount, cap, and per-second rate too.
       Layout rule: `kind` picks the display; without it, max
      Infinity counts as a currency (left box, no bar) and anything with
      a finite max counts as a vital (right box, with bar).
      - kind:  (optional) "currency" or "vital". Coins use max 5 plus
               kind "currency": capped, but still shown on the left.

   ACTIONS: every button the player can repeat.
     QUICK ADD: { id: "chopWood", name: "Chop Wood", gains: { wood: 1 } },
      - id / name: (name defaults to id)
      - costs / gains: (optional, default {}) maps like { stamina: 1 }.
        Unknown resource ids warn in the Work Log but still run.
      - tickSeconds: (optional, default 1) seconds per cycle.
      - group: (optional, default "Tasks") section name, shared with
        UPGRADES: same name = same section, actions first.
      - description: (optional) auto-written from costs/gains when omitted.
      - unlock: (optional) hide until earned, e.g. { resource: "coin",
        amount: 5 }. Stays visible forever once reached (saved). Same
        shape works on upgrades.
      - unlockLog: (optional) Work Log message when this unlock first
        triggers, e.g. "You found the old axe!". Defaults to
        "Unlocked Action: <name>".
      - runtext / startLog / stopLog / fullLog / flavor: (optional)
        runtext defaults to "<name>..."; logs default sensibly.
        startLog/stopLog/fullLog also accept an array of variants -
        one is picked at random each time, e.g.
        startLog: ["You help someone.", "You help someone else."]
      - xp: (optional, default {}) skill XP granted per completed cycle,
        e.g. xp: { basicKnowledge: 1 }. Unknown skill ids warn and skip.
        Shown in the tooltip under "Skill XP". XP for a skill locked
        behind an unattained unlock milestone is skipped, and its row
        hides from the tooltip until unlocked (see SKILLS).
      - tags: (optional) identifying chips under the tooltip header,
        e.g. tags: ["Work", "Charismatic"]. Check from code with
        hasTag(item, "Work") or itemsWithTag("Work").
      - improvements: (optional) level-ups earned by repetition, e.g.
        improvements: { every: 20, maxLevel: 5, bonus: { coin: 0.1 },
        improvementLog: "They're warming up to you." }. Every `every`
        completions raises the level (cap `maxLevel`, default Infinity);
        each level adds `bonus` to every cycle's payout. `xpBonus` is the
       same idea for skill XP: { basicKnowledge: 0.1 } = +0.1 more of
       that skill's XP per cycle per level. The tooltip shows
        "[Lvl. N] <name>" plus progress to the next level, and each
        level-up logs improvementLog (or an auto message) in green.
      - header: (optional) file this group under a titled header
        section, e.g. header: "Upgrades". Same header = same
        section; groups for groups.
    ============================================================ */

const RESOURCES = [
  { id: "stamina", name: "Stamina", start: 10, max: 10, group: "Body", barColor: "#FFFCAD", tooltip: "Physical capacity for labor. Restored by simply resting.", tags: ["Body", "Basic Need"]},
  { id: "coin",    name: "Coin",    start: 0,  max: 5, kind: "currency", group: "Basic", nameColor: "#B87333", plural: "Coins", tooltip: "Copper-forged coins, standard-issue currency in many parts of the world.", tags: ["Currency"] },
  { id: "scroll",  name: "Scroll",  start: 0,  max: 4, kind: "currency", group: "Knowledge", nameColor: "#f6eee3", plural: "Scrolls", tooltip: "Perhaps the simplest form of stored knowledge.", tags: ["Currency", "Knowledge", "Written"] },
  { id: "research", name: "Research", start: 0, max: 10, kind: "currency", group: "Basic", nameColor: "#BDFFFB", tooltip: "Research into the nature of many things of this world.", tags: ["Currency", "Knowledge"] },
];

// PLAYER_STATS: the six character stats shown on the Player tab.
// They start at `start` (default 1) and do nothing yet - future systems
// will read them. Each entry supports:
//   - id:    short code (no spaces, e.g. "str")
//   - name:  full label (defaults to id)
//   - abbr:  short label shown in the row (the full name only appears in the tooltip; defaults to first 3 letters, uppercased)
//   - start: (optional, default 1) starting value
//   - tooltip: (optional) hover text, same tooltip style as everywhere else
//   - tags: (optional) chips under the tooltip header, e.g. tags: ["Stat"]
const PLAYER_STATS = [
  { id: "str", name: "Strength",     abbr: "STR", start: 1, nameColor: "#FFA696", tooltip: "Physical strength.", tags: ["Stat"] },
  { id: "dex", name: "Dexterity",    abbr: "DEX", start: 1, nameColor: "#FFFFA6", tooltip: "Nerve control and sleight of hand. ", tags: ["Stat"] },
  { id: "con", name: "Constitution", abbr: "CON", start: 1, nameColor: "#D4D4D4", tooltip: "Physical endurance, ability to withstand pain.", tags: ["Stat"] },
  { id: "int", name: "Intelligence", abbr: "INT", start: 1, nameColor: "#C2FFF9", tooltip: "General knowledge, whether of combat and magical spells, or other things.", tags: ["Stat"] },
  { id: "lck", name: "Luck",         abbr: "LCK", start: 1, nameColor: "#DBFFA6", tooltip: "Aptitude for the universe to do nice things to you.", tags: ["Stat"] },
  { id: "spd", name: "Speed",        abbr: "SPD", start: 1, nameColor: "#A6E6FF", tooltip: "Physical agility.", tags: ["Stat"] },
];

// HOMES: places to live, shown in the Home tab (hidden until any home is
// owned). Each home gives Floor Space for furniture; some also carry
// passive boosts (effects apply while it is the current home).
//   - id / name: (name defaults to id)
//   - space: (required) Floor Space for furniture, positive integer
//   - tooltip: (optional) hover text, same tooltip style as everywhere else
//   - tags: (optional) chips under the tooltip header, e.g. tags: ["Home"]
//   - unlockHint: (optional, currently unused) kept for future use,
//                 e.g. how to get it. Defaults to "You don't own this home yet."
//   - effects: (optional, default []) passive boosts while current:
//              { type: "max", resource, amount } = +amount to that cap,
//              { type: "gain", action, resource, amount } = +amount of that
//              resource every cycle of that action.
//   - replaces: (optional) home id (or array) this home overrides when
//              granted: the listed homes are removed and this one becomes
//              current instantly. Unowned replaced homes hide from the list.
// Homes are granted by upgrade effects ({ type: "home", home }) - see Tent.
const HOMES = [
  { id: "tent", name: "Small Tent", space: 3, tooltip: "A small, simplistic tent. Not quite good, but at least better than lying on the dirty ground outside.", tags: ["Home", "Shelter", "Outdoors"], unlockHint: "Buy the Small Tent upgrade in the Shop.", effects: [] },
  { id: "mediumTent", name: "Medium Tent", space: 5, tooltip: "A bigger tent with a bit more room to breathe in. Replaces the Small Tent.", tags: ["Home", "Shelter", "Outdoors"], unlockHint: "Buy the Medium Tent upgrade in the Shop.", replaces: "tent", effects: [] },
  { id: "survivalistTent", name: "Survivalist's Tent", space: 8, tooltip: "A rugged, quite serious tent. Replaces lesser tents.", tags: ["Home", "Shelter", "Outdoors"], unlockHint: "Buy the Survivalist's Tent upgrade in the Shop.", replaces: ["tent", "mediumTent"], effects: [] },
];

// FURNITURE: upgrade-like items bought for the current home, sold back for
// a full refund. Same fields as upgrades (id/name/cost/maxPurchases/
// description/buyLog/tags/effects), plus:
//   - space: (optional, default 1) Floor Space taken, in 0.5 steps
//            (e.g. 0.5, 1, 1.5). Total used space may never exceed the
//            current home's space.
//   - requiresHome: (optional) home id (or array of ids) that must be
//            owned for this to appear. An array keeps entries visible across
//            a home replacement (e.g. ["tent", "mediumTent"]).
//   - sellLog: (optional) Work Log message when selling one, e.g.
//            "You break apart a coin pile.". Defaults to "Sold: <name>".
//   - flavor: (optional) italic line at the bottom of the tooltip.
// Selling refunds the full cost, capped at each resource's cap - excess
// over the cap is destroyed (the sell tooltip warns when that would happen).
// "gain" effects add to an action's payout: { type: "gain", action: "rest",
// resource: "stamina", amount: 0.25 }. "time" effects make an action faster:
// { type: "time", action: "rest", amount: 0.1 } = 0.1s less per cycle.
const FURNITURE = [
  {
    id: "coinPiles",
    name: "Coin Piles",
    space: 1,
    cost: { coin: 5 },
    maxPurchases: 2,
    requiresHome: ["tent", "mediumTent", "survivalistTent"],
    tags: ["Storage", "Furniture"],
    description: "Haphazardly store coins by leaving them on the ground.",
    buyLog: "You throw some coins onto the ground.",
    sellLog: "You gather some coins off the ground.",
    effects: [
      { type: "max", resource: "coin", amount: 5 },
    ],
  },
  {
    id: "blankets",
    name: "Blankets",
    space: 1,
    cost: { coin: 10 },
    maxPurchases: 1,
    requiresHome: ["tent", "mediumTent", "survivalistTent"],
    tags: ["Recovery", "Furniture"],
    description: "Some simple blankets to keep the cold off.",
    buyLog: "You buy some blankets from the store.",
    sellLog: "You fold up your blankets and sell them off.",
    effects: [
      { type: "gain", action: "rest", resource: "stamina", amount: 0.25 },
    ],
  },
  {
    id: "pillows",
    name: "Pillows",
    space: 0.5,
    cost: { coin: 20 },
    maxPurchases: 2,
    requiresHome: ["mediumTent", "survivalistTent"],
    tags: ["Recovery", "Furniture"],
    description: "Some slightly overpriced yet comfortable pillows.",
    buyLog: "You buy some pillows from the store.",
    sellLog: "You sell some pillows.",
    effects: [
      { type: "time", action: "rest", amount: 0.1 },
    ],
  },
];

// MILESTONES: one-time log messages fired by circumstances, not by buying
// something directly. Each entry checks its `requires` once per frame and
// fires the first time ALL of them hold - then never again (the fired flag
// is saved). Every requires-key is optional; amounts are minimums:
//   - requires: { furniture: { blankets: 1, pillows: 1 } } = own at least
//            1 Blanket AND 1 Pillow at the same time.
//   - upgrades: { pockets: 1 } = own that many of an upgrade.
//   - resources: { coin: 20 } = hold at least that much right now.
//   - actions: { oddJobs: 50 } = completed that action that many times.
//   - id: short code (no spaces); text: the message, shown once.
//   - category: (optional) log category for filters, default "milestone"
//            (pale yellow, always visible). "start"/"stop"/"upgrade"/
//            "unlock"/"improvement" file it under that filter checkbox
//            instead; "system" shows plain with no special color.
const MILESTONES = [
  {
    id: "makeshiftBed",
    requires: { furniture: { blankets: 1, pillows: 1 } },
    text: "With some blankets and pillows, you now have yourself a makeshift bed. There's no frame, so it's closer to a sleeping mat, but a few moments ago you were shivering out on the streets.",
  },
  {
    id: "heavyBritches",
    requires: { upgrades: { pockets: 4 } },
    text: "You can carry so many coins in your britches, they feel like they're slightly weighing you down.",
  },
];

const ACTIONS = [
  {
    id: "oddJobs",
    name: "Odd Jobs",
    header: "Tasks",
    group: "Chores",
    tags: ["Chore", "Friendly"],
    tickSeconds: 1,
    costs: { stamina: 1 },
    gains: { coin: 0.5 },
    xp: { oddJobsMastery: 0.25 },
    description: "Help some people out and get some meagre pay.",
    startLog: ["You start to help someone get their cat out of a tree.", "You start helping an old man sweep his porch.", "You start helping someone move some storage boxes.", "You start helping a shopkeep restock their goods.", "You start helping someone deliver an envelope."],
    stopLog: "You stop helping.",
    fullLog: "You eventually find yourself exhausted.",
    runtext: "Helping...",
    improvements: {
      every: 20,
      maxLevel: 5,
      bonus: { coin: 0.1 },
      improvementLog: "[Odd Jobs Improved!] The folk around the town start warming up to you, just a little bit more.",
    },
  },
  {
    id: "rest",
    name: "Rest",
    header: "Tasks",
    group: "Recovery",
    tags: ["Recovery"],
    tickSeconds: 1.5,
    costs: {},
    gains: { stamina: 1 },
    xp: { sleeping: 0.1 },
    description: "Relax for a moment to catch your breath.",
    startLog: "You lie down.",
    stopLog: "You get up.",
    fullLog: "You feel rested.",
    runtext: "Resting...",
  },
  {
    id: "buyScrolls",
    name: "Buy Scrolls",
    header: "Shop",
    group: "Resources",
    tags: ["Shopping", "Knowledge"],
    tickSeconds: 1,
    costs: { coin: 10 },
    gains: { scroll: 1 },
    description: "Purchase some simple scrolls of basic know-how from the general store.",
    startLog: "You start buying some scrolls from a shop.",
    stopLog: "You step away from buying scrolls.",
    fullLog: "You don't have enough money to buy any more scrolls.",
    runtext: "Buying scrolls...",
    unlock: { resource: "coin", amount: 25 },
    unlockLog: "Since you've never been to school, you reckon it might be a good idea to start learning things.",
  },
  {
    id: "researchScrolls",
    name: "Research Scrolls",
    header: "Tasks",
    group: "Research",
    tags: ["Knowledge", "Research"],
    tickSeconds: 7.5,
    costs: { stamina: 5, scroll: 1 },
    gains: { research: 1 },
    xp: { basicKnowledge: 1 },
    description: "Look through your scrolls in an attempt to expand your general knowledge of things.",
    startLog: "You fetch a scroll, unroll it, and begin reading.",
    stopLog: "You pause researching scrolls.",
    fullLog: "You finish up studying your scrolls, for now.",
    runtext: "Reading scrolls...",
    flavor: "Scrolling through scrolls...",
    unlock: { resource: "scroll", amount: 1 },
    unlockLog: "Now that you have bought your first scroll, you may begin expanding your understanding.",
    improvements: {
      every: 10,
      maxLevel: 10,
      bonus: { research: 0.1 },
      xpBonus: { basicKnowledge: 0.1 },
      improvementLog: "[Research Scrolls Improved!] You have improved at looking through your scrolls.",
    },
  },

  // QUICK ADD - minimal action (gains only, 1s, auto description):
  // { id: "beg", name: "Beg", gains: { coin: 1 } },

  // EXAMPLE - to add a new action, uncomment this block:
  // {
  //   id: "chopWood",
  //   name: "Chop Wood",
  //   group: "Fieldwork",
  //   tickSeconds: 3,
  //   costs: { stamina: 2 },
  //   gains: { wood: 1 },
  //   description: "Spend 2 Stamina to get 1 Wood.",
  //   runtext: "Chopping...",
  //   flavor: "Smells like pine.",
  //   fullLog: "Your pack is full of wood.",
  // },
];

// QUICK ADD - currencies need only id + name; vitals just add max:
//   { id: "wood", name: "Wood" },
//   { id: "health", name: "Health", max: 10, start: 10 },
// EXAMPLE - to add a new resource (e.g. Wood), add one line above:
//   { id: "wood", name: "Wood", start: 0, max: Infinity },

/* ------------------------------------------------------------
   UPGRADES - one-time or repeatable purchases shown under Actions.
   QUICK ADD: { id: "bigPack", name: "Big Pack",
                cost: { coin: 50 },
                effects: [{ type: "max", resource: "stamina", amount: 2 }] },
     - id / name: (name defaults to id)
     - cost: (optional, default {}) paid on EVERY purchase, flat.
       For timed upgrades (buildTime) the cost is paid up front when
       the build starts; pausing and resuming is free, and the next
       purchase (if any) pays again on completion.
     - effects: (optional, default []) e.g.
                { type: "max", resource: "stamina", amount: 1 }
                = +1 to that maximum per purchase,
                { type: "home", home: "tent" } = grant that home,
                { type: "furnitureCap", furniture: "coinPiles", amount: 1 }
                = +1 to that furniture's purchase cap,
                { type: "time", action: "rest", amount: 0.1 }
                = 0.1s less per cycle of that action.
                Bad entries are skipped with a warning in the Work Log.
                Effects share one { type, ... } shape everywhere (upgrades,
                homes, furniture, skill milestones): skill-only types are
                listed under SKILLS, and all types are validated by one
                registry (EFFECT_DEFS in core.js).
     - maxPurchases: (optional, default 1) Infinity = no limit. Fully-bought upgrades hide automatically; the player can re-show them with Options > Show maxed-out Work upgrades.
     - buildTime: (optional) seconds to finish the purchase, working
       exactly like action completion time: costs are paid when the
       build starts, clicking the upgrade pauses it, and resuming a
       paid build is free. One build runs at a time; each completion
       grants one purchase (then stops, even if repeatable).
     - group: (optional, default "Tasks") section name, shared with
       ACTIONS: same name = same section, actions first. "Shop" is not
       special: use any name ("Shop", "Gear", or an action group like
       "Work") to choose where it is sold.
     - description: (optional) auto-written from cost/effects.
     - unlock: (optional) hide until earned, e.g. { resource: "coin",
       amount: 5 }. Stays visible forever once reached (saved). Same
       shape works on actions. To gate on a home instead, use
       { home: "tent" } = visible once that home is owned.
      - unlockLog: (optional) Work Log message when this unlock first
        triggers. Defaults to "Unlocked Upgrade: <name>".
     - buyLog / flavor: (optional) buyLog defaults to "Bought: <name>"
       plus the owned count, e.g. "(1/5)".
      - tags: (optional) identifying chips under the tooltip header,
        e.g. tags: ["Upgrade", "Clothing Augment"]. Check from code
        with hasTag(item, "Upgrade") or itemsWithTag("Upgrade").
      - header: (optional) file this group under a titled header
        section, e.g. header: "Upgrades". Same header = same
        section; groups for groups.
    ------------------------------------------------------------ */

const UPGRADES = [
  {
    id: "tent",
    name: "Small Tent",
    group: "Housing",
    header: "Shop",
    tags: ["Shopping", "Housing"],
    description: "Buy a small tent. It's more intended for storage rather than for someone to live in, but...",
    cost: { coin: 10 },
    maxPurchases: 1,
    buyLog: "You purchase a basic tent kit and get to work setting it up. It only takes thirty minutes, and it's up!",
    unlock: { resource: "coin", amount: 10 },
    unlockLog: "You've saved up enough money to buy a tiny tent. You need something over your head immediately, even if it's just flimsy fabric, so this looks like a wortwhile investment.",
    effects: [
      { type: "home", home: "tent" },
    ],
  },
  {
    id: "mediumTent",
    name: "Medium Tent",
    group: "Housing",
    header: "Shop",
    tags: ["Shopping", "Housing"],
    description: "A slightly larger tent. Only a marginal upgrade, but you'll take anything.",
    cost: { coin: 20 },
    maxPurchases: 1,
    buyLog: "You take down your smaller tent, set up the new one, and move all of your belongings to it.",
    unlock: { resource: "coin", amount: 20 },
    unlockLog: "It should be easy to upgrade your little tent by now. A slightly larger tent is quite cheap.",
    effects: [
      { type: "home", home: "mediumTent" },
      { type: "furnitureCap", furniture: "coinPiles", amount: 1 },
    ],
  },
  {
    id: "survivalistTent",
    name: "Survivalist's Tent",
    group: "Housing",
    header: "Shop",
    tags: ["Shopping", "Housing"],
    description: "A larger tent made for survival out in the wilderness.",
    cost: { coin: 40 },
    maxPurchases: 1,
    buyLog: "You again tear down your old tent, raise the sturdy new one, and move all of your belongings into it.",
    unlock: { resource: "coin", amount: 40 },
    unlockLog: "You've saved up enough money for a real-deal tent.",
    effects: [
      { type: "home", home: "survivalistTent" },
      { type: "furnitureCap", furniture: "pillows", amount: 2 },
    ],
  },
  {
    id: "exploreTown",
    name: "Explore Town",
    group: "Town",
    header: "Shop",
    tags: ["Shopping", "Exploration"],
    cost: { research: 10 },
    maxPurchases: 1,
    buildTime: 30,
    flavor: "Venture out and map the town, street by street.",
    buyLog: "You've explored the town!",
    unlock: { home: "survivalistTent" },
    unlockLog: "With a sturdy tent as your base, you could really go explore the town.",
    effects: [],
  },
  {
    id: "pockets",
    name: "Pockets",
    group: "Storage",
    header: "Upgrades",
    tags: ["Shopping", "Storage", "Clothing Augment"],
    description: "Buy some new trousers with better pockets.",
    cost: { coin: 5 },
    maxPurchases: 1,
    buyLog: "You buy some pants with larger pockets.",
    unlock: { resource: "coin", amount: 5 },
    effects: [
      { type: "max", resource: "coin", amount: 5 },
    ],
  },
  {
    id: "scrollPouches",
    name: "Scroll Pouches",
    group: "Storage",
    header: "Upgrades",
    tags: ["Shopping", "Storage", "Clothing Augment"],
    description: "Neat little pouches appropiately shaped for carrying scrolls.",
    cost: { coin: 10, research: 5 },
    maxPurchases: 4,
    buyLog: "You buy a pouch to store more scrolls.",
    unlock: { resource: "scroll", amount: 4 },
    unlockLog: "Perhaps you should invest in additional scroll storage.",
    effects: [
      { type: "max", resource: "scroll", amount: 1 },
    ],
  },

  // QUICK ADD - minimal upgrade (buys once, auto description):
  // { id: "snack", name: "Snack", cost: { coin: 5 },
  //   effects: [{ type: "max", resource: "stamina", amount: 1 }] },

  // EXAMPLE - to add a new upgrade, uncomment this block:
  // {
  //   id: "bigPack",
  //   name: "Big Pack",
  //   group: "Shop",
  //   description: "A sturdy pack. +2 maximum Stamina per purchase.",
  //   cost: { coin: 50 },
  //   maxPurchases: 3,
  //   effects: [
  //     { type: "max", resource: "stamina", amount: 2 },
  //   ],
  // },
];

// SKILLS: leveled abilities fed by action XP (see action `xp`).
// The Skills tab unlocks once any skill reaches Level 1.
//   - id / name: (name defaults to id)
//   - maxLevel: (required) level cap, positive integer.
//   - baseXp: (optional, default 3) XP needed to go Level 1 -> 2.
//   - scaling: (optional, default 1.5) growth per level after that (>= 1).
//   XP curve (effortlessly retuned via baseXp/scaling): Level 0 -> 1 always
//   costs exactly 1 XP; Level 1 -> 2 costs baseXp; every level after
//   multiplies by scaling again (e.g. base 5, scaling 1.5: 7.5 to reach
//   Level 3, 11.25 for Level 4, 16.875 for Level 5, ...).
//   - description: (optional) tooltip text.
//   - flavor: (optional) italic line at the bottom of the tooltip, exactly
//     like actions (skills without one show no flavor line).
//   - tags: (optional) tooltip chips, e.g. tags: ["Skill"].
//   - group: (optional, default "General") collapsible section name -
//     works exactly like currency/action groups: same name = same
//     section, in first-use order. Empty sections auto-collapse.
//   - header: (optional) file this group under a titled header
//     section. Same header = same section; groups for groups.
//   - milestones: (optional, default []) level-gated boosts, each:
//       { level: <skill level>, name: "<custom name>", text: "<shown in
//         list + balloon>", effects: [...] }. Only attained milestones plus
//       the NEXT one show; attained ones render green. `name` is optional:
//       the header auto-prepends the level, so name "Scroll Frugality" at
//       level 2 renders as "[Lvl. 2] Scroll Frugality" (without one it
//       reads "[Lvl. N] Milestone"). Effects apply while attained:
//         { type: "stat", stat: "int", amount: 0.1 } = +0.1 to that Main
//         Stat; add perLevel: true to multiply by the skill's level.
//         { type: "cost", action: "buyScrolls", resource: "coin",
//           amount: 2.5 } = that action costs 2.5 less of that resource per
//         cycle (floored at zero, stacking across milestones).
//         { type: "gain", action: "rest", resource: "stamina",
//           amount: 0.05, perLevel: true } = that action pays out extra of
//         that resource per cycle (times the skill's level with perLevel).
//         { type: "improvementCap", action: "oddJobs", amount: 5 } = that
//         action can earn 5 more Improvement levels past its base max;
//         the new levels must be earned with further completions, never
//         granted retroactively.
//         { type: "upgradeCap", upgrade: "pockets", amount: 3 } =
//         that upgrade can be bought 3 more times past its base
//         maxPurchases.
//         { type: "skill", skill: "sleeping" } = unlocks that skill:
//         locked skills earn no XP, hide from tooltips, and stay out of
//         the Skills tab (below Level 1) until unlocked.
//         All effect types are validated by one registry (EFFECT_DEFS in
//         core.js) - see its header to add a type.
// Reaching a level logs "[Skill Level Up] Attained Level N in <name>." (green);
// attaining a milestone fires a balloon notification with its text.
const SKILLS = [
  {
    id: "basicKnowledge",
    name: "Basic Knowledge",
    group: "Understanding",
    maxLevel: 10,
    baseXp: 3,
    scaling: 1.5,
    tags: ["Skill", "Knowledge"],
    description: "Fundamental understanding of just what exactly your existence is.",
    milestones: [
      {
        level: 1,
        name: "Grasp Understanding",
        text: "Add +0.1 to INT per level of Basic Knowledge.",
        effects: [
          { type: "stat", stat: "int", amount: 0.1, perLevel: true },
        ],
      },
      {
        level: 2,
        name: "Scroll Frugality",
        text: "Scrolls cost 2.5 less Coins each.",
        effects: [
          { type: "cost", action: "buyScrolls", resource: "coin", amount: 2.5 },
        ],
      },
      {
        level: 3,
        name: "Basic Task Skills",
        text: "Unlock two new skills based on Odd Jobs and Rest.",
        effects: [
          { type: "skill", skill: "oddJobsMastery" },
          { type: "skill", skill: "sleeping" },
        ],
      },
      {
        level: 4,
        name: "Grasp the World",
        text: "Your understanding of the world begins to deepen. Research Scrolls now only takes 2.5 Stamina, and unlock a new house.",
        effects: [
          { type: "cost", action: "researchScrolls", resource: "stamina", amount: 2.5 },
        ],
      },
    ],
  },
  {
    id: "oddJobsMastery",
    name: "Odd Jobs Mastery",
    group: "Labor Skills",
    maxLevel: 10,
    baseXp: 5,
    scaling: 1.75,
    tags: ["Skill", "Work"],
    description: "Get better and better at helping random folks.",
    milestones: [
      {
        level: 1,
        name: "Seasoned Helper",
        text: "Odd Jobs' Improvement cap increased by 5. (Doesn't apply retroactively.)",
        effects: [
          { type: "improvementCap", action: "oddJobs", amount: 5 },
        ],
      },
      {
        level: 2,
        name: "Easier Odd Jobs",
        text: "Performing Odd Jobs costs 0.15 less Stamina.",
        effects: [
          { type: "cost", action: "oddJobs", resource: "stamina", amount: 0.15 },
        ],
      },
      {
        level: 3,
        name: "Pocket Organizing",
        text: "Pockets can be bought 3 more times.",
        effects: [
          { type: "upgradeCap", upgrade: "pockets", amount: 3 },
        ],
      },
      {
        level: 4,
        name: "Dexterous Odd Jobs",
        text: "Add +0.1 to DEX per level of Odd Jobs Mastery.",
        effects: [
          { type: "stat", stat: "dex", amount: 0.1, perLevel: true },
        ],
      },
    ],
  },
  {
    id: "sleeping",
    name: "Sleeping",
    group: "Physical",
    maxLevel: 10,
    baseXp: 2,
    scaling: 2,
    tags: ["Skill", "Recovery"],
    description: "Unconscious ability for better sleep.",
    milestones: [
      {
        level: 1,
        name: "Calm Rest",
        text: "Rest restores +0.05 more Stamina per Sleeping level.",
        effects: [
          { type: "gain", action: "rest", resource: "stamina", amount: 0.05, perLevel: true },
        ],
      },
    ],
  },
];

