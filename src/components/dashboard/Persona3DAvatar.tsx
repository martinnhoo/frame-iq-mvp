import { useState, useMemo } from "react";
import { motion } from "framer-motion";

interface Persona3DAvatarProps {
  emoji: string;
  name: string;
  gender: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

function seeded(seed: number, offset: number) {
  const x = Math.sin(seed + offset * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

// Realistic diverse skin tones — various ethnicities
const SKIN_COLORS = [
  "#FFDFC4", // light / Northern European
  "#F0C8A0", // fair / Mediterranean
  "#D4A574", // olive / Latin
  "#C68642", // medium brown / South Asian
  "#8D5524", // dark brown / West African
  "#5C3A1E", // deep brown / Central African
  "#E8B89D", // rosy / East Asian
  "#F1C27D", // golden / Southeast Asian
  "#A0522D", // sienna / Indigenous American
  "#FFDBAC", // peach / Mixed
  "#D2B48C", // tan / Middle Eastern
  "#6B3A2A", // espresso / Melanesian
  "#E6C2A0", // warm beige / Central Asian
  "#B07040", // bronze / Polynesian
];

const HAIR_COLORS = [
  "#1A1A1A", // black
  "#2C1608", // very dark brown
  "#4A3000", // dark brown
  "#8B4513", // brown
  "#C4682B", // auburn
  "#D4A76A", // dirty blonde
  "#F0E68C", // blonde
  "#CC3300", // red
  "#E0E0E0", // gray/silver
  "#FFFFFF", // white
  "#1E3A5F", // blue-black
  "#4B0082", // dyed purple
  "#DC143C", // dyed red
  "#1B6B44", // dyed green
];

const TOP_COLORS = [
  "#6C5CE7", "#00B894", "#E17055", "#0984E3", "#FDCB6E",
  "#E84393", "#00CEC9", "#D63031", "#636E72", "#A29BFE",
  "#2D3436", "#0A3D62", "#B53471", "#1B9CFC", "#F97F51",
  "#55E6C1", "#58B19F", "#EAB543", "#3B3B98", "#CAD3C8",
];

const HAIR_STYLES = [
  "short", "curly", "long", "spiky", "bun", "mohawk",
  "side", "afro", "braids", "buzz", "wavy", "hijab", "none",
];

const ACCESSORY_TYPES = [
  "none", "glasses", "sunglasses", "earring", "headphones",
  "beanie", "bowtie", "bandana", "hearing_aid", "nose_ring",
];

const FACE_SHAPES = ["oval", "round", "square", "long"];
const EYE_TYPES = 6;
const MOUTH_TYPES = 6;
const NOSE_TYPES = 5;
const EYEBROW_TYPES = 4;
const TOP_STYLES = 4;

// ~3% chance for disability trait
const DISABILITY_TYPES = [
  "none", "none", "none", "none", "none", "none", "none", "none", "none", "none",
  "none", "none", "none", "none", "none", "none", "none", "none", "none", "none",
  "none", "none", "none", "none", "none", "none", "none", "none", "none", "none",
  "vitiligo", "eye_patch", "wheelchair_badge",
];

export default function Persona3DAvatar({ emoji, name, gender, size = "md", onClick }: Persona3DAvatarProps) {
  const [hovered, setHovered] = useState(false);

  const dims = size === "sm" ? 64 : size === "md" ? 96 : 128;
  const hash = name.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const r = (o: number) => seeded(hash, o);

  const traits = useMemo(() => {
    const skin = SKIN_COLORS[Math.floor(r(1) * SKIN_COLORS.length)];
    return {
      skin,
      hair: HAIR_COLORS[Math.floor(r(2) * HAIR_COLORS.length)],
      top: TOP_COLORS[Math.floor(r(3) * TOP_COLORS.length)],
      hairStyle: HAIR_STYLES[Math.floor(r(4) * HAIR_STYLES.length)],
      accessory: ACCESSORY_TYPES[Math.floor(r(5) * ACCESSORY_TYPES.length)],
      eyeType: Math.floor(r(6) * EYE_TYPES),
      mouthType: Math.floor(r(7) * MOUTH_TYPES),
      noseType: Math.floor(r(8) * NOSE_TYPES),
      topStyle: Math.floor(r(9) * TOP_STYLES),
      faceShape: FACE_SHAPES[Math.floor(r(10) * FACE_SHAPES.length)],
      eyebrowType: Math.floor(r(11) * EYEBROW_TYPES),
      disability: DISABILITY_TYPES[Math.floor(r(12) * DISABILITY_TYPES.length)],
      freckles: r(13) > 0.75,
      beauty_mark: r(14) > 0.8,
      facial_hair: gender?.toLowerCase() !== "female" && r(15) > 0.55
        ? ["stubble", "beard", "mustache", "goatee"][Math.floor(r(16) * 4)]
        : "none",
    };
  }, [name, gender]);

  const skinDarker = useMemo(() => {
    const hex = traits.skin;
    const num = parseInt(hex.slice(1), 16);
    const rv = Math.max(0, ((num >> 16) & 255) - 30);
    const g = Math.max(0, ((num >> 8) & 255) - 30);
    const b = Math.max(0, (num & 255) - 30);
    return `rgb(${rv}, ${g}, ${b})`;
  }, [traits.skin]);

  const vb = "0 0 100 120";

  // Face shape dimensions
  const face = useMemo(() => {
    switch (traits.faceShape) {
      case "round": return { rx: 23, ry: 23, cy: 41 };
      case "square": return { rx: 22, ry: 22, cy: 40 };
      case "long": return { rx: 20, ry: 26, cy: 40 };
      default: return { rx: 22, ry: 24, cy: 40 };
    }
  }, [traits.faceShape]);

  const renderHair = () => {
    const hc = traits.hair;
    switch (traits.hairStyle) {
      case "short":
        return <path d="M30 38 Q30 18 50 15 Q70 18 70 38 Q65 28 50 26 Q35 28 30 38Z" fill={hc} />;
      case "curly":
        return (
          <g fill={hc}>
            <circle cx="32" cy="28" r="8" /><circle cx="45" cy="22" r="9" />
            <circle cx="58" cy="22" r="9" /><circle cx="68" cy="28" r="8" />
            <circle cx="38" cy="18" r="7" /><circle cx="55" cy="16" r="7" />
          </g>
        );
      case "long":
        return (
          <g fill={hc}>
            <path d="M28 38 Q28 14 50 12 Q72 14 72 38 Q68 26 50 24 Q32 26 28 38Z" />
            <path d="M28 38 Q24 50 26 68 Q28 58 32 48 Q30 42 28 38Z" />
            <path d="M72 38 Q76 50 74 68 Q72 58 68 48 Q70 42 72 38Z" />
          </g>
        );
      case "spiky":
        return (
          <g fill={hc}>
            <polygon points="35,32 38,10 42,30" /><polygon points="43,30 47,6 51,28" />
            <polygon points="52,28 56,8 60,30" /><polygon points="61,30 64,14 67,34" />
            <polygon points="30,36 32,20 36,34" />
          </g>
        );
      case "bun":
        return (
          <g fill={hc}>
            <path d="M32 38 Q32 22 50 18 Q68 22 68 38 Q64 28 50 26 Q36 28 32 38Z" />
            <circle cx="50" cy="14" r="10" />
          </g>
        );
      case "mohawk":
        return <path d="M44 34 Q44 6 50 2 Q56 6 56 34 Q54 26 50 24 Q46 26 44 34Z" fill={hc} />;
      case "side":
        return (
          <g fill={hc}>
            <path d="M28 38 Q28 16 50 14 Q72 16 72 34 Q66 24 50 22 Q34 24 28 38Z" />
            <path d="M28 38 Q22 34 24 24 Q26 18 34 16 Q28 22 28 38Z" />
          </g>
        );
      case "afro":
        return (
          <g fill={hc}>
            <ellipse cx="50" cy="30" rx="30" ry="26" />
            <ellipse cx="50" cy="32" rx="28" ry="24" fill={traits.skin} opacity="0" />
          </g>
        );
      case "braids":
        return (
          <g fill={hc}>
            <path d="M30 36 Q30 18 50 14 Q70 18 70 36 Q66 26 50 24 Q34 26 30 36Z" />
            <path d="M30 36 Q28 50 26 72 Q28 68 30 50Z" strokeWidth="3" stroke={hc} />
            <path d="M70 36 Q72 50 74 72 Q72 68 70 50Z" strokeWidth="3" stroke={hc} />
            <circle cx="26" cy="72" r="2.5" /><circle cx="74" cy="72" r="2.5" />
          </g>
        );
      case "buzz":
        return <path d="M30 38 Q30 22 50 19 Q70 22 70 38 Q66 32 50 30 Q34 32 30 38Z" fill={hc} opacity="0.6" />;
      case "wavy":
        return (
          <g fill={hc}>
            <path d="M28 38 Q28 14 50 12 Q72 14 72 38 Q68 26 50 24 Q32 26 28 38Z" />
            <path d="M26 38 Q22 46 28 54 Q32 46 26 38Z" />
            <path d="M74 38 Q78 46 72 54 Q68 46 74 38Z" />
          </g>
        );
      case "hijab":
        return (
          <g>
            <path d="M24 42 Q24 10 50 8 Q76 10 76 42 Q76 60 70 70 L64 68 Q68 54 68 42 Q68 20 50 18 Q32 20 32 42 Q32 54 36 68 L30 70 Q24 60 24 42Z" fill={hc} />
            <path d="M30 70 Q34 76 50 78 Q66 76 70 70 L72 100 L28 100Z" fill={hc} />
          </g>
        );
      default:
        return null;
    }
  };

  const renderEyes = () => {
    switch (traits.eyeType) {
      case 0: // Round
        return (
          <g>
            <circle cx="40" cy="42" r="3.5" fill="white" /><circle cx="60" cy="42" r="3.5" fill="white" />
            <circle cx="40.5" cy="42.5" r="2" fill="#2C1810" /><circle cx="60.5" cy="42.5" r="2" fill="#2C1810" />
            <circle cx="39.5" cy="41" r="0.8" fill="white" /><circle cx="59.5" cy="41" r="0.8" fill="white" />
          </g>
        );
      case 1: // Dots
        return (
          <g>
            <circle cx="40" cy="42" r="2.2" fill="#2C1810" /><circle cx="60" cy="42" r="2.2" fill="#2C1810" />
          </g>
        );
      case 2: // Sleepy
        return (
          <g>
            <path d="M36 42 Q40 40 44 42" fill="none" stroke="#2C1810" strokeWidth="2" strokeLinecap="round" />
            <path d="M56 42 Q60 40 64 42" fill="none" stroke="#2C1810" strokeWidth="2" strokeLinecap="round" />
          </g>
        );
      case 3: // Big cute
        return (
          <g>
            <ellipse cx="40" cy="42" rx="4.5" ry="5" fill="white" /><ellipse cx="60" cy="42" rx="4.5" ry="5" fill="white" />
            <circle cx="41" cy="43" r="2.8" fill="#2C1810" /><circle cx="61" cy="43" r="2.8" fill="#2C1810" />
            <circle cx="39.5" cy="40.5" r="1.2" fill="white" /><circle cx="59.5" cy="40.5" r="1.2" fill="white" />
          </g>
        );
      case 4: // Almond
        return (
          <g>
            <ellipse cx="40" cy="42" rx="4" ry="3" fill="white" /><ellipse cx="60" cy="42" rx="4" ry="3" fill="white" />
            <circle cx="40" cy="42" r="1.8" fill="#3B2614" /><circle cx="60" cy="42" r="1.8" fill="#3B2614" />
            <circle cx="39" cy="41" r="0.6" fill="white" /><circle cx="59" cy="41" r="0.6" fill="white" />
          </g>
        );
      default: // Monolid
        return (
          <g>
            <path d="M36 42 Q40 39 44 42 Q40 43 36 42Z" fill="white" />
            <path d="M56 42 Q60 39 64 42 Q60 43 56 42Z" fill="white" />
            <circle cx="40" cy="42" r="1.5" fill="#1A1005" /><circle cx="60" cy="42" r="1.5" fill="#1A1005" />
          </g>
        );
    }
  };

  const renderNose = () => {
    switch (traits.noseType) {
      case 0: return <circle cx="50" cy="49" r="1.5" fill={skinDarker} />;
      case 1: return <path d="M48 48 L50 51 L52 48" fill="none" stroke={skinDarker} strokeWidth="1.5" strokeLinecap="round" />;
      case 2: return <ellipse cx="50" cy="49" rx="2.5" ry="1.5" fill={skinDarker} />;
      case 3: // Wide nose
        return (
          <g>
            <path d="M47 47 Q50 52 53 47" fill="none" stroke={skinDarker} strokeWidth="1.2" />
            <circle cx="47" cy="49" r="1.2" fill={skinDarker} opacity="0.5" />
            <circle cx="53" cy="49" r="1.2" fill={skinDarker} opacity="0.5" />
          </g>
        );
      default: // Pointed
        return <path d="M50 45 L48 50 L52 50Z" fill={skinDarker} opacity="0.4" />;
    }
  };

  const renderMouth = () => {
    switch (traits.mouthType) {
      case 0: return <path d="M43 55 Q50 62 57 55" fill="none" stroke="#5C3A2E" strokeWidth="1.8" strokeLinecap="round" />;
      case 1:
        return (
          <g>
            <path d="M42 54 Q50 64 58 54" fill="#5C3A2E" />
            <path d="M44 54 Q50 58 56 54" fill="white" />
          </g>
        );
      case 2: return <path d="M46 55 Q50 59 54 55" fill="none" stroke="#5C3A2E" strokeWidth="1.5" strokeLinecap="round" />;
      case 3: // Cat mouth
        return (
          <g>
            <path d="M43 55 Q47 58 50 55" fill="none" stroke="#5C3A2E" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M50 55 Q53 58 57 55" fill="none" stroke="#5C3A2E" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        );
      case 4: // Full lips
        return (
          <g>
            <ellipse cx="50" cy="55" rx="6" ry="3" fill="#C4756A" />
            <path d="M44 55 Q50 53 56 55" fill="none" stroke="#A05A50" strokeWidth="0.8" />
          </g>
        );
      default: // Neutral
        return <line x1="45" y1="56" x2="55" y2="56" stroke="#5C3A2E" strokeWidth="1.5" strokeLinecap="round" />;
    }
  };

  const renderEyebrows = () => {
    switch (traits.eyebrowType) {
      case 0: // Normal
        return (
          <g>
            <line x1="36" y1="36" x2="44" y2="35" stroke="#3B2614" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="56" y1="35" x2="64" y2="36" stroke="#3B2614" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        );
      case 1: // Thick
        return (
          <g>
            <path d="M35 36 Q40 33 45 35" fill="none" stroke="#3B2614" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M55 35 Q60 33 65 36" fill="none" stroke="#3B2614" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        );
      case 2: // Arched
        return (
          <g>
            <path d="M36 37 Q40 32 44 35" fill="none" stroke="#3B2614" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M56 35 Q60 32 64 37" fill="none" stroke="#3B2614" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        );
      default: // Straight
        return (
          <g>
            <line x1="36" y1="35.5" x2="44" y2="35.5" stroke="#3B2614" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="56" y1="35.5" x2="64" y2="35.5" stroke="#3B2614" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        );
    }
  };

  const renderTop = () => {
    const tc = traits.top;
    switch (traits.topStyle) {
      case 0: // T-shirt
        return (
          <g>
            <path d="M30 72 Q30 68 36 66 L44 70 L56 70 L64 66 Q70 68 70 72 L72 100 L28 100 Z" fill={tc} />
            <path d="M44 70 Q50 74 56 70" fill="none" stroke={`${tc}dd`} strokeWidth="1" />
          </g>
        );
      case 1: // Collar shirt
        return (
          <g>
            <path d="M30 72 Q30 68 36 66 L44 70 L56 70 L64 66 Q70 68 70 72 L72 100 L28 100 Z" fill={tc} />
            <path d="M44 70 L47 78 L50 72 L53 78 L56 70" fill="white" stroke="white" strokeWidth="0.5" />
            <line x1="50" y1="72" x2="50" y2="100" stroke="rgba(0,0,0,0.08)" strokeWidth="0.8" />
          </g>
        );
      case 2: // V-neck
        return (
          <g>
            <path d="M30 72 Q30 68 36 66 L44 70 L56 70 L64 66 Q70 68 70 72 L72 100 L28 100 Z" fill={tc} />
            <path d="M44 70 L50 82 L56 70" fill={traits.skin} />
          </g>
        );
      default: // Hoodie
        return (
          <g>
            <path d="M28 72 Q28 66 36 64 L44 70 L56 70 L64 64 Q72 66 72 72 L74 100 L26 100 Z" fill={tc} />
            <path d="M40 70 Q50 76 60 70" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.5" />
            <path d="M36 64 Q36 58 40 56 Q44 58 44 62" fill={tc} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
            <path d="M56 62 Q56 58 60 56 Q64 58 64 64" fill={tc} stroke="rgba(0,0,0,0.06)" strokeWidth="0.5" />
          </g>
        );
    }
  };

  const renderAccessory = () => {
    switch (traits.accessory) {
      case "glasses":
        return (
          <g fill="none" stroke="#3B2614" strokeWidth="1.8">
            <circle cx="40" cy="42" r="6" /><circle cx="60" cy="42" r="6" />
            <line x1="46" y1="42" x2="54" y2="42" />
            <line x1="34" y1="42" x2="28" y2="40" /><line x1="66" y1="42" x2="72" y2="40" />
          </g>
        );
      case "sunglasses":
        return (
          <g>
            <rect x="33" y="38" width="14" height="9" rx="3" fill="#1A1A1A" opacity="0.85" />
            <rect x="53" y="38" width="14" height="9" rx="3" fill="#1A1A1A" opacity="0.85" />
            <line x1="47" y1="42" x2="53" y2="42" stroke="#1A1A1A" strokeWidth="1.5" />
            <line x1="33" y1="42" x2="28" y2="40" stroke="#1A1A1A" strokeWidth="1.5" />
            <line x1="67" y1="42" x2="72" y2="40" stroke="#1A1A1A" strokeWidth="1.5" />
          </g>
        );
      case "earring":
        return (
          <g>
            <circle cx="28" cy="50" r="2" fill="#FFD700" />
            <circle cx="28" cy="50" r="1" fill="#FFA500" />
          </g>
        );
      case "headphones":
        return (
          <g>
            <path d="M26 40 Q26 18 50 16 Q74 18 74 40" fill="none" stroke="#555" strokeWidth="3" />
            <rect x="22" y="36" width="6" height="10" rx="3" fill="#555" />
            <rect x="72" y="36" width="6" height="10" rx="3" fill="#555" />
          </g>
        );
      case "beanie":
        return (
          <g>
            <path d="M28 36 Q28 14 50 12 Q72 14 72 36 L70 38 L30 38 Z" fill={traits.top} opacity="0.9" />
            <rect x="28" y="34" width="44" height="5" rx="2" fill={traits.top} />
            <circle cx="50" cy="12" r="3" fill={traits.top} />
          </g>
        );
      case "bowtie":
        return (
          <g>
            <polygon points="44,70 38,66 38,74" fill="#E84393" />
            <polygon points="56,70 62,66 62,74" fill="#E84393" />
            <circle cx="50" cy="70" r="2.5" fill="#C73078" />
          </g>
        );
      case "bandana":
        return (
          <g>
            <path d="M28 34 Q50 28 72 34 L72 38 Q50 32 28 38Z" fill="#E84393" />
            <circle cx="34" cy="36" r="1" fill="#C73078" />
          </g>
        );
      case "hearing_aid":
        return (
          <g>
            <path d="M72 40 Q76 40 76 44 L76 50 Q76 52 74 52" fill="none" stroke="#B0B0B0" strokeWidth="1.5" />
            <circle cx="74" cy="52" r="1.5" fill="#D4D4D4" />
          </g>
        );
      case "nose_ring":
        return <circle cx="50" cy="51" r="1.5" fill="none" stroke="#C0C0C0" strokeWidth="1" />;
      default:
        return null;
    }
  };

  const renderFacialHair = () => {
    if (traits.facial_hair === "none") return null;
    const color = traits.hair;
    switch (traits.facial_hair) {
      case "stubble":
        return (
          <g opacity="0.25" fill={color}>
            {[42,44,46,48,50,52,54,56,58].map(x => (
              <circle key={x} cx={x} cy={57 + (x % 3)} r="0.5" />
            ))}
          </g>
        );
      case "beard":
        return <path d="M36 54 Q36 68 50 72 Q64 68 64 54" fill={color} opacity="0.35" />;
      case "mustache":
        return <path d="M42 52 Q46 55 50 52 Q54 55 58 52" fill={color} opacity="0.5" />;
      case "goatee":
        return (
          <g opacity="0.4" fill={color}>
            <path d="M46 55 Q50 58 54 55 L53 64 Q50 66 47 64Z" />
          </g>
        );
      default: return null;
    }
  };

  const renderDisability = () => {
    switch (traits.disability) {
      case "vitiligo":
        return (
          <g opacity="0.35">
            <ellipse cx="62" cy="48" rx="5" ry="4" fill="white" />
            <ellipse cx="36" cy="54" rx="3" ry="5" fill="white" />
          </g>
        );
      case "eye_patch":
        return (
          <g>
            <ellipse cx="60" cy="42" rx="7" ry="6" fill="#2C1810" />
            <line x1="54" y1="38" x2="72" y2="38" stroke="#2C1810" strokeWidth="1.5" />
          </g>
        );
      case "wheelchair_badge":
        return (
          <g>
            <circle cx="76" cy="90" r="6" fill="#0984E3" opacity="0.8" />
            <text x="76" y="93" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">♿</text>
          </g>
        );
      default: return null;
    }
  };

  const renderFreckles = () => {
    if (!traits.freckles) return null;
    return (
      <g opacity="0.3" fill={skinDarker}>
        <circle cx="37" cy="48" r="0.6" /><circle cx="39" cy="50" r="0.5" />
        <circle cx="35" cy="50" r="0.5" /><circle cx="61" cy="48" r="0.6" />
        <circle cx="63" cy="50" r="0.5" /><circle cx="65" cy="50" r="0.5" />
      </g>
    );
  };

  const renderBeautyMark = () => {
    if (!traits.beauty_mark) return null;
    return <circle cx="58" cy="52" r="1" fill="#3B2614" opacity="0.6" />;
  };

  const renderBlush = () => (
    <g opacity="0.2">
      <ellipse cx="34" cy="52" rx="4" ry="2.5" fill="#FF8A8A" />
      <ellipse cx="66" cy="52" rx="4" ry="2.5" fill="#FF8A8A" />
    </g>
  );

  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative cursor-pointer select-none"
      style={{ width: dims, height: dims + 8 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94, rotate: -2 }}
    >
      <motion.div
        className="w-full h-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${traits.skin}44, transparent)` }}
          animate={{ opacity: hovered ? 0.5 : 0, scale: hovered ? 1.4 : 1 }}
          transition={{ duration: 0.3 }}
        />

        <svg
          width={dims}
          height={dims}
          viewBox={vb}
          style={{ overflow: "visible", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }}
        >
          {renderTop()}
          <rect x="44" y="62" width="12" height="10" rx="4" fill={traits.skin} />
          <ellipse cx="50" cy={face.cy} rx={face.rx} ry={face.ry} fill={traits.skin} />
          <ellipse cx="50" cy={face.cy + 2} rx={face.rx - 2} ry={face.ry - 2} fill={skinDarker} opacity="0.08" />

          {/* Disability layer under hair */}
          {renderDisability()}

          {traits.hairStyle !== "hijab" && renderHair()}

          {renderEyes()}

          <motion.g animate={hovered ? { y: -1.5 } : { y: 0 }} transition={{ type: "spring", stiffness: 400 }}>
            {renderEyebrows()}
          </motion.g>

          {renderNose()}
          {renderFreckles()}
          {renderBeautyMark()}

          <motion.g animate={hovered ? { scaleX: 1.15, scaleY: 1.1 } : { scaleX: 1, scaleY: 1 }}
            style={{ transformOrigin: "50px 56px" }} transition={{ type: "spring", stiffness: 300 }}>
            {renderMouth()}
          </motion.g>

          {renderFacialHair()}
          {renderBlush()}
          {renderAccessory()}

          {/* Hijab goes on top of everything */}
          {traits.hairStyle === "hijab" && renderHair()}

          {/* Arms */}
          <motion.g animate={hovered ? { rotate: -8 } : { rotate: 0 }} style={{ transformOrigin: "30px 76px" }}
            transition={{ type: "spring", stiffness: 200 }}>
            <path d="M30 76 Q22 82 18 94" fill="none" stroke={traits.skin} strokeWidth="6" strokeLinecap="round" />
          </motion.g>
          <motion.g animate={hovered ? { rotate: 8 } : { rotate: 0 }} style={{ transformOrigin: "70px 76px" }}
            transition={{ type: "spring", stiffness: 200 }}>
            <path d="M70 76 Q78 82 82 94" fill="none" stroke={traits.skin} strokeWidth="6" strokeLinecap="round" />
          </motion.g>
        </svg>
      </motion.div>

      <motion.div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          bottom: -4,
          width: dims * 0.45,
          height: 5,
          background: "radial-gradient(ellipse, rgba(0,0,0,0.18), transparent)",
          filter: "blur(2px)",
        }}
        animate={{ width: hovered ? dims * 0.55 : dims * 0.4, opacity: hovered ? 0.35 : 0.2 }}
      />
    </motion.div>
  );
}