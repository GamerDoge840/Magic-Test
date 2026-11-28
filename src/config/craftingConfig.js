// Labor Game config: CRAFTING - crafting groups, plans and recipes. Edit freely; the engine reads this list.
// See also: config/vitalsConfig.js, config/itemsConfig.js, config/actionsConfig.js, config/upgradesConfig.js, config/furnitureConfig.js, config/skillsConfig.js, config/worldConfig.js.

// CRAFTING: timed background crafting (no Stamina cost - a plan keeps
// working while you do other things). Each group is one subtab of the
// Crafting tab (permanently visible once any furniture tagged "Crafting"
// is bought), with its own station requirement, skill and Speed stat:
//   - id / name: (name defaults to id)
//   - stationTag: (required) furniture tag that must be owned for this
//            group's plans to run, e.g. "Cooking Station". Without one,
//            the subtab reads noStationMsg.
//   - noStationMsg: (optional) shown when no station furniture is owned.
//   - skill: (optional) skill id earning XP per finished craft.
//   - speedStat: (optional) player stat id; each point makes every plan
//            of this group take 0.01s less (floored, see craftEffTime).
//   - plans: (required) at least one plan, each:
//       - id / name
//       - description: (optional) shown in the plan's tooltip.
//       - starter: (optional) auto-unlocked by buying the group's first
//                station furniture (e.g. the Cooking Pot unlocks Roasting).
//                Plans without it unlock by event (e.g. Make Salad unlocks
//                on holding Cabbage with Cooking Level 1 - see the
//                renderCrafting catch-up, deliberately outside milestones).
//       - slots: (optional) fixed Item Slot count for the plan; defaults
//                to one slot per recipe input (the most-input recipe sets
//                it), raised when larger (never shrunk below the recipes).
//       - time: (optional, default 5) base seconds per craft. A
//                recipe's own `time` (below) overrides this for that
//                recipe alone.
//       - fuelPerSec: (optional, default 0.25) fuel value drained per
//                base-time second (so a 5s plan burns 1.25 fuel value per
//                craft, however fast it runs). 0 means the plan needs
//                no fuel: no Fuel Slot is shown and it runs on
//                ingredients alone.
//       - xp: (optional, default {}) skill XP per finished craft, e.g.
//         xp: { cooking: 0.5 }.
//       - recipes: (required) at least one recipe, each:
//           - id / name: (name defaults to id; shown once discovered)
//           - time: (optional) seconds per craft for this recipe alone
//                (defaults to the plan time above), e.g. a bigger burn
//                that takes 7s on a 6s plan. Per-craft fuel follows the
//                recipe time (fuelPerSec x recipe seconds), and the
//                recipe tooltip shows the affected time.
//           - inputs: (required) one or more entries, e.g. { apples: 1 }.
//                A key "tag:Fruit" accepts any item carrying that tag
//                (matched case-insensitively), so one recipe covers every
//                present and future fruit; the plan's slots, matches,
//                autofill, costs and logs all resolve the actual item.
//                The plan runs one Item Slot per recipe input (the
//                most-input recipe sets the slot count, or `slots`
//                above); finishing a recipe at least once discovers it.
//           - outputs: (required) items granted per craft, e.g.
//             { cookedApple: 1 }.
//           - completeLog: (optional) log line per finished craft.
//                Defaults to "You roast <input>. (+<outputs>)".
//           - progressText: (optional) custom green-bar text while this
//                recipe runs, e.g. "Roasting {input}...". {input} is the
//                first input's display name (a "tag:" input resolves to
//                the loaded item), {output} the first output's. The live
//                countdown ("3.98s left") is appended automatically;
//                without it the bar shows "<Recipe name>… <time> left".
const CRAFTING = [
  {
    id: "cooking",
    name: "Cooking",
    stationTag: "Cooking Station",
    noStationMsg: "You need a Cooking Station to cook.",
    skill: "cooking",
    speedStat: "cookingSpeed",
    plans: [
      {
        id: "roasting",
        name: "Roasting",
        description: "Simply cook food over a fire.",
        starter: true,
        time: 5,
        fuelPerSec: 0.25,
        xp: { cooking: 0.5 },
        recipes: [
          {
            id: "roastApple",
            name: "Roast Apple",
            inputs: { apples: 1 },
            outputs: { cookedApple: 1 },
            progressText: "Roasting {input}...",
          },
          {
            id: "roastWoodBerry",
            name: "Roast Wood Berries",
            inputs: { woodBerries: 1 },
            outputs: { cookedWoodBerry: 1 },
            progressText: "Roasting {input}...",
          },
          {
            id: "roastCabbage",
            name: "Roast Cabbage",
            inputs: { cabbage: 1 },
            outputs: { boiledCabbage: 1 },
            progressText: "Roasting {input}...",
          },
        ],
      },
      {
        id: "makeSalad",
        name: "Make Salad",
        description: "Make salads.",
        unlock: { seen: "cabbage", skill: "cooking", skillLevel: 1 },
        time: 4,
        fuelPerSec: 0,
        slots: 3,
        xp: { cooking: 0.65 },
        recipes: [
          {
            id: "plainSalad",
            name: "Plain Salad",
            inputs: { cabbage: 2 },
            outputs: { plainSalad: 1 },
            progressText: "Making a salad...",
          },
          {
            id: "fruitSalad",
            name: "Fruit Salad",
            inputs: { cabbage: 1, "tag:fruit": 1 },
            outputs: { fruitSalad: 1 },
            progressText: "Making a salad...",
          },
        ],
      },
    ],
  },
  {
    id: "woodworking",
    name: "Woodworking",
    stationTag: "Woodworking Station",
    noStationMsg: "You need a Woodworking Station to woodwork.",
    skill: "woodworking",
    speedStat: "woodworkingSpeed",
    plans: [
      {
        id: "cutPlanks",
        name: "Cut Planks",
        description: "Saw logs into planks.",
        starter: true,
        time: 8,
        fuelPerSec: 0,
        xp: { woodworking: 0.5 },
        recipes: [
          {
            id: "cutPlanks",
            name: "Cut Oak Planks",
            inputs: { oakLog: 1 },
            outputs: { oakPlank: 2 },
            progressText: "Cutting {input} planks...",
          },
        ],
      },
      {
        id: "makeCharcoal",
        name: "Make Charcoal",
        description: "Smelt wood into charcoal.",
        starter: true,
        time: 6,
        fuelPerSec: 0.125,
        xp: { woodworking: 0.6 },
        recipes: [
          {
            id: "charTwigs",
            name: "Charcoal from Twigs",
            time: 6,
            inputs: { twigs: 2 },
            outputs: { charcoal: 1 },
            progressText: "Burning wood into charcoal...",
          },
          {
            id: "charPlank",
            name: "Charcoal from Planks",
            time: 7,
            inputs: { "tag:plank": 2 },
            outputs: { charcoal: 1 },
            progressText: "Burning wood into charcoal...",
          },
        ],
      },
    ],
  },
];
