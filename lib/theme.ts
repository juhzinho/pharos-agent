/** Electric blue design tokens */

export const COLORS = {
  navy950: "#061018",
  navy900: "#0a1628",
  navy850: "#0f2137",
  navy800: "#152a45",
  accent: "#0040ff",
  accentBright: "#0066ff",
  accentSoft: "#3388ff",
  accentNeon: "#00a8ff",
  accentDeep: "#0022cc",
  text: "#e8eef7",
  textMuted: "rgba(160, 180, 210, 0.72)",
} as const;

export const GRADIENTS = {
  page: "linear-gradient(175deg, #0a1628 0%, #061018 55%, #040a14 100%)",
  heroText: "linear-gradient(140deg, #ffffff 0%, #cce0ff 30%, #66a3ff 65%, #0066ff 100%)",
  accent: "linear-gradient(135deg, #0022cc 0%, #0040ff 50%, #0066ff 100%)",
} as const;
