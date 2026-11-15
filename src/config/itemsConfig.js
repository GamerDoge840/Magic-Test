// Labor Game config: inventory items. Edit freely; the engine reads this list.
// See also: config/vitalsConfig.js, config/itemsConfig.js, config/actionsConfig.js, config/upgradesConfig.js, config/furnitureConfig.js, config/skillsConfig.js, config/worldConfig.js.

// ITEMS: non-currency holdings shown in the Inventory tab (unlocked
// alongside the World tab), never in the Currencies/Vitals panels.
// Same id/name/description/tags shape as resources, plus:
//   - rarity: (optional, default "common") one of junk, common,
//     uncommon, rare, exotic, legendary. Paints the item's name
//     everywhere (inventory grid, gather log lines, tooltips).
//   - plural: (optional) plural at != 1, e.g. Apples.
//   - tags: (optional) identifying chips, e.g. ["Herb", "Food"].
//     The "consumable" tag makes the item edible from the Inventory
//     tab (see `consume` below).
//   - consume: (optional, needs the "consumable" tag) what eating one
//     unit grants, e.g. consume: { button: "Eat", gains: { stamina: 1 } }.
//     `button` (optional, default "Consume") is the button's text;
//     `gains` (optional, default {}) pays Vitals and/or Currencies
//     through the normal capped grants; `log` (optional) overrides the
//     base consume line (default "You consume <name>."). The gains always
//     follow it as "(+N Name, ...)", each in its target's own color
//     (Stamina's pale yellow for "+1 Stamina").
//   - sellPrice: (optional) what Selling Mode pays per unit sold, e.g.
//     sellPrice: { coin: 1 }. Same amount rules as costs (non-negative
//     finite numbers, zeros dropped, unknown ids warn). An item without
//     any surviving priced entry can't be sold. Proceeds pay through the
//     normal capped grants (excess over a cap is destroyed; the item's
//     tooltip warns when the current sell amount would overflow), so
//     over-cap sales still clear inventory.
//   - fuel: (optional) fuel value for future fire/camp systems, e.g.
//     fuel: 1. Shown in the tooltip's Fuel section; spent by nothing yet.
// Items never cap (Infinity) and never show bars. Actions, upgrades,
// and furniture can demand them in costs/gains maps by id, exactly
// like currencies (e.g. costs: { greenleaf: 2 }).
const ITEMS = [
  {
    id: "greenleaf",
    name: "Greenleaf",
    plural: "Greenleaves",
    rarity: "common",
    tags: ["Herb", "Foraged"],
    description: "A herb known for its very vibrant green leaves. Used in low-level alchemy.",
    sellPrice: { coin: 1 },
  },
  {
    id: "apples",
    name: "Apple",
    plural: "Apples",
    rarity: "common",
    tags: ["Food", "Foraged", "consumable"],
    description: "Common red fruit.",
    consume: { button: "Eat", gains: { stamina: 1 }, log: "You eat an apple." },
    sellPrice: { coin: 1 },
  },
  {
    id: "twigs",
    name: "Twig",
    plural: "Twigs",
    rarity: "common",
    tags: ["Foraged", "Materials", "Fuel"],
    description: "A stick picked up off the ground. Could be used for a fire, in a pinch.",
    fuel: 1,
  },
  {
    id: "woodBerries",
    name: "Wood Berry",
    plural: "Wood Berries",
    rarity: "common",
    tags: ["Food", "Foraged", "consumable"],
    description: "Common berries from the woods. Has a bit of a crunchy texture.",
    consume: { button: "Eat", gains: { stamina: 1.25 }, log: "You eat some wood berries." },
    sellPrice: { coin: 1 },
  },
];
