// WOWID3 Progression System - Create Automation Tiers
// 7-tier system from Hand Crank (8 SU) to Ultimate Automation (8192 SU)
// Each tier increases yield multiplier and processing speed

ServerEvents.recipes(event => {
  // ============================================================================
  // TIER 1: Hand Crank (8 SU) - 1x yield, baseline speed (600 ticks = 30 sec)
  // ============================================================================
  event.recipes.createCrushing([
    'minecraft:raw_iron'
  ], 'minecraft:iron_ore')
    .processingTime(600)
    .id('wowid3:crushing/iron_ore_tier1')

  event.recipes.createCrushing([
    'minecraft:raw_copper'
  ], 'minecraft:copper_ore')
    .processingTime(600)
    .id('wowid3:crushing/copper_ore_tier1')

  event.recipes.createCrushing([
    'minecraft:raw_gold'
  ], 'minecraft:gold_ore')
    .processingTime(600)
    .id('wowid3:crushing/gold_ore_tier1')

  event.recipes.createCrushing([
    'create:raw_zinc'
  ], 'create:zinc_ore')
    .processingTime(600)
    .id('wowid3:crushing/zinc_ore_tier1')

  // ============================================================================
  // TIER 2: Water Wheel (32/128 SU) - 2x ore doubling, faster (480 ticks = 24 sec)
  // ============================================================================
  event.recipes.createCrushing([
    '2x minecraft:raw_iron',
    Item.of('create:experience_nugget').withChance(0.75)
  ], 'minecraft:iron_ore')
    .processingTime(480)
    .id('wowid3:crushing/iron_ore_tier2')

  event.recipes.createCrushing([
    '2x minecraft:raw_copper',
    Item.of('create:experience_nugget').withChance(0.75)
  ], 'minecraft:copper_ore')
    .processingTime(480)
    .id('wowid3:crushing/copper_ore_tier2')

  event.recipes.createCrushing([
    '2x minecraft:raw_gold',
    Item.of('create:experience_nugget').withChance(0.75)
  ], 'minecraft:gold_ore')
    .processingTime(480)
    .id('wowid3:crushing/gold_ore_tier2')

  event.recipes.createCrushing([
    '2x create:raw_zinc',
    Item.of('create:experience_nugget').withChance(0.75)
  ], 'create:zinc_ore')
    .processingTime(480)
    .id('wowid3:crushing/zinc_ore_tier2')

  // ============================================================================
  // TIER 3: Windmill (256/512 SU) - 2x yield, faster (360 ticks = 18 sec)
  // ============================================================================
  event.recipes.createCrushing([
    '2x minecraft:raw_iron',
    Item.of('create:experience_nugget').withChance(1.0),
    Item.of('create:crushed_iron').withChance(0.12)
  ], 'minecraft:iron_ore')
    .processingTime(360)
    .id('wowid3:crushing/iron_ore_tier3')

  event.recipes.createCrushing([
    '2x minecraft:raw_copper',
    Item.of('create:experience_nugget').withChance(1.0),
    Item.of('create:crushed_copper').withChance(0.12)
  ], 'minecraft:copper_ore')
    .processingTime(360)
    .id('wowid3:crushing/copper_ore_tier3')

  event.recipes.createCrushing([
    '2x minecraft:raw_gold',
    Item.of('create:experience_nugget').withChance(1.0),
    Item.of('create:crushed_gold').withChance(0.12)
  ], 'minecraft:gold_ore')
    .processingTime(360)
    .id('wowid3:crushing/gold_ore_tier3')

  event.recipes.createCrushing([
    '2x create:raw_zinc',
    Item.of('create:experience_nugget').withChance(1.0),
    Item.of('create:crushed_zinc').withChance(0.12)
  ], 'create:zinc_ore')
    .processingTime(360)
    .id('wowid3:crushing/zinc_ore_tier3')

  // ============================================================================
  // TIER 4: Steam Engine (1024 SU) - 3x convergence bonus (300 ticks = 15 sec)
  // ============================================================================
  event.recipes.createCrushing([
    '3x minecraft:raw_iron',
    '2x create:experience_nugget',
    Item.of('create:crushed_iron').withChance(0.5)
  ], 'minecraft:iron_ore')
    .processingTime(300)
    .id('wowid3:crushing/iron_ore_tier4')

  event.recipes.createCrushing([
    '3x minecraft:raw_copper',
    '2x create:experience_nugget',
    Item.of('create:crushed_copper').withChance(0.5)
  ], 'minecraft:copper_ore')
    .processingTime(300)
    .id('wowid3:crushing/copper_ore_tier4')

  event.recipes.createCrushing([
    '3x minecraft:raw_gold',
    '2x create:experience_nugget',
    Item.of('create:crushed_gold').withChance(0.5)
  ], 'minecraft:gold_ore')
    .processingTime(300)
    .id('wowid3:crushing/gold_ore_tier4')

  event.recipes.createCrushing([
    '3x create:raw_zinc',
    '2x create:experience_nugget',
    Item.of('create:crushed_zinc').withChance(0.5)
  ], 'create:zinc_ore')
    .processingTime(300)
    .id('wowid3:crushing/zinc_ore_tier4')

  // ============================================================================
  // TIER 5: Alternator (2048 SU) - 4x bulk processing (240 ticks = 12 sec)
  // ============================================================================
  event.recipes.createCrushing([
    '4x minecraft:raw_iron',
    '2x create:experience_nugget',
    Item.of('create:crushed_iron').withChance(0.75)
  ], 'minecraft:iron_ore')
    .processingTime(240)
    .id('wowid3:crushing/iron_ore_tier5')

  event.recipes.createCrushing([
    '4x minecraft:raw_copper',
    '2x create:experience_nugget',
    Item.of('create:crushed_copper').withChance(0.75)
  ], 'minecraft:copper_ore')
    .processingTime(240)
    .id('wowid3:crushing/copper_ore_tier5')

  event.recipes.createCrushing([
    '4x minecraft:raw_gold',
    '2x create:experience_nugget',
    Item.of('create:crushed_gold').withChance(0.75)
  ], 'minecraft:gold_ore')
    .processingTime(240)
    .id('wowid3:crushing/gold_ore_tier5')

  event.recipes.createCrushing([
    '4x create:raw_zinc',
    '2x create:experience_nugget',
    Item.of('create:crushed_zinc').withChance(0.75)
  ], 'create:zinc_ore')
    .processingTime(240)
    .id('wowid3:crushing/zinc_ore_tier5')

  // ============================================================================
  // TIER 6: Advanced Power (4096 SU) - 5x yield (180 ticks = 9 sec)
  // ============================================================================
  event.recipes.createCrushing([
    '5x minecraft:raw_iron',
    '3x create:experience_nugget',
    Item.of('create:crushed_iron').withChance(1.0)
  ], 'minecraft:iron_ore')
    .processingTime(180)
    .id('wowid3:crushing/iron_ore_tier6')

  event.recipes.createCrushing([
    '5x minecraft:raw_copper',
    '3x create:experience_nugget',
    Item.of('create:crushed_copper').withChance(1.0)
  ], 'minecraft:copper_ore')
    .processingTime(180)
    .id('wowid3:crushing/copper_ore_tier6')

  event.recipes.createCrushing([
    '5x minecraft:raw_gold',
    '3x create:experience_nugget',
    Item.of('create:crushed_gold').withChance(1.0)
  ], 'minecraft:gold_ore')
    .processingTime(180)
    .id('wowid3:crushing/gold_ore_tier6')

  event.recipes.createCrushing([
    '5x create:raw_zinc',
    '3x create:experience_nugget',
    Item.of('create:crushed_zinc').withChance(1.0)
  ], 'create:zinc_ore')
    .processingTime(180)
    .id('wowid3:crushing/zinc_ore_tier6')

  // ============================================================================
  // TIER 7: Ultimate Automation (8192 SU) - 6x yield (120 ticks = 6 sec)
  // ============================================================================
  event.recipes.createCrushing([
    '6x minecraft:raw_iron',
    '4x create:experience_nugget',
    Item.of('create:crushed_iron').withChance(1.0),
    Item.of('minecraft:iron_nugget').withChance(0.5)
  ], 'minecraft:iron_ore')
    .processingTime(120)
    .id('wowid3:crushing/iron_ore_tier7')

  event.recipes.createCrushing([
    '6x minecraft:raw_copper',
    '4x create:experience_nugget',
    Item.of('create:crushed_copper').withChance(1.0),
    Item.of('minecraft:copper_ingot').withChance(0.25)
  ], 'minecraft:copper_ore')
    .processingTime(120)
    .id('wowid3:crushing/copper_ore_tier7')

  event.recipes.createCrushing([
    '6x minecraft:raw_gold',
    '4x create:experience_nugget',
    Item.of('create:crushed_gold').withChance(1.0),
    Item.of('minecraft:gold_nugget').withChance(0.5)
  ], 'minecraft:gold_ore')
    .processingTime(120)
    .id('wowid3:crushing/gold_ore_tier7')

  event.recipes.createCrushing([
    '6x create:raw_zinc',
    '4x create:experience_nugget',
    Item.of('create:crushed_zinc').withChance(1.0),
    Item.of('create:zinc_nugget').withChance(0.5)
  ], 'create:zinc_ore')
    .processingTime(120)
    .id('wowid3:crushing/zinc_ore_tier7')

  console.info('[WOWID3] Create automation tiers 1-7 loaded successfully')
})
