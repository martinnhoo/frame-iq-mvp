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

// Fun, non-realistic skin tones
const SKIN_COLORS = [
  "#FFDC7A", // yellow
  "#FFB3C6", // pink
  "#A0E8AF", // mint green
  "#B8A9FF", // lavender
  "#FFD4A3", // peach
  "#87CEEB", // sky blue
  "#F9C8FF", // soft magenta
  "#C4F5D4", // pastel green
  "#FFE066", // gold
  "#E8C4FF", // lilac
];

const HAIR_COLORS = [
  "#2D1B69", "#FF6B6B", "#333", "#8B4513", "#FF8C00",
  "#1E90FF", "#FF69B4", "#6B4226", "#E0E0E0", "#4ECDC4",
];

const TOP_COLORS = [
  "#6C5CE7", "#00B894", "#E17055", "#0984E3", "#FDCB6E",
  "#E84393", "#00CEC9", "#D63031", "#636E72", "#A29BFE",
  "#FF7675", "#55EFC4", "#FAB1A0", "#74B9FF", "#FFEAA7",
];

const HAIR_STYLES = ["short", "curly", "long", "spiky", "bun", "mohawk", "side", "none"];
const ACCESSORY_TYPES = ["none", "glasses", "earring", "headphones", "beanie", "bowtie"];

export default function Persona3DAvatar({ emoji, name, gender, size = "md", onClick }: Persona3DAvatarProps) {
  const [hovered, setHovered] = useState(false);

  const dims = size === "sm" ? 64 : size === "md" ? 96 : 128;
  const hash = name.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const r = (o: number) => seeded(hash, o);

  const traits = useMemo(() => ({
    skin: SKIN_COLORS[Math.floor(r(1) * SKIN_COLORS.length)],
    hair: HAIR_COLORS[Math.floor(r(2) * HAIR_COLORS.length)],
    top: TOP_COLORS[Math.floor(r(3) * TOP_COLORS.length)],
    hairStyle: HAIR_STYLES[Math.floor(r(4) * HAIR_STYLES.length)],
    accessory: ACCESSORY_TYPES[Math.floor(r(5) * ACCESSORY_TYPES.length)],
    eyeType: Math.floor(r(6) * 4), // 0-3
    mouthType: Math.floor(r(7) * 4),
    noseType: Math.floor(r(8) * 3),
    topStyle: Math.floor(r(9) * 3), // tshirt, collar, vneck
    skinDarker: "",
  }), [name]);

  // Slightly darker skin for shading
  const skinDarker = useMemo(() => {
    const hex = traits.skin;
    const num = parseInt(hex.slice(1), 16);
    const r2 = Math.max(0, ((num >> 16) & 255) - 25);
    const g = Math.max(0, ((num >> 8) & 255) - 25);
    const b = Math.max(0, (num & 255) - 25);
    return `rgb(${r2}, ${g}, ${b})`;
  }, [traits.skin]);

  const vb = "0 0 100 120";

  const renderHair = () => {
    const hc = traits.hair;
    switch (traits.hairStyle) {
      case "short":
        return (
          <path d="M30 38 Q30 18 50 15 Q70 18 70 38 Q65 28 50 26 Q35 28 30 38Z" fill={hc} />
        );
      case "curly":
        return (
          <g fill={hc}>
            <circle cx="32" cy="28" r="8" />
            <circle cx="45" cy="22" r="9" />
            <circle cx="58" cy="22" r="9" />
            <circle cx="68" cy="28" r="8" />
            <circle cx="38" cy="18" r="7" />
            <circle cx="55" cy="16" r="7" />
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
            <polygon points="35,32 38,10 42,30" />
            <polygon points="43,30 47,6 51,28" />
            <polygon points="52,28 56,8 60,30" />
            <polygon points="61,30 64,14 67,34" />
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
        return (
          <g fill={hc}>
            <path d="M44 34 Q44 6 50 2 Q56 6 56 34 Q54 26 50 24 Q46 26 44 34Z" />
          </g>
        );
      case "side":
        return (
          <g fill={hc}>
            <path d="M28 38 Q28 16 50 14 Q72 16 72 34 Q66 24 50 22 Q34 24 28 38Z" />
            <path d="M28 38 Q22 34 24 24 Q26 18 34 16 Q28 22 28 38Z" />
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
            <circle cx="40" cy="42" r="3.5" fill="white" />
            <circle cx="60" cy="42" r="3.5" fill="white" />
            <circle cx="40.5" cy="42.5" r="2" fill="#333" />
            <circle cx="60.5" cy="42.5" r="2" fill="#333" />
            <circle cx="39.5" cy="41" r="0.8" fill="white" />
            <circle cx="59.5" cy="41" r="0.8" fill="white" />
          </g>
        );
      case 1: // Dots
        return (
          <g>
            <circle cx="40" cy="42" r="2.2" fill="#333" />
            <circle cx="60" cy="42" r="2.2" fill="#333" />
          </g>
        );
      case 2: // Sleepy
        return (
          <g>
            <path d="M36 42 Q40 40 44 42" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" />
            <path d="M56 42 Q60 40 64 42" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" />
          </g>
        );
      default: // Big cute
        return (
          <g>
            <ellipse cx="40" cy="42" rx="4.5" ry="5" fill="white" />
            <ellipse cx="60" cy="42" rx="4.5" ry="5" fill="white" />
            <circle cx="41" cy="43" r="2.8" fill="#333" />
            <circle cx="61" cy="43" r="2.8" fill="#333" />
            <circle cx="39.5" cy="40.5" r="1.2" fill="white" />
            <circle cx="59.5" cy="40.5" r="1.2" fill="white" />
          </g>
        );
    }
  };

  const renderNose = () => {
    switch (traits.noseType) {
      case 0:
        return <circle cx="50" cy="49" r="1.5" fill={skinDarker} />;
      case 1:
        return <path d="M48 48 L50 51 L52 48" fill="none" stroke={skinDarker} strokeWidth="1.5" strokeLinecap="round" />;
      default:
        return <ellipse cx="50" cy="49" rx="2" ry="1" fill={skinDarker} />;
    }
  };

  const renderMouth = () => {
    switch (traits.mouthType) {
      case 0: // Smile
        return <path d="M43 55 Q50 62 57 55" fill="none" stroke="#333" strokeWidth="1.8" strokeLinecap="round" />;
      case 1: // Open smile
        return (
          <g>
            <path d="M42 54 Q50 64 58 54" fill="#333" />
            <path d="M44 54 Q50 58 56 54" fill="white" />
          </g>
        );
      case 2: // Small
        return <path d="M46 55 Q50 59 54 55" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />;
      default: // Cat mouth
        return (
          <g>
            <path d="M43 55 Q47 58 50 55" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M50 55 Q53 58 57 55" fill="none" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
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
      default: // V-neck
        return (
          <g>
            <path d="M30 72 Q30 68 36 66 L44 70 L56 70 L64 66 Q70 68 70 72 L72 100 L28 100 Z" fill={tc} />
            <path d="M44 70 L50 82 L56 70" fill={traits.skin} />
          </g>
        );
    }
  };

  const renderAccessory = () => {
    switch (traits.accessory) {
      case "glasses":
        return (
          <g fill="none" stroke="#333" strokeWidth="1.8">
            <circle cx="40" cy="42" r="6" />
            <circle cx="60" cy="42" r="6" />
            <line x1="46" y1="42" x2="54" y2="42" />
            <line x1="34" y1="42" x2="28" y2="40" />
            <line x1="66" y1="42" x2="72" y2="40" />
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
            <path d="M28 36 Q28 14 50 12 Q72 14 72 36 L70 38 L30 38 Z"
              fill={traits.top} opacity="0.9" />
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
      default:
        return null;
    }
  };

  // Blush cheeks
  const renderBlush = () => (
    <g opacity="0.35">
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
      {/* Float animation */}
      <motion.div
        className="w-full h-full"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Glow on hover */}
        <motion.div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${traits.skin}66, transparent)` }}
          animate={{ opacity: hovered ? 0.6 : 0, scale: hovered ? 1.4 : 1 }}
          transition={{ duration: 0.3 }}
        />

        <svg
          width={dims}
          height={dims}
          viewBox={vb}
          style={{ overflow: "visible", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }}
        >
          {/* Body / Top */}
          {renderTop()}

          {/* Neck */}
          <rect x="44" y="62" width="12" height="10" rx="4" fill={traits.skin} />

          {/* Head */}
          <ellipse cx="50" cy="40" rx="22" ry="24" fill={traits.skin} />

          {/* Head shadow */}
          <ellipse cx="50" cy="42" rx="20" ry="22" fill={skinDarker} opacity="0.1" />

          {/* Hair (behind for some styles) */}
          {renderHair()}

          {/* Eyes */}
          {renderEyes()}

          {/* Eyebrows */}
          <motion.g animate={hovered ? { y: -1.5 } : { y: 0 }} transition={{ type: "spring", stiffness: 400 }}>
            <line x1="36" y1="36" x2="44" y2="35" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="56" y1="35" x2="64" y2="36" stroke="#333" strokeWidth="1.5" strokeLinecap="round" />
          </motion.g>

          {/* Nose */}
          {renderNose()}

          {/* Mouth */}
          <motion.g animate={hovered ? { scaleX: 1.15, scaleY: 1.1 } : { scaleX: 1, scaleY: 1 }}
            style={{ transformOrigin: "50px 56px" }} transition={{ type: "spring", stiffness: 300 }}>
            {renderMouth()}
          </motion.g>

          {/* Blush */}
          {renderBlush()}

          {/* Accessory */}
          {renderAccessory()}

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

      {/* Shadow */}
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
