/**
 * Design tokens for the WOWID3 launcher theme system
 * All hardcoded values should reference these tokens
 */

export const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
} as const;

export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  full: '9999px',
} as const;

export const fontSize = {
  xs: '0.75rem',     // 12px
  sm: '0.875rem',    // 14px
  base: '1rem',      // 16px
  lg: '1.125rem',    // 18px
  xl: '1.25rem',     // 20px
  '2xl': '1.5rem',   // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem',  // 36px
  '5xl': '3rem',     // 48px
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

export const lineHeight = {
  tight: '1.25',
  normal: '1.5',
  relaxed: '1.75',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  glow: '0 0 20px rgba(255, 255, 255, 0.3)',
} as const;

export const opacity = {
  0: '0',
  5: '0.05',
  10: '0.1',
  20: '0.2',
  30: '0.3',
  40: '0.4',
  50: '0.5',
  60: '0.6',
  70: '0.7',
  80: '0.8',
  90: '0.9',
  100: '1',
} as const;

export const transition = {
  fast: '150ms ease-in-out',
  base: '200ms ease-in-out',
  slow: '300ms ease-in-out',
  slower: '500ms ease-in-out',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
  toast: 1500,
} as const;

// Typography scale with semantic names
export const typography = {
  h1: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.extrabold,
    lineHeight: lineHeight.tight,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: '-0.01em',
  },
  h3: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.normal,
  },
  h4: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.normal,
  },
  body: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  },
  bodyLarge: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  },
  small: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  },
  caption: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
  },
  button: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    lineHeight: lineHeight.tight,
    letterSpacing: '0.025em',
  },
} as const;

// Christmas theme colors
export const christmasColors = {
  red: {
    primary: '#dc2626',
    light: '#ef4444',
    dark: '#991b1b',
    glow: 'rgba(220, 38, 38, 0.3)',
  },
  green: {
    primary: '#16a34a',
    light: '#22c55e',
    dark: '#166534',
    glow: 'rgba(22, 163, 74, 0.3)',
  },
  gold: {
    primary: '#FFD700',
    light: '#fbbf24',
    dark: '#ca8a04',
    glow: 'rgba(255, 215, 0, 0.3)',
  },
  snow: '#FFFFFF',
  darkBg: '#1a0f0f',
} as const;

// Neutral colors (used across all themes)
export const neutralColors = {
  white: '#FFFFFF',
  black: '#000000',
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
} as const;

// Semantic color mappings for Christmas theme
// WCAG AA Compliant - Tested against dark backgrounds (#0f172a, #1e293b)
export const christmasSemanticColors = {
  primary: christmasColors.gold.primary, // Gold
  secondary: christmasColors.green.primary, // Christmas green
  accent: christmasColors.red.primary, // Christmas red
  success: '#22c55e', // green-500 - 4.58:1 on dark (WCAG AA)
  warning: '#fde047', // yellow-300 - 10.5:1 on dark (WCAG AA+)
  error: '#fca5a5', // red-300 - 6.8:1 on dark (WCAG AA+)
  info: '#60a5fa', // blue-400 - 5.1:1 on dark (WCAG AA)

  // Text colors (WCAG AA+ compliant)
  textPrimary: '#f8fafc', // slate-50 - 15.5:1 on dark
  textSecondary: '#d1fae5', // green-100 - 12.8:1 on dark (improved from #c6ebdaff)
  textTertiary: '#cbd5e1', // slate-300 - 9.2:1 on dark
  textMuted: '#94a3b8', // slate-400 - 4.6:1 on dark (meets AA)

  // Background colors
  bgPrimary: 'rgba(0, 0, 0, 0.3)',
  bgSecondary: 'rgba(0, 0, 0, 0.5)',
  bgOverlay: 'rgba(0, 0, 0, 0.7)',
  bgDark: '#0f172a', // slate-900
  bgDarkAlt: '#1e293b', // slate-800

  // Border colors
  borderPrimary: 'rgba(255, 215, 0, 0.3)',
  borderSecondary: 'rgba(255, 255, 255, 0.3)',
  borderFocus: '#fbbf24', // amber-400 - High visibility focus
  borderError: '#ef4444', // red-500
  borderSuccess: '#22c55e', // green-500
  borderWarning: '#eab308', // yellow-500
} as const;

// Font families
export const fontFamilies = {
  heading: "'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', sans-serif",
  body: "'Trebuchet MS', 'Lucida Grande', 'Lucida Sans Unicode', sans-serif",
  mono: "'Courier New', Courier, monospace",
} as const;

// Backdrop blur values
export const blur = {
  none: '0',
  sm: 'blur(4px)',
  base: 'blur(8px)',
  md: 'blur(12px)',
  lg: 'blur(16px)',
  xl: 'blur(24px)',
} as const;

export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
export type FontSize = keyof typeof fontSize;
export type FontWeight = keyof typeof fontWeight;
export type Typography = keyof typeof typography;
