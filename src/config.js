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
      - tags: (optional) identifying chips under the tooltip header,
        e.g. tags: ["Work", "Charismatic"]. Check from code with
        hasTag(item, "Work") or itemsWithTag("Work").
      - improvements: (optional) level-ups earned by repetition, e.g.
        improvements: { every: 20, maxLevel: 5, bonus: { coin: 0.1 },
        improvementLog: "They're warming up to you." }. Every `every`
        completions raises the level (cap `maxLevel`, default Infinity);
        each level adds `bonus` to every cycle's payout. The tooltip shows
        "[Lvl. N] <name>" plus progress to the next level, and each
        level-up logs improvementLog (or an auto message) in green.
      - header: (optional) file this group under a titled header
        section, e.g. header: "Upgrades". Same header = same
        section; groups for groups.
    ============================================================ */

const RESOURCES = [
  { id: "stamina", name: "Stamina", start: 10, max: 10, group: "Body", barColor: "#FFFCAD", tooltip: "Physical capacity for labor.", tags: ["Body", "Basic Need"]},
  { id: "coin",    name: "Coin",    start: 0,  max: 5, kind: "currency", group: "Basic", nameColor: "#B87333", plural: "Coins", tooltip: "Copper-forged coins, standard-issue currency in many parts of the world.", tags: ["Currency"] },
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
    tickSeconds: 2,
    costs: {},
    gains: { stamina: 1 },
    description: "Rest on the ground.",
    startLog: "You lie down on the ground.",
    stopLog: "You get up.",
    fullLog: "You feel rested.",
    runtext: "Resting...",
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
     - effects: (optional, default []) only supported effect for now:
                { type: "max", resource: "stamina", amount: 1 }
                = +1 to that maximum per purchase. Bad entries are
                skipped with a warning in the Work Log.
     - maxPurchases: (optional, default 1) Infinity = no limit. Fully-bought upgrades hide automatically; the player can re-show them with Options > Show maxed-out Work upgrades.
     - group: (optional, default "Tasks") section name, shared with
       ACTIONS: same name = same section, actions first. "Shop" is not
       special: use any name ("Shop", "Gear", or an action group like
       "Work") to choose where it is sold.
     - description: (optional) auto-written from cost/effects.
     - unlock: (optional) hide until earned, e.g. { resource: "coin",
       amount: 5 }. Stays visible forever once reached (saved). Same
       shape works on actions.
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
    id: "pockets",
    name: "Pockets",
    group: "Storage",
    header: "Upgrades",
    tags: ["Storage Upgrade", "Clothing Augment"],
    description: "Buy some new trousers with better pockets.",
    cost: { coin: 5 },
    maxPurchases: 1,
    buyLog: "You buy some pants with larger pockets.",
    unlock: { resource: "coin", amount: 5 },
    effects: [
      { type: "max", resource: "coin", amount: 5 },
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

