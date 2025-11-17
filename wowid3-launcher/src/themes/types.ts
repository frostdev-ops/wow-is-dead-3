export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  accent: string;
  error?: string;
  success?: string;
  warning?: string;
}

export interface ThemeFonts {
  heading: string;
  body: string;
}

export interface ThemeAnimations {
  snowfall: boolean;
  lights: boolean;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  animations: ThemeAnimations;
}
