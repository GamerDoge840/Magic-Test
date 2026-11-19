// Labor Game config: SKILLS - leveled abilities fed by action XP. Edit freely; the engine reads this list.
// See also: config/vitalsConfig.js, config/itemsConfig.js, config/actionsConfig.js, config/upgradesConfig.js, config/furnitureConfig.js, config/skillsConfig.js, config/worldConfig.js.

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
//         cycle (floored at zero, stacking across milestones). Use skill:
//         "foraging" instead of (or with) action to discount every action
//         granting that skill's XP.
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
//         { type: "furnitureCap", furniture: "blankets", amount: 1 } =
//         that furniture can be bought 1 more time past its base
//         maxPurchases.
//         { type: "travelTime", amount: 1 } = World tiles take 1s less
//         to enter (floored at 0s, stacking - a 0s tile teleports
//         instantly but still charges one second of terrain drain);
//         add perLevel: true to
//         multiply by the skill's level, and biome: "plains" to limit it
//         to one biome's tiles. Plains Navigation uses both.
//         { type: "terrainDifficulty", amount: 0.2 } = 0.2 less Stamina
//         drained per second while traveling (floored at 0, stacking);
//         perLevel and biome work the same way.
//         Skill effects with perLevel: true accept an optional cap (a
//         skill level number): scaling counts at most that many levels,
//         e.g. { ..., perLevel: true, cap: 5 } stops growing past Level 5.
//         { type: "skill", skill: "sleeping" } = unlocks that skill:
//         locked skills earn no XP, hide from tooltips, and stay out of
//         the Skills tab (below Level 1) until unlocked.
//         { type: "xpMult", skill: "plainsNavigation", amount: 2 } =
//         all XP for that skill is doubled (multipliers compound).
//         { type: "time", action: "explorePlains", amount: 0.1,
//         perLevel: true } = that action takes 0.1s less per skill level.
//         All effect types are validated by one registry (EFFECT_DEFS in
//         core.js) - see its header to add a type.
// Reaching a level logs "[Skill Level Up] Attained Level N in <name>." (green);
// attaining a milestone fires a balloon notification with its text.
const SKILLS = [
  {
    id: "basicKnowledge",
    name: "Basic Knowledge",
    group: "Understanding",
    maxLevel: 5,
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
        text: "Your understanding of the world begins to deepen. Research Scrolls now only takes 2.5 Stamina, and unlock a new house for 40 Coins.",
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
        name: "Decent Helper",
        text: "Odd Jobs' Improvement cap increased by 5. (Doesn't apply retroactively.)",
        effects: [
          { type: "improvementCap", action: "oddJobs", amount: 5 },
        ],
      },
      {
        level: 2,
        name: "Easier Odd Jobs",
        text: "Performing Odd Jobs costs 0.10 less Stamina.",
        effects: [
          { type: "cost", action: "oddJobs", resource: "stamina", amount: 0.10 },
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
      {
        level: 5,
        name: "Easier Odd Jobs II",
        text: "Performing Odd Jobs costs an additional 0.10 less Stamina.",
        effects: [
          { type: "cost", action: "oddJobs", resource: "stamina", amount: 0.10 },
        ],
      },
    ],
  },
  {
    id: "sleeping",
    name: "Resting",
    group: "Physical",
    maxLevel: 10,
    baseXp: 2,
    scaling: 2,
    tags: ["Skill", "Recovery"],
    description: "How well you can relax.",
    milestones: [
      {
        level: 1,
        name: "Calm Rest",
        text: "Rest restores +0.03 more Stamina per Resting level, up to Level 5.",
        effects: [
          { type: "gain", action: "rest", resource: "stamina", amount: 0.03, perLevel: true, cap: 5 },
        ],
      },
      {
        level: 6,
        name: "Another Blanket",
        text: "You can buy 1 more Blanket.",
        effects: [
          { type: "furnitureCap", furniture: "blankets", amount: 1 },
        ],
      },
    ],
  },
  {
    id: "plainsNavigation",
    name: "Plains Navigation",
    group: "Exploration",
    maxLevel: 15,
    baseXp: 2,
    scaling: 1.45,
    tags: ["Skill", "Exploration"],
    description: "Familiarity with wandering through the grass.",
    milestones: [
      {
        level: 1,
        name: "Plain Sense",
        text: "Plains take 0.05s less to travel through per level of Plains Navigation.",
        effects: [
          { type: "travelTime", biome: "plains", amount: 0.05, perLevel: true },
        ],
      },
      {
        level: 3,
        name: "Plains Investigation",
        text: "Explore Plains takes 0.1s less per level of Plains Navigation.",
        effects: [
          { type: "time", action: "explorePlains", amount: 0.1, perLevel: true },
        ],
      },
      {
        level: 4,
        name: "Plain Sense II",
        text: "Double all Plains Navigation XP gain from all sources, and boost all Forest Navigation XP by 1.25x.",
        effects: [
          { type: "xpMult", skill: "plainsNavigation", amount: 2 },
          { type: "xpMult", skill: "forestNavigation", amount: 1.25 },
        ],
      },
    ],
  },
  {
    id: "forestNavigation",
    name: "Forest Navigation",
    group: "Exploration",
    maxLevel: 15,
    baseXp: 2,
    scaling: 1.45,
    tags: ["Skill", "Exploration"],
    description: "Familiarity with navigating through trees.",
    milestones: [
      {
        level: 1,
        name: "Forest Sense",
        text: "Forests take 0.05s less to travel through per level of Forest Navigation.",
        effects: [
          { type: "travelTime", biome: "forest", amount: 0.05, perLevel: true },
        ],
      },
      {
        level: 2,
        name: "Forest Investigation",
        text: "Explore Forest takes 0.125s less per level of Forest Navigation.",
        effects: [
          { type: "time", action: "exploreForest", amount: 0.125, perLevel: true },
        ],
      },
      {
        level: 4,
        name: "Forest Sense II",
        text: "Double all Forest Navigation XP gain and boost all Plains Navigation XP by 1.25x.",
        effects: [
          { type: "xpMult", skill: "forestNavigation", amount: 2 },
          { type: "xpMult", skill: "plainsNavigation", amount: 1.25 },
        ],
      },
    ],
  },
  {
    id: "foraging",
    name: "Foraging",
    group: "Gathering",
    maxLevel: 10,
    baseXp: 2,
    scaling: 1.5,
    tags: ["Skill", "Gathering"],
    description: "Ability to spot usable forage.",
    milestones: [
      {
        level: 1,
        name: "Quicker Foraging",
        text: "Foraging takes 0.05s less per level of Foraging.",
        effects: [
          { type: "time", action: "forage", amount: 0.05, perLevel: true },
        ],
      },
      {
        level: 3,
        name: "Easier Foraging",
        text: "All foraging actions take 0.25 less Stamina.",
        effects: [
          { type: "cost", skill: "foraging", resource: "stamina", amount: 0.25 },
        ],
      },
    ],
  },
  {
    id: "cooking",
    name: "Cooking",
    group: "Crafting",
    maxLevel: 10,
    baseXp: 2,
    scaling: 1.5,
    tags: ["Skill", "Crafting"],
    description: "Mastery of the culinary arts.",
    milestones: [
      {
        level: 1,
        name: "Steady Cooking",
        text: "Gain 1 Cooking Speed per level of Cooking.",
        effects: [
          { type: "stat", stat: "cookingSpeed", amount: 1, perLevel: true },
        ],
      },
    ],
  },
];
