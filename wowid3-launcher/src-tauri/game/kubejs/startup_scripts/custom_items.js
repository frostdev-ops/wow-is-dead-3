// WOWID3 Progression System - Custom Items (Unlock Tokens)
// These items gate access to progressively higher tier recipes

StartupEvents.registry('item', event => {
  // Tier 2 Unlock Token - Gates 2x ore doubling recipes
  event.create('wowid3:tier2_unlock_token')
    .displayName('§2Tier 2 Unlock Token')
    .tooltip('§7Grants access to Water Wheel tier recipes')
    .tooltip('§7  • 2x ore processing')
    .tooltip('§7  • 480 tick (24 second) processing time')
    .maxStackSize(1)
    .rarity('uncommon')

  // Tier 3 Unlock Token - Gates windmill-tier automation
  event.create('wowid3:tier3_unlock_token')
    .displayName('§3Tier 3 Unlock Token')
    .tooltip('§7Grants access to Windmill tier recipes')
    .tooltip('§7  • 2x yield maintained')
    .tooltip('§7  • 360 tick (18 second) processing time')
    .maxStackSize(1)
    .rarity('rare')

  // Tier 4 Unlock Token - Gates steam engine & convergence bonuses
  event.create('wowid3:tier4_unlock_token')
    .displayName('§6Tier 4 Unlock Token')
    .tooltip('§7Grants access to Steam Engine tier recipes')
    .tooltip('§7  • 3x yield convergence bonus')
    .tooltip('§7  • 300 tick (15 second) processing time')
    .maxStackSize(1)
    .rarity('rare')

  // Convergence Token - Unlocks cross-path recipes
  event.create('wowid3:convergence_token')
    .displayName('§dConvergence Token')
    .tooltip('§7Unlocks convergence recipes combining:')
    .tooltip('§7  • Create + Farmer\'s Delight (3x yields)')
    .tooltip('§7  • Create + Biome Materials')
    .tooltip('§7  • Farmer\'s Delight + Let\'s Do stations')
    .maxStackSize(1)
    .rarity('epic')
    .glow(true)

  // Tier 5 Unlock Token - Gates alternator & bulk processing
  event.create('wowid3:tier5_unlock_token')
    .displayName('§5Tier 5 Unlock Token')
    .tooltip('§7Grants access to Alternator tier recipes')
    .tooltip('§7  • 4x bulk processing enabled')
    .tooltip('§7  • 240 tick (12 second) processing time')
    .maxStackSize(1)
    .rarity('epic')
    .glow(true)

  // Exploration Materials used in recipes
  event.create('wowid3:ancient_essence')
    .displayName('§8Ancient Essence')
    .tooltip('§7Found in desert temple structures')
    .tooltip('§7Used in advanced crafting recipes')
    .maxStackSize(64)

  event.create('wowid3:oceanic_crystal')
    .displayName('§bOceanic Crystal')
    .tooltip('§7Harvested from ocean monuments')
    .tooltip('§7Used in marine-themed recipes')
    .maxStackSize(64)
})
