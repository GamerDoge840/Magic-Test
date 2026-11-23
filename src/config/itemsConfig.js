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
//     tab (see `consume` below). The "Fruit" tag marks fruit for
//     "any fruit" recipe inputs (see "tag:" inputs in craftingConfig).
//   - consume: (optional, needs the "consumable" tag) what eating one
//     unit grants, e.g. consume: { button: "Eat", gains: { stamina: 1 } }.
//     `button` (optional, default "Consume") is the button's text;
//     `gains` (optional, default {}) pays Vitals and/or Currencies
//     through the normal capped grants; `log` (optional) overrides the
//     base consume line (default "You consume <name>."). The gains always
//     follow it as "(+N Name, ...)", each in its target's own color
//     (Stamina's pale yellow for "+1 Stamina").
//   - nutrition: (optional, needs the "consumable" tag) Stamina overheal
//     multiplier for this food's own grants, e.g. nutrition: 1.1. Eating
//     it can push Stamina past its cap, up to cap x nutrition (1.1 = up
//     to 110% of max). While overhealed the Stamina bar grades from its
//     usual color into pale green. Shown in the tooltip's Nutrition
//     section. Must be a finite number above 1; anything else warns and
//     is ignored (never blocks eating).
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
    tags: ["Food", "Foraged", "Fruit", "consumable"],
    description: "Common red fruit.",
    consume: { button: "Eat", gains: { stamina: 1.25 }, log: "You eat an apple." },
    sellPrice: { coin: 1 },
  },
  {
    id: "twigs",
    name: "Twig",
    plural: "Twigs",
    rarity: "common",
    tags: ["Foraged", "Materials", "Fuel"],
    description: "A stick picked up off the ground. Could be used for a fire, in a pinch.",
    fuel: 1.25,
    sellPrice: { coin: 1 },
  },
  {
    id: "woodBerries",
    name: "Wood Berry",
    plural: "Wood Berries",
    rarity: "common",
    tags: ["Food", "Foraged", "consumable"],
    description: "Common berries from the woods. Has a bit of a crunchy texture.",
    consume: { button: "Eat", gains: { stamina: 1 }, log: "You eat some wood berries." },
    sellPrice: { coin: 1 },
  },
  {
    id: "cookedApple",
    name: "Cooked Apple",
    plural: "Cooked Apples",
    rarity: "common",
    tags: ["Food", "Roasted", "consumable"],
    description: "A warm, cooked apple.",
    consume: { button: "Eat", gains: { stamina: 3.75 }, log: "You eat a cooked apple." },
    sellPrice: { coin: 2 },
  },
  {
    id: "cookedWoodBerry",
    name: "Cooked Wood Berry",
    plural: "Cooked Wood Berries",
    rarity: "common",
    tags: ["Food", "Roasted", "consumable"],
    description: "Roasted wood berries. Cooking them made them even crunchier.",
    consume: { button: "Eat", gains: { stamina: 3 }, log: "You eat some cooked wood berries." },
    sellPrice: { coin: 2 },
  },
  {
    id: "cabbage",
    name: "Cabbage",
    plural: "Cabbages",
    rarity: "common",
    tags: ["Food", "Foraged", "consumable"],
    description: "A common leafy vegetable used in cooking.",
    consume: { button: "Eat", gains: { stamina: 1.5 }, log: "You eat a cabbage." },
    sellPrice: { coin: 1 },
  },
  {
    id: "boiledCabbage",
    name: "Boiled Cabbage",
    plural: "Boiled Cabbages",
    rarity: "common",
    tags: ["Food", "Roasted", "consumable"],
    description: "A cabbage that has been boiled.",
    nutrition: 1.08,
    consume: { button: "Eat", gains: { stamina: 3.5 }, log: "You eat a boiled cabbage." },
    sellPrice: { coin: 2 },
  },
  {
    id: "plainSalad",
    name: "Plain Salad",
    plural: "Plain Salads",
    rarity: "common",
    tags: ["Food", "Meal", "consumable"],
    description: "A very simple salad comprised out of leaves. Makes you feel like a herbivore.",
    nutrition: 1.15,
    consume: { button: "Eat", gains: { stamina: 4 }, log: "You eat a plain salad." },
    sellPrice: { coin: 2 },
  },
  {
    id: "fruitSalad",
    name: "Fruit Salad",
    plural: "Fruit Salads",
    rarity: "common",
    tags: ["Food", "Meal", "consumable"],
    description: "A salad comprised of leaves with some slices of fruit placed between.",
    nutrition: 1.20,
    consume: { button: "Eat", gains: { stamina: 5 }, log: "You eat a fruit salad." },
    sellPrice: { coin: 2 },
  },
  {
    id: "oakLog",
    name: "Oak Log",
    plural: "Oak Logs",
    rarity: "common",
    tags: ["Materials", "Wood"],
    description: "Log from an oak tree.",
    sellPrice: { coin: 2 },
  },
  {
    id: "oakPlank",
    name: "Oak Plank",
    plural: "Oak Planks",
    rarity: "common",
    tags: ["Materials", "Wood", "Plank"],
    description: "Wooden plank made out of oak.",
    sellPrice: { coin: 1.5 },
  },
  {
    id: "charcoal",
    name: "Charcoal",
    plural: "Charcoal",
    rarity: "common",
    tags: ["Materials", "Fuel"],
    description: "A clump of fuel made from smelting wood.",
    fuel: 3,
    sellPrice: { coin: 2.5 },
  },
];
