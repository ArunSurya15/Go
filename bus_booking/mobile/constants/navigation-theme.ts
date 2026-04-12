import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

import { palette } from "@/constants/theme";

export const egoLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: palette.indigo600,
    background: palette.slate50,
    card: palette.white,
    text: palette.slate900,
    border: palette.slate200,
    notification: palette.indigo600,
  },
};

export const egoDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: palette.indigo500,
    background: "#0b1120",
    card: palette.slate800,
    text: palette.slate50,
    border: palette.slate700,
    notification: palette.indigo500,
  },
};
