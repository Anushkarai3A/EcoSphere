import type { QuestCategory } from "./types";

/** World regions showcased on the landing Explore section. */
export interface WorldRegion {
  id: string;
  name: string;
  /** lucide icon name resolved in the component (kept as data for reuse). */
  icon: "trees" | "mountain" | "waves" | "droplets" | "city" | "flower" | "wheat" | "landmark";
  description: string;
  /** Backend quest categories that live in this region (empty = showcase region). */
  categories: QuestCategory[];
  /** Hotspot position over the artwork, in percent. */
  pin: { x: number; y: number };
  accent: "emerald" | "turquoise" | "cyan" | "gold";
}

export const WORLD_REGIONS: WorldRegion[] = [
  {
    id: "forest",
    name: "Forest Region",
    icon: "trees",
    description: "Discover biodiversity and complete conservation quests beneath the canopy.",
    categories: ["TREE_PLANTATION"],
    pin: { x: 63, y: 34 },
    accent: "emerald",
  },
  {
    id: "mountains",
    name: "Mountain Region",
    icon: "mountain",
    description: "Restore fragile highland habitats and protect wildlife corridors.",
    categories: ["BIODIVERSITY"],
    pin: { x: 55, y: 14 },
    accent: "cyan",
  },
  {
    id: "coastal",
    name: "Coastal Waters",
    icon: "waves",
    description: "Clear the shoreline, guard the bays and keep the ocean plastic-free.",
    categories: ["WASTE_COLLECTION"],
    pin: { x: 22, y: 46 },
    accent: "turquoise",
  },
  {
    id: "rivers",
    name: "Rivers & Lakes",
    icon: "droplets",
    description: "Clean waterways, lakeshores and the riverside parks around them.",
    categories: ["PARK_CLEANING"],
    pin: { x: 78, y: 58 },
    accent: "turquoise",
  },
  {
    id: "urban",
    name: "Urban Eco-City",
    icon: "city",
    description: "Sort, recycle and green the futuristic ecological city.",
    categories: ["RECYCLING"],
    pin: { x: 72, y: 24 },
    accent: "cyan",
  },
  {
    id: "wetlands",
    name: "Wetlands",
    icon: "flower",
    description: "Survey marshlands, dragonflies and the migratory birds that rest there.",
    categories: [],
    pin: { x: 40, y: 66 },
    accent: "emerald",
  },
  {
    id: "farmlands",
    name: "Farmlands",
    icon: "wheat",
    description: "Spread sustainable farming practices across the fields and orchards.",
    categories: ["AWARENESS"],
    pin: { x: 88, y: 40 },
    accent: "gold",
  },
  {
    id: "ruins",
    name: "Ruins & Heritage",
    icon: "landmark",
    description: "Document the ancient sites where nature slowly reclaims the stone.",
    categories: [],
    pin: { x: 33, y: 24 },
    accent: "gold",
  },
];

/** Default map center (matches the quest map) used for world-level stats. */
export const WORLD_CENTER = { lat: 28.6139, lng: 77.209 };

/** Accent → concrete classes, so regions stay consistent everywhere. */
export const regionAccent: Record<WorldRegion["accent"], { text: string; bg: string; ring: string; shadow: string }> = {
  emerald: {
    text: "text-emerald",
    bg: "bg-emerald/15",
    ring: "border-emerald/40",
    shadow: "shadow-[0_0_24px_-6px_rgba(46,207,143,0.7)]",
  },
  turquoise: {
    text: "text-turquoise",
    bg: "bg-turquoise/15",
    ring: "border-turquoise/40",
    shadow: "shadow-[0_0_24px_-6px_rgba(35,196,201,0.7)]",
  },
  cyan: {
    text: "text-cyan",
    bg: "bg-cyan/15",
    ring: "border-cyan/40",
    shadow: "shadow-[0_0_24px_-6px_rgba(95,224,232,0.7)]",
  },
  gold: {
    text: "text-gold",
    bg: "bg-gold/15",
    ring: "border-gold/40",
    shadow: "shadow-[0_0_24px_-6px_rgba(242,181,68,0.7)]",
  },
};
