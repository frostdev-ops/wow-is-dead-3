// ============================================================================
// WOWID3 Progression System - Advancement to Skill XP Integration
// ============================================================================
// This script listens for advancement completions and grants skill XP
// to guide players through the progression system with Pufferfish's Skills
//
// XP is granted in the corresponding skill category for each path:
// - Farming path → Master Chef category XP
// - Industry path → Automation Engineer category XP
// - Explorer path → Explorer category XP
// - Convergence → All relevant categories
// ============================================================================

ServerEvents.advancement((event) => {

  // ============================================================================
  // FARMING PATH ADVANCEMENTS → Master Chef XP
  // ============================================================================

  event.advancement('wowid3:farming_path/01_farming_started', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s master_chef 200`)
      ctx.player.tell('§4§l[Master Chef]§r §7You gained §e200 XP§7 in Master Chef!')
    })
  })

  event.advancement('wowid3:farming_path/02_cutting_board_recipes', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s master_chef 250`)
      ctx.player.tell('§4§l[Master Chef]§r §7You gained §e250 XP§7 in Master Chef!')
    })
  })

  event.advancement('wowid3:farming_path/03_cooking_pot', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s master_chef 300`)
      ctx.player.tell('§4§l[Master Chef]§r §7You gained §e300 XP§7 in Master Chef!')
    })
  })

  event.advancement('wowid3:farming_path/04_rich_soil', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s master_chef 350`)
      ctx.player.tell('§4§l[Master Chef]§r §7You gained §e350 XP§7 in Master Chef!')
    })
  })

  event.advancement('wowid3:farming_path/05_farmer_delight_mastery', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s master_chef 400`)
      ctx.player.tell('§4§l[Master Chef]§r §7You gained §e400 XP§7 in Master Chef!')
    })
  })

  // ============================================================================
  // INDUSTRY PATH ADVANCEMENTS → Automation Engineer XP
  // ============================================================================

  event.advancement('wowid3:industry_path/01_industry_started', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 200`)
      ctx.player.tell('§6§l[Automation Engineer]§r §7You gained §e200 XP§7 in Automation!')
    })
  })

  event.advancement('wowid3:industry_path/02_hand_crank_power', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 250`)
      ctx.player.tell('§6§l[Automation Engineer]§r §7You gained §e250 XP§7 in Automation!')
    })
  })

  event.advancement('wowid3:industry_path/03_water_wheel', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 300`)
      ctx.player.tell('§6§l[Automation Engineer]§r §7You gained §e300 XP§7 in Automation!')
    })
  })

  event.advancement('wowid3:industry_path/04_stress_mastery', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 350`)
      ctx.player.tell('§6§l[Automation Engineer]§r §7You gained §e350 XP§7 in Automation!')
    })
  })

  event.advancement('wowid3:industry_path/05_create_ecosystem_mastery', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 400`)
      ctx.player.tell('§6§l[Automation Engineer]§r §7You gained §e400 XP§7 in Automation!')
    })
  })

  // ============================================================================
  // EXPLORER PATH ADVANCEMENTS → Explorer XP
  // ============================================================================

  event.advancement('wowid3:explorer_path/01_explorer_started', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s explorer 200`)
      ctx.player.tell('§9§l[Explorer]§r §7You gained §e200 XP§7 in Explorer!')
    })
  })

  event.advancement('wowid3:explorer_path/02_biome_explorer', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s explorer 250`)
      ctx.player.tell('§9§l[Explorer]§r §7You gained §e250 XP§7 in Explorer!')
    })
  })

  event.advancement('wowid3:explorer_path/03_lets_do_stations', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s explorer 300`)
      ctx.player.tell('§9§l[Explorer]§r §7You gained §e300 XP§7 in Explorer!')
    })
  })

  event.advancement('wowid3:explorer_path/04_wine_mastery', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s explorer 350`)
      ctx.player.tell('§9§l[Explorer]§r §7You gained §e350 XP§7 in Explorer!')
    })
  })

  event.advancement('wowid3:explorer_path/05_building_blocks_mastery', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s explorer 400`)
      ctx.player.tell('§9§l[Explorer]§r §7You gained §e400 XP§7 in Explorer!')
    })
  })

  // ============================================================================
  // CONVERGENCE ADVANCEMENTS → Bonus XP to all relevant categories
  // ============================================================================

  event.advancement('wowid3:convergence/01_farming_industry', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s master_chef 500`)
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 500`)
      ctx.player.tell('§d§l[Convergence]§r §7You gained §e500 XP§7 in Master Chef and Automation Engineer!')
    })
  })

  event.advancement('wowid3:convergence/02_industry_explorer', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 500`)
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s explorer 500`)
      ctx.player.tell('§d§l[Convergence]§r §7You gained §e500 XP§7 in Automation Engineer and Explorer!')
    })
  })

  event.advancement('wowid3:convergence/03_farming_explorer', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s master_chef 500`)
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s explorer 500`)
      ctx.player.tell('§d§l[Convergence]§r §7You gained §e500 XP§7 in Master Chef and Explorer!')
    })
  })

  event.advancement('wowid3:convergence/04_triple_convergence', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s master_chef 750`)
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 750`)
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s explorer 750`)
      ctx.player.tell('§d§l[Convergence]§r §7You gained §e750 XP§7 in all three specializations!')
    })
  })

  // ============================================================================
  // INTEGRATION ADVANCEMENTS → All categories (bonus progression)
  // ============================================================================

  event.advancement('wowid3:integration/01_steam_power', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 200`)
      ctx.player.tell('§6§l[Integration]§r §7You gained §e200 XP§7 in Automation Engineer!')
    })
  })

  event.advancement('wowid3:integration/02_spell_system', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s explorer 200`)
      ctx.player.tell('§9§l[Integration]§r §7You gained §e200 XP§7 in Explorer!')
    })
  })

  event.advancement('wowid3:integration/03_artifact_crafting', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s master_chef 200`)
      ctx.player.tell('§4§l[Integration]§r §7You gained §e200 XP§7 in Master Chef!')
    })
  })

  event.advancement('wowid3:integration/04_electrical_grid', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 200`)
      ctx.player.tell('§6§l[Integration]§r §7You gained §e200 XP§7 in Automation Engineer!')
    })
  })

  event.advancement('wowid3:integration/05_endgame_mastery', advancement => {
    advancement.onObtain(ctx => {
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s master_chef 300`)
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s automation_engineer 300`)
      ctx.server.runCommandSilent(`execute as ${ctx.player.name} run puffish_skills experience add @s explorer 300`)
      ctx.player.tell('§d§l[Endgame]§r §7You gained §e300 XP§7 in all specializations!')
    })
  })

})

console.info('[WOWID3] Advancement XP rewards loaded successfully')
