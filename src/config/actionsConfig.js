// Labor Game config: ACTIONS - every button the player can repeat. Edit freely; the engine reads this list.
// See also: config/vitalsConfig.js, config/itemsConfig.js, config/actionsConfig.js, config/upgradesConfig.js, config/furnitureConfig.js, config/skillsConfig.js, config/worldConfig.js.

/* ============================================================
   ACTIONS - EDIT EVERYTHING HERE
   ------------------------------------------------------------
   Adding more is copy/paste:
     1. Resource? Add one line to RESOURCES (QUICK ADD below).
     2. Action?   Copy the minimal action into ACTIONS.
     3. Upgrade?  Copy the minimal upgrade into UPGRADES.
   Groups auto-create: same group name = same collapsible section,
   in first-use order. Only id + name are ever required; everything
   else has a default and missing descriptions are auto-written.

   ACTIONS: every button the player can repeat.
     QUICK ADD: { id: "chopWood", name: "Chop Wood", gains: { wood: 1 } },
      - id / name: (name defaults to id)
      - costs / gains: (optional, default {}) maps like { stamina: 1 }.
        Unknown resource ids warn in the Work Log but still run.
      - tickSeconds: (optional, default 1) seconds per cycle.
      - group: (optional, default "Tasks") section name, shared with
        UPGRADES: same name = same section, actions first.
      - description: (optional) auto-written from costs/gains when omitted.
      - unlock: (optional) hide until earned. Gates AND-stack without
        limit, e.g. { resources: { coin: 40, research: 10 },
        skills: { basicKnowledge: 4 }, upgrades: { pockets: 5 } }.
        Shorthands: { resource: "coin", amount: 5 } for one currency,
        { home: "tent" } for one home (an array needs EVERY home),
        skill: "basicKnowledge", skillLevel: 4 for one skill level
        (defaults to 1). Same shape works on upgrades. Stays visible
        forever once reached (saved).
      - unlockLog: (optional) Work Log message when this unlock first
        triggers, e.g. "You found the old axe!". Defaults to
        "Unlocked Action: <name>".
      - runtext / startLog / stopLog / fullLog / stopFullLog / flavor:
        (optional) runtext defaults to "<name>..."; logs default sensibly.
        startLog/stopLog/fullLog/stopFullLog also accept an array of
        variants - one is picked at random each time, e.g.
        startLog: ["You help someone.", "You help someone else."]
        stopFullLog replaces fullLog when the action stops BECAUSE of
        the "Stop if Full" option (currency outputs at cap), e.g. Odd
        Jobs' stopFullLog: "You can't store any more coins." Vitals-full
        and out-of-funds stops keep using fullLog.
      - conditionalLogs: (optional) extra start/stop/full/stopFull
        variants that join the random pick only while their requires
        hold, e.g.
        conditionalLogs: [{ start: "You whistle while you work.",
          requires: { skills: { oddJobsMastery: 2 } } },
          { full: "The master is pleased.",
          requires: { upgrades: { pockets: 5 } } }]
        Each entry needs requires plus at least one of start/stop/full/
        stopFull (string or array). requires AND-stacks: skills (level),
        upgrades/resources/actions/furniture (count), homes (array: own
        every listed home). With no requires the text always joins the
        pool (extra weight).
      - heals: (optional, default {}) vital restoration as a share of max,
      //        e.g. heals: { health: 0.02 } = +2% of max Health per cycle.
      //        Only pays while the vital is unlocked; tooltips show it as
      //        "N% of Max" and hide the row until then.
      - xp: (optional, default {}) skill XP granted per completed cycle,
        e.g. xp: { basicKnowledge: 1 }. Unknown skill ids warn and skip.
        Shown in the tooltip under "Skill XP". XP for a skill locked
        behind an unattained unlock milestone is skipped, and its row
        hides from the tooltip until unlocked (see SKILLS).
      - tickByBiome / costsByBiome / xpByBiome: (optional) per-biome
        overrides for the CURRENT tile, e.g. Forage runs 5s cycles on
        forest tiles via tickByBiome: { forest: 5 }. Ticks, costs, and
        XP all resolve against the live tile, so tooltips, checks,
        payments, and grants agree; biomes without an entry use the
        base stats above.
      - tags: (optional) identifying chips under the tooltip header,
        e.g. tags: ["Work", "Charismatic"]. Check from code with
        hasTag(item, "Work") or itemsWithTag("Work").
      - requiresTile: (optional) world tile tag (or array of tags) this
        action needs, e.g. requiresTile: "General Store". ANY listed tag
        satisfies it (matched case-insensitively). While unmet the action
        can't start, its button shows a red "Name*", and its tooltip shows
        a "Requires" section (both hidden again once satisfied). The legacy "shopping" tag still implies
        ["General Store"] - see the WORLD section.
      - hideWhenOffTile: (optional) when true, an unmet requiresTile
        hides the action's Work-tab button outright instead of showing
        it disabled with a red star (the World mirror already hides
        blocked actions). A running action stays visible until it stops.
        Before the World unlocks every requirement counts as met, so the
        action still shows in town. Unlike other gated actions, the tile
        gates hold even for paid progress: a half-finished cycle can't
        be resumed on the wrong tile (it stays hidden, keeping its
        progress and payment until the player walks back).
      - gather: (optional) when true, one FORAGE_TABLES item lands per
        completed cycle on top of the static payout (see FORAGE_TABLES).
        The tooltip lists the current tile's loot odds (unseen items show
        as "???" in their rarity color).
        Finds merge as "• +N Item" bullets into the action's startLog
        line (same item accumulates); empty cycles add nothing.
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
    requiresTile: "Village",
    description: "Help some people out and get some meagre pay.",
    startLog: ["You start to help someone get their cat out of a tree.", "You start helping an old man sweep his porch.", "You start helping someone move some storage boxes.", "You start helping a shopkeep restock their goods.", "You start helping someone deliver an envelope."],
    stopLog: "You stop helping.",
    fullLog: "You eventually find yourself exhausted.",
    stopFullLog: "You can't store any more coins.",
    conditionalLogs: [
      { start: "You start helping a librarian organize their books.", requires: { skills: { basicKnowledge: 1 } } },
    ],
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
    heals: { health: 0.02 },
    xp: { sleeping: 0.1 },
    description: "Relax for a moment to catch your breath.",
    startLog: "You take a breather...",
    stopLog: "You stop resting.",
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
    stopFullLog: "You can't store any more Research.",
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
  {
    id: "explorePlains",
    name: "Explore Plains",
    header: "Tasks",
    group: "Exploration",
    tags: ["Exploration"],
    tickSeconds: 6,
    costs: { stamina: 2.5 },
    xp: { plainsNavigation: 0.5 },
    requiresTile: "Plains",
    hideWhenOffTile: true,
    description: "Wander the open plains to learn how to better navigate them.",
    startLog: "You set out across the open plains.",
    stopLog: "You stop wandering through the plains.",
    fullLog: "You are too exhausted to keep exploring.",
    runtext: "Exploring...",
    unlock: { upgrade: "exploreTown" },
  },
  {
    id: "exploreForest",
    name: "Explore Forest",
    header: "Tasks",
    group: "Exploration",
    tags: ["Exploration"],
    tickSeconds: 6.5,
    costs: { stamina: 3 },
    xp: { forestNavigation: 0.5 },
    requiresTile: "Forest",
    hideWhenOffTile: true,
    description: "Navigate the woods to map them out better.",
    startLog: "You set out into the woods.",
    stopLog: "You stop wandering through the forest.",
    fullLog: "You are too exhausted to keep exploring.",
    runtext: "Exploring...",
    unlock: { upgrade: "exploreTown" },
  },
  {
    id: "forage",
    name: "Forage",
    header: "Tasks",
    group: "Gathering",
    tags: ["Gathering"],
    tickSeconds: 4,
    costs: { stamina: 2 },
    xp: { foraging: 0.25 },
    tickByBiome: { forest: 5 },
    costsByBiome: { forest: { stamina: 2.5 } },
    xpByBiome: { forest: { foraging: 0.35 } },
    // Tag-scoped overrides (matched against the tile's tags, modifier
    // tags included - first config entry whose tag sits on the tile
    // wins, beating biome overrides): the Cabbage Fields work slower
    // and hungrier than open plains.
    tickByTag: { "Cabbage Fields": 8 },
    costsByTag: { "Cabbage Fields": { stamina: 4 } },
    requiresTile: ["Plains", "Forest"],
    description: "Forage in the wilderness for items and usable plants. Different biomes have different items.",
    startLog: "You start looking for stuff to gather off the ground...",
    stopLog: "You stop foraging.",
    fullLog: "You are too exhausted to keep foraging.",
    runtext: "Foraging...",
    flavor: "Nature's bounty...",
    unlock: { upgrade: "exploreTown" },
    gather: true, // roll one FORAGE_TABLES item per completed cycle (see below)
  },
  {
    id: "chopTrees",
    name: "Chop Trees",
    header: "Tasks",
    group: "Gathering",
    tags: ["Gathering"],
    tickSeconds: 12.5,
    costs: { stamina: 5 },
    gains: { oakLog: 1 },
    xp: { treecutting: 1 },
    requiresTile: "Forest",
    hideWhenOffTile: true,
    description: "Fell trees with your axe.",
    startLog: "You start chopping at a tree.",
    stopLog: "You stop chopping at the tree.",
    fullLog: "If you continue cutting trees any more without resting, you might pull a muscle.",
    runtext: "Chopping...",
    unlock: { upgrades: { stoneAxe: 1 } },
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
