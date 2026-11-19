// Labor Game config: vitals, currencies & player stats. Edit freely; the engine reads these lists.
// See also: config/vitalsConfig.js, config/itemsConfig.js, config/actionsConfig.js, config/upgradesConfig.js, config/furnitureConfig.js, config/skillsConfig.js, config/worldConfig.js.

/* ============================================================
   VITALS, CURRENCIES & PLAYER STATS - EDIT EVERYTHING HERE
   ------------------------------------------------------------
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
      - unlock: (optional) gate in the same shape as action unlocks,
        e.g. unlock: { upgrade: "exploreTown" } - the row stays hidden
        in every panel until the gate passes (then sticks, with a log
        line like other unlocks).
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
   ============================================================ */

const RESOURCES = [
  { id: "stamina", name: "Stamina", start: 10, max: 10, group: "Body", barColor: "#FFFCAD", tooltip: "Physical capacity for labor. Restored by simply resting.", tags: ["Body", "Basic Need"]},
  { id: "health", name: "Health", start: 100, max: 100, group: "Body", barColor: "#9C0000", tooltip: "Bodily capability to withstand injury.", tags: ["Body"], unlock: { upgrade: "exploreTown" } },
  { id: "coin",    name: "Coin",    start: 0,  max: 5, kind: "currency", group: "Basic", nameColor: "#B87333", plural: "Coins", tooltip: "Copper-forged coins, standard-issue currency in many parts of the world.", tags: ["Currency"] },
  { id: "scroll",  name: "Scroll",  start: 0,  max: 4, kind: "currency", group: "Knowledge", nameColor: "#f6eee3", plural: "Scrolls", tooltip: "Perhaps the simplest form of stored knowledge.", tags: ["Currency", "Knowledge", "Written"] },
  { id: "research", name: "Research", start: 0, max: 10, kind: "currency", group: "Basic", nameColor: "#BDFFFB", tooltip: "Research into the nature of many things of this world.", tags: ["Currency", "Knowledge"] },
];

// QUICK ADD - currencies need only id + name; vitals just add max:
//   { id: "wood", name: "Wood" },
//   { id: "health", name: "Health", max: 10, start: 10 },
// EXAMPLE - to add a new resource (e.g. Wood), add one line above:
//   { id: "wood", name: "Wood", start: 0, max: Infinity },

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
  { id: "cookingSpeed", name: "Cooking Speed", abbr: "CKS", start: 0, nameColor: "#FFB36B", tooltip: "Speed of cooking.", tags: ["Stat", "Crafting"] },
];
