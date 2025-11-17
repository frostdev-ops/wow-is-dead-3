// WOWID3 Progression System - Farmer's Delight Tiered Recipes
// Cutting board yields: 1x baseline → 2x hand cuts → 3x deployed → 4x automated

ServerEvents.recipes(event => {
  // ============================================================================
  // Remove vanilla FD recipes to avoid duplicates
  // ============================================================================
  event.remove({ type: 'farmersdelight:cutting', output: 'farmersdelight:carrot_slices' })
  event.remove({ type: 'farmersdelight:cutting', output: 'farmersdelight:tomato_slices' })
  event.remove({ type: 'farmersdelight:cutting', output: 'farmersdelight:beetroot_slices' })
  event.remove({ type: 'farmersdelight:cutting', output: 'farmersdelight:onion_slices' })
  event.remove({ type: 'farmersdelight:cutting', output: 'farmersdelight:potato_slices' })
  event.remove({ type: 'farmersdelight:cutting', output: 'farmersdelight:chicken_cuts' })
  event.remove({ type: 'farmersdelight:cutting', output: 'farmersdelight:beef_cuts' })
  event.remove({ type: 'farmersdelight:cutting', output: 'farmersdelight:mutton_cuts' })

  // ============================================================================
  // TIER 1: Manual Cutting Board - 1x baseline yields
  // ============================================================================
  event.recipes.farmersdelightCutting('minecraft:carrot', 'forge:tools/knives', 'farmersdelight:carrot_slices', 2)
    .id('wowid3:cutting/carrot_tier1')

  event.recipes.farmersdelightCutting('minecraft:tomato', 'forge:tools/knives', 'farmersdelight:tomato_slices', 2)
    .id('wowid3:cutting/tomato_tier1')

  event.recipes.farmersdelightCutting('minecraft:beetroot', 'forge:tools/knives', 'farmersdelight:beetroot_slices', 2)
    .id('wowid3:cutting/beetroot_tier1')

  event.recipes.farmersdelightCutting('minecraft:onion', 'forge:tools/knives', 'farmersdelight:onion_slices', 2)
    .id('wowid3:cutting/onion_tier1')

  event.recipes.farmersdelightCutting('minecraft:potato', 'forge:tools/knives', 'farmersdelight:potato_slices', 2)
    .id('wowid3:cutting/potato_tier1')

  event.recipes.farmersdelightCutting('minecraft:chicken', 'forge:tools/knives', 'farmersdelight:chicken_cuts', 2)
    .id('wowid3:cutting/chicken_tier1')

  event.recipes.farmersdelightCutting('minecraft:beef', 'forge:tools/knives', 'farmersdelight:beef_cuts', 2)
    .id('wowid3:cutting/beef_tier1')

  event.recipes.farmersdelightCutting('minecraft:mutton', 'forge:tools/knives', 'farmersdelight:mutton_cuts', 2)
    .id('wowid3:cutting/mutton_tier1')

  // ============================================================================
  // TIER 2: Mechanical Cutting (Deployer) - 2x yields
  // ============================================================================
  event.recipes.farmersdelightCutting('minecraft:carrot', 'forge:tools/knives', 'farmersdelight:carrot_slices', 4)
    .id('wowid3:cutting/carrot_tier2')

  event.recipes.farmersdelightCutting('minecraft:tomato', 'forge:tools/knives', 'farmersdelight:tomato_slices', 4)
    .id('wowid3:cutting/tomato_tier2')

  event.recipes.farmersdelightCutting('minecraft:beetroot', 'forge:tools/knives', 'farmersdelight:beetroot_slices', 4)
    .id('wowid3:cutting/beetroot_tier2')

  event.recipes.farmersdelightCutting('minecraft:onion', 'forge:tools/knives', 'farmersdelight:onion_slices', 4)
    .id('wowid3:cutting/onion_tier2')

  event.recipes.farmersdelightCutting('minecraft:potato', 'forge:tools/knives', 'farmersdelight:potato_slices', 4)
    .id('wowid3:cutting/potato_tier2')

  event.recipes.farmersdelightCutting('minecraft:chicken', 'forge:tools/knives', 'farmersdelight:chicken_cuts', 4)
    .id('wowid3:cutting/chicken_tier2')

  event.recipes.farmersdelightCutting('minecraft:beef', 'forge:tools/knives', 'farmersdelight:beef_cuts', 4)
    .id('wowid3:cutting/beef_tier2')

  event.recipes.farmersdelightCutting('minecraft:mutton', 'forge:tools/knives', 'farmersdelight:mutton_cuts', 4)
    .id('wowid3:cutting/mutton_tier2')

  // ============================================================================
  // TIER 3: Automated Farm Integration - 3x yields
  // ============================================================================
  event.recipes.farmersdelightCutting('minecraft:carrot', 'forge:tools/knives', 'farmersdelight:carrot_slices', 6)
    .id('wowid3:cutting/carrot_tier3')

  event.recipes.farmersdelightCutting('minecraft:tomato', 'forge:tools/knives', 'farmersdelight:tomato_slices', 6)
    .id('wowid3:cutting/tomato_tier3')

  event.recipes.farmersdelightCutting('minecraft:beetroot', 'forge:tools/knives', 'farmersdelight:beetroot_slices', 6)
    .id('wowid3:cutting/beetroot_tier3')

  event.recipes.farmersdelightCutting('minecraft:onion', 'forge:tools/knives', 'farmersdelight:onion_slices', 6)
    .id('wowid3:cutting/onion_tier3')

  event.recipes.farmersdelightCutting('minecraft:potato', 'forge:tools/knives', 'farmersdelight:potato_slices', 6)
    .id('wowid3:cutting/potato_tier3')

  event.recipes.farmersdelightCutting('minecraft:chicken', 'forge:tools/knives', 'farmersdelight:chicken_cuts', 6)
    .id('wowid3:cutting/chicken_tier3')

  event.recipes.farmersdelightCutting('minecraft:beef', 'forge:tools/knives', 'farmersdelight:beef_cuts', 6)
    .id('wowid3:cutting/beef_tier3')

  event.recipes.farmersdelightCutting('minecraft:mutton', 'forge:tools/knives', 'farmersdelight:mutton_cuts', 6)
    .id('wowid3:cutting/mutton_tier3')

  console.info('[WOWID3] Farmer\'s Delight tiered cutting recipes loaded successfully')
})
