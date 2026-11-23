// Labor Game config: HOMES, FURNITURE & SPECIAL_MESSAGES. Edit freely; the engine reads these lists.
// See also: config/vitalsConfig.js, config/itemsConfig.js, config/actionsConfig.js, config/upgradesConfig.js, config/furnitureConfig.js, config/skillsConfig.js, config/worldConfig.js.

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
//              resource every cycle of that action,
//              { type: "time", action, amount } = that many fewer seconds
//              per cycle of that action,
//              { type: "furnitureCap", furniture, amount } = +amount to that
//              furniture's purchase cap,
//              { type: "travelTime", amount } / { type: "terrainDifficulty",
//              amount } = faster / easier World travel (same as upgrades,
//              including the optional biome limit).
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
// description/buyLog/tags/effects/requiresTile), plus:
//   - space: (optional, default 1) Floor Space taken, in 0.5 steps
//            (e.g. 0.5, 1, 1.5). Total used space may never exceed the
//            current home's space.
//   - requiresHome: (optional) home id (or array of ids) that must be
//            owned for this to appear. An array keeps entries visible across
//            a home replacement (e.g. ["tent", "mediumTent"]).
//   - requiresSeenTag: (optional) item tag (or array of tags) that hides
//            this until any item carrying one of them has been discovered,
//            e.g. requiresSeenTag: "Food". Seen flags are sticky, so the
//            entry never locks again afterwards.
//   - sellLog: (optional) Work Log message when selling one, e.g.
//            "You break apart a coin pile.". Defaults to "Sold: <name>".
//   - unlockLog: (optional) one-time Work Log message the first frame
//            this becomes visible (filed under the unlock filter), e.g.
//            a hint nudging the player to buy it. The fired flag is saved
//            with the other unlocks, so it never repeats.
//   - flavor: (optional) italic line at the bottom of the tooltip.
// While a cost asks for more than its cap holds, the tile requirement
// is unmet, or the house's Floor Space is full, the furniture name shows
// a red "Name*" like actions/upgrades.
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
    tags: ["Shopping", "Recovery", "Furniture"],
    description: "Some simple blankets to keep the cold off.",
    buyLog: "You buy some blankets from the store.",
    sellLog: "You fold up your blankets and sell them off.",
    effects: [
      { type: "gain", action: "rest", resource: "stamina", amount: 0.2 },
    ],
  },
  {
    id: "pillows",
    name: "Pillows",
    space: 0.5,
    cost: { coin: 20 },
    maxPurchases: 2,
    requiresHome: ["mediumTent", "survivalistTent"],
    tags: ["Shopping", "Recovery", "Furniture"],
    description: "Some slightly overpriced yet comfortable pillows.",
    buyLog: "You buy some pillows from the store.",
    sellLog: "You sell some pillows.",
    effects: [
      { type: "time", action: "rest", amount: 0.05 },
    ],
  },
  {
    id: "cookingPot",
    name: "Cooking Pot",
    space: 2,
    cost: { coin: 40 },
    requiresHome: ["tent", "mediumTent", "survivalistTent"],
    requiresSeenTag: "Food",
    tags: ["Cooking Station", "Crafting", "Furniture", "Shopping"],
    description: "A cheap but large pot for cooking food.",
    buyLog: "You set up a cooking pot in your home.",
    sellLog: "You sell your cooking pot.",
    unlockLog: "Maybe if you bought some basic culinary equipment, you could cook the food you found?",
    effects: [],
  },
  {
    id: "woodworkingTable",
    name: "Woodworking Table",
    space: 2,
    cost: { coin: 40 },
    requiresHome: ["tent", "mediumTent", "survivalistTent"],
    requiresSeenTag: "Wood",
    tags: ["Woodworking Station", "Crafting", "Furniture", "Shopping"],
    description: "A small table with a saw, necessary for processing wood.",
    buyLog: "You set up a woodworking table in your home.",
    sellLog: "You sell your woodworking table.",
    unlockLog: "If you had a woodworker's table, you'd be able to cut the log you just chopped.",
    effects: [],
  },
];

// SPECIAL_MESSAGES: one-time log messages fired by circumstances, not by buying
// something directly. Each entry checks its `requires` once per frame and
// fires the first time ALL of them hold - then never again (the fired flag
// is saved). Every requires-key is optional; amounts are minimums:
//   - requires: { furniture: { blankets: 1, pillows: 1 } } = own at least
//            1 Blanket AND 1 Pillow at the same time.
//   - upgrades: { pockets: 1 } = own that many of an upgrade.
//   - resources: { coin: 20 } = hold at least that much right now.
//   - actions: { oddJobs: 50 } = completed that action that many times.
//   - id: short code (no spaces); text: the message, shown once.
//   - category: (optional) log category for filters, default "specialMessage"
//            (pale yellow, always visible). "start"/"stop"/"upgrade"/
//            "unlock"/"improvement" file it under that filter checkbox
//            instead; "system" shows plain with no special color.
const SPECIAL_MESSAGES = [
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
