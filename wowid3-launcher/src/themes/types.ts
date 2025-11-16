export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  snow: string;
  cardBg: string;
  text: string;
  textMuted: string;
}

export interface ThemeAnimations {
  snowDensity: number;
  snowSpeed: number;
  lightsEnabled: boolean;
  twinkleSpeed: number;
}

export interface ThemeImages {
  background: string;
  logo: string;
  snowflake: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  animations: ThemeAnimations;
  images: ThemeImages;
  fonts: ThemeFonts;
}
