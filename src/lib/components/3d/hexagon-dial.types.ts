export interface HexFaceOption {
  id: string;
  label: string;
}

export interface HexFaceConfig {
  id: string;
  label: string;
  iconPath: string;
  isToggle: boolean;
  options: HexFaceOption[];
}

export interface HexBayTint {
  accent: string;      // Primary highlight (icon fill, active stroke, bay dot)
  border: string;      // Active face stroke, fan-out selected stroke
  activeBg: string;    // Face background when active/open
  hoverBg: string;     // Face background on hover
  glow: string;        // Glow filter color (semi-transparent)
}

export interface HexBayConfig {
  id: string;
  label: string;
  centerIconPath: string;
  tint: HexBayTint;
  faces: [HexFaceConfig, HexFaceConfig, HexFaceConfig,
          HexFaceConfig, HexFaceConfig, HexFaceConfig];
}
