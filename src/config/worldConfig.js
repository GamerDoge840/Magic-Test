// Labor Game config: WORLD_TIERS, WORLD_BIOMES, WORLD_MODIFIERS, WORLD_SITES, WORLD_ACTIONS & FORAGE_TABLES. Edit freely; the engine reads these lists.
// See also: config/vitalsConfig.js, config/itemsConfig.js, config/actionsConfig.js, config/upgradesConfig.js, config/furnitureConfig.js, config/skillsConfig.js, config/worldConfig.js.

// WORLD: the tile map the player walks around (World tab).
// Bones of the feature: one small area, one biome, one town.
//   WORLD_TIERS: one entry per selectable "World Tier" (the tab's dropdown
//     lists these; each tier remembers its own last tile, so leaving and
//     coming back puts the player where they stood - but every tier
//     currently generates the same land, so the dropdown does nothing yet).
//     Note: tiers won't change biome locations - in the future, tiers will
//     change Gathering pools (what Forage can find) instead.
//     - id:   short code (no spaces, e.g. "tier0")
//     - name: label in the dropdown (e.g. "World Tier 0")
//     - size: tiles per side, positive integer (6 = a 6x6 area)
//     - biome: default WORLD_BIOMES id filling every tile
//     - start: { x, y } tile the player begins on (0-based, top-left origin)
//   WORLD_BIOMES: land types. Every tile is one biome, like resources.
//     - id / name: (name defaults to id)
//     - travelTime: (optional, default 5) seconds to move onto the tile
//     - terrainDifficulty: (optional, default 1) Stamina drained per second
//       while traveling onto the tile. Both read through
//       getEffectiveTravelTime / getEffectiveTerrainDifficulty, so the
//       "travelTime" / "terrainDifficulty" upgrade effects modify them.
//     - color: (optional) tile background, e.g. "#8fd694" light green
//     - description: (optional) shown in the tile info window
//     - tags: (optional) chips, e.g. tags: ["Plains"]
//     - entryXp: (optional) footfall lessons for walking the land, e.g.
//       entryXp: { skill: "plainsNavigation", amount: 0.1 } grants 0.1 XP
//       of that skill on every arrival (multipliers apply, like every
//       other source). Biomes without one teach nothing underfoot.
//   WORLD_MODIFIERS: overlays placed on tiles (see WORLD_SITES). They add
//     tags and can shift stats, e.g. Hamlet adds "General Store".
//     - id / name: (name defaults to id)
//     - short: (optional) up to 4 characters painted on the tile, e.g. "ST"
//     - tags: (optional) extra tile tags while the modifier sits there
//     - travelTime / terrainDifficulty: (optional, default 0) flat additions
//       to the biome's values for that tile (may be negative)
//     - color: (optional) tile background, e.g. "#84240c" brown - wins
//       over the biome's color. Dark colors get light text automatically.
//     - size: (optional, default 1) fraction of the tile's width/height
//       the modifier color covers, centered (0.75 = a 75%-wide inset
//       with the biome's color showing as a rim around it). 1 (or
//       missing) obscures the tile entirely, as before.
//     - locks: (optional) action ids banned on this tile, e.g.
//       locks: ["forage", "explorePlains", "exploreForest"] - those actions can't start
//       or run while standing here (walk to another tile). Paid-cycle
//       resume still finishes anywhere, like tile requirements.
//     - description: (optional) shown in the tile info window
//   WORLD_SITES: where modifiers sit: { tier, x, y, modifier } - an
//     entry can also override the tile's biome instead (or as well):
//     { tier, x, y, biome }. The Hamlet sits in the center of the Tier
//     0 plains; a 2x2 forest patch grows in the far northwest corner
//     (5 Manhattan tiles northwest of the Hamlet); a single Cabbage
//     Fields tile sits just west of the Hamlet.
//   WORLD_ACTIONS: action ids mirrored into the World Actions window
//     (Rest for mid-travel recovery, Explore Plains for plains XP,
//     Explore Forest for forest XP, Forage for gathering plants and
//     fruit). Explore Plains, Explore Forest, and Forage are locked on
//     the Hamlet tile itself, so they run on the surrounding land -
//     Rest works everywhere.
//     These stay usable from the Work tab too. Mirror tooltips detach
//     above the narrow strip at full size: they may overlap the Tile
//     panel, but never anything above it.
// Tile requirements: actions, upgrades, and furniture list world tile
// tags they need with `requiresTile` (a tag or an array - ANY match
// satisfies, matched case-insensitively), e.g.
// requiresTile: "General Store". While unmet the item can't start/buy,
// a running gated action stops at its next unpaid cycle, and its tooltip
// shows a "Requires" section (hidden again once satisfied). The legacy
// "shopping" tag still implies ["General Store"], so existing "Shopping"
// tags keep working. Before the World unlocks (implicitly in town)
// everything runs/buys as normal. Tile modifiers can also ban actions
// outright with `locks` (nothing on the banned tile runs them while the
// ban stands).
// Tile-scoped travel effects: "travelTime" / "terrainDifficulty" effects
// accept an optional biome ("plains", ...) limiting them to that biome's
// tiles - Plains Navigation speeds up plains only, leaving future biomes
// untouched.
const WORLD_TIERS = [
  { id: "tier0", name: "World Tier 0", size: 12, biome: "plains", start: { x: 3, y: 3 } },
];

const WORLD_BIOMES = [
  { id: "plains", name: "Plains", travelTime: 5, terrainDifficulty: 0.5, color: "#8CD65A", description: "A stretch of land comprised of grass and not much else.", tags: ["Plains"], entryXp: { skill: "plainsNavigation", amount: 0.1 } },
  { id: "forest", name: "Forest", travelTime: 6.5, terrainDifficulty: 1, color: "#4A8F42", description: "Woodlands home to many creatures and plants.", tags: ["Forest"], entryXp: { skill: "forestNavigation", amount: 0.1 } },
];

const WORLD_MODIFIERS = [
  { id: "hamlet", name: "Hamlet", short: "H", tags: ["General Store", "Village"], color: "#84240c", size: 0.75, travelTime: -3, terrainDifficulty: -1, locks: ["forage", "explorePlains", "exploreForest"], description: "A hamlet with a store to purchase goods from." },
  { id: "cabbageFields", name: "Cabbage Fields", short: "CF", tags: ["Cabbage Fields"], color: "#B5E89B", size: 0.5, description: "A field full of wild cabbages." },
];

const WORLD_SITES = [
  { tier: "tier0", x: 3, y: 3, modifier: "hamlet" },
  { tier: "tier0", x: 6, y: 0, modifier: "cabbageFields" },
  { tier: "tier0", x: 0, y: 0, biome: "forest" },
  { tier: "tier0", x: 1, y: 0, biome: "forest" },
  { tier: "tier0", x: 0, y: 1, biome: "forest" },
  { tier: "tier0", x: 1, y: 1, biome: "forest" },
];

const WORLD_ACTIONS = ["rest", "explorePlains", "exploreForest", "forage", "chopTrees"];

// FORAGE_TABLES: what the Forage action can find, per World Tier and tile.
// Each entry picks its loot list by tier plus EITHER a biome id or a tile
// tag (matched case-insensitively, first match in list order wins):
//   { tier: "tier0", biome: "plains", items: [{ item: "greenleaf", weight: 60 },
// //   { item: "apples", weight: 40 }] }
// One unit of one rolled item lands per completed cycle (weights are
// relative - 60/40 = 60% Greenleaf). Tiles with no matching entry yield
// nothing. Item ids must exist in ITEMS (validated with a warning).
const FORAGE_TABLES = [
  { tier: "tier0", tag: "Cabbage Fields", items: [{ item: "cabbage", weight: 80 }, { item: "greenleaf", weight: 20 }] },
  { tier: "tier0", biome: "plains", items: [{ item: "greenleaf", weight: 60 }, { item: "apples", weight: 40 }] },
  { tier: "tier0", biome: "forest", items: [{ item: "twigs", weight: 50 }, { item: "woodBerries", weight: 35 }, { item: "apples", weight: 10 }, { item: "greenleaf", weight: 5 }] },
];
