// Labor Game config: UPGRADES - one-time or repeatable purchases shown under Actions. Edit freely; the engine reads this list.
// See also: config/vitalsConfig.js, config/itemsConfig.js, config/actionsConfig.js, config/upgradesConfig.js, config/furnitureConfig.js, config/skillsConfig.js, config/worldConfig.js.

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
                 { type: "travelTime", amount: 1 } = 1s less per World
                 tile traveled to (floored at 0s, stacking - a 0s tile
                 teleports instantly but still charges one second of its
                 terrain drain). Add
                 biome: "plains" to limit it to one biome's tiles. Read
                 through getEffectiveTravelTime so future upgrades just work.
                 { type: "terrainDifficulty", amount: 0.2 } = 0.2 less
                 Stamina drained per second while traveling (floored at 0,
                 same optional biome).
                 Read through getEffectiveTerrainDifficulty.
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
       grants one purchase (then stops, even if repeatable). Builds tick alongside actions - running both at once is intentional.
     - group: (optional, default "Tasks") section name, shared with
       ACTIONS: same name = same section, actions first. "Shop" is not
       special: use any name ("Shop", "Gear", or an action group like
       "Work") to choose where it is sold.
     - description: (optional) auto-written from cost/effects.
     - unlock: (optional) hide until earned. Gates AND-stack without
       limit, e.g. { resources: { coin: 40, research: 10 },
       skills: { basicKnowledge: 4 }, upgrades: { pockets: 5 } }.
       Shorthands: { resource: "coin", amount: 5 } for one currency,
       { home: "tent" } for one home (an array needs EVERY home),
       skill: "basicKnowledge", skillLevel: 4 for one skill level
       (defaults to 1), { upgrade: "pockets", upgradeCount: 5 }
       for one upgrade count (defaults to 1). Same shape works on
       actions. Stays visible forever once reached (saved).
      - unlockLog: (optional) Work Log message when this unlock first
        triggers. Defaults to "Unlocked Upgrade: <name>".
     - buyLog / flavor: (optional) buyLog defaults to "Bought: <name>"
       plus the owned count, e.g. "(1/5)".
     - startLog: (optional, buildTime only) Work Log message when the
       build starts, e.g. startLog: "You set out to explore.". Also
       accepts an array of variants (one picked at random). Fires on
       every start and free resume; instant upgrades ignore it.
      - tags: (optional) identifying chips under the tooltip header,
        e.g. tags: ["Upgrade", "Clothing Augment"]. Check from code
        with hasTag(item, "Upgrade") or itemsWithTag("Upgrade").
      - requiresTile: (optional) world tile tag (or array of tags) this
        upgrade needs, e.g. requiresTile: "General Store". ANY listed tag
        satisfies it (matched case-insensitively). While unmet the upgrade
        can't be bought, its button shows a red "Name*", and its tooltip
        shows a "Requires" section (both hidden again once satisfied). The
        "bought" tag also implies ["General Store"] - see the WORLD section.
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
    tags: ["Bought", "Housing"],
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
    tags: ["Bought", "Housing"],
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
    tags: ["Bought", "Housing"],
    description: "A larger tent made for survival out in the wilderness.",
    cost: { coin: 40 },
    maxPurchases: 1,
    buyLog: "You again tear down your old tent, raise the sturdy new one, and move all of your belongings into it.",
    unlock: { resource: "coin", amount: 40, skill: "basicKnowledge", skillLevel: 4 },
    unlockLog: "You've saved up enough money for a real-deal tent.",
    effects: [
      { type: "home", home: "survivalistTent" },
      { type: "furnitureCap", furniture: "pillows", amount: 2 },
    ],
  },
  {
    id: "exploreTown",
    name: "Explore Outskirts",
    group: "Exploration",
    header: "Upgrades",
    tags: ["Exploration"],
    description: "Venture out and survey the area around the town.",
    cost: { research: 10, stamina: 10 },
    maxPurchases: 1,
    buildTime: 30,
    buyLog: "You finish exploring around the town, and now feel confident to set out on your own.",
    startLog: "You start wandering the wilderness around town.",
    unlock: { home: "survivalistTent" },
    unlockLog: "You suspect opportunities may await in the lands surrounding the town.",
    effects: [],
  },
  {
    id: "pockets",
    name: "Pockets",
    group: "Storage",
    header: "Upgrades",
    tags: ["Bought", "Storage", "Clothing Augment"],
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
    tags: ["Bought", "Storage", "Clothing Augment"],
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
  {
    id: "stoneAxe",
    name: "Stone Axe",
    group: "Tools",
    header: "Upgrades",
    tags: ["Bought", "Tools"],
    description: "Buy a beginner's axe for cutting wood.",
    cost: { coin: 30, research: 3 },
    maxPurchases: 1,
    buyLog: "You buy a sturdy stone axe.",
    unlock: { visitedBiome: "forest" },
    unlockLog: "Maybe if you had an axe, you could cut these trees down.",
    effects: [],
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
