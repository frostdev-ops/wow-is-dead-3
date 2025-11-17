// WOWID3 Progression System - Client-side Tooltips

ItemEvents.tooltip(event => {
  // Create Machine Tier Indicators
  event.add('create:hand_crank', [
    '§b[Tier 1 Power Source]',
    '§78 Stress Units - Manual rotation',
    '§fYield: 1x | Speed: 600 ticks (30 sec)'
  ])

  event.add('create:water_wheel', [
    '§a[Tier 2 Power Source]',
    '§732 SU (underwater) / 128 SU (flowing)',
    '§fYield: 2x | Speed: 480 ticks (24 sec)',
    '§7Passive power source - doubles ore production'
  ])

  event.add('create:windmill_bearing', [
    '§3[Tier 3 Power Source]',
    '§7256-512 SU (wind dependent)',
    '§fYield: 2x | Speed: 360 ticks (18 sec)'
  ])

  event.add('create:steam_engine', [
    '§6[Tier 4 Power Source]',
    '§71024 SU - Industrial power',
    '§fYield: 3x | Speed: 300 ticks (15 sec)',
    '§eConvergence bonus unlocked!'
  ])

  event.add('createaddition:alternator', [
    '§5[Tier 5 Power Source]',
    '§72048 SU - Electrical generation',
    '§fYield: 4x | Speed: 240 ticks (12 sec)',
    '§eBulk processing enabled'
  ])

  // Recipe Complexity
  event.add('create:crushing_wheel', [
    '§bOre Processing Tiers',
    '§f━━━━━━━━━━━━━━━━━',
    '§7Tier 1: 1x yield',
    '§2Tier 2: 2x yield',
    '§3Tier 3: 2x yield',
    '§6Tier 4: 3x yield',
    '§5Tier 5: 4x yield'
  ])

  event.add('farmersdelight:cutting_board', [
    '§dCutting Board Progression',
    '§f━━━━━━━━━━━━━━━━━',
    '§7Tier 1: Manual cutting',
    '§2Tier 2: Deployer (2x yield)',
    '§6Tier 3: Automated (3x yield)'
  ])

  // Unlock Tokens
  event.add('wowid3:tier2_unlock_token', [
    '§aSpecial Item: Tier 2 Unlock',
    '§7Awarded when you build water wheel',
    '§fUnlocks: 2x ore doubling recipes'
  ])

  event.add('wowid3:convergence_token', [
    '§dSpecial Item: Convergence Unlock',
    '§7Master both Create and Farming',
    '§fUnlocks: 3x yield recipes'
  ])

  console.info('[WOWID3] Client tooltips loaded successfully')
})
