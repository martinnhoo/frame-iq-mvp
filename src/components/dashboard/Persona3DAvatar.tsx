import { useState, useMemo } from "react";
import { motion } from "framer-motion";

interface Persona3DAvatarProps {
  emoji: string;
  name: string;
  gender: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

// Random but consistent selections based on name hash
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const BODY_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#FF8C69", "#87CEEB", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#F1948A", "#82E0AA", "#AED6F1", "#F0B27A",
];

const ACCESSORIES = ["none", "hat", "bow", "antenna", "crown", "headband"];
const EYE_STYLES = ["dots", "big", "sleepy", "wink", "stars"];
const MOUTH_STYLES = ["smile", "open", "cat", "tongue", "o"];
const BODY_SHAPES = ["round", "bean", "square", "blob"];

export default function Persona3DAvatar({ emoji, name, gender, size = "md", onClick }: Persona3DAvatarProps) {
  const [hovered, setHovered] = useState(false);

  const dims = size === "sm" ? 64 : size === "md" ? 90 : 120;

  const traits = useMemo(() => {
    const hash = name.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
    const r = (offset: number) => seededRandom(hash + offset);

    return {
      bodyColor: BODY_COLORS[Math.floor(r(1) * BODY_COLORS.length)],
      bodyColor2: BODY_COLORS[Math.floor(r(2) * BODY_COLORS.length)],
      accessory: ACCESSORIES[Math.floor(r(3) * ACCESSORIES.length)],
      eyes: EYE_STYLES[Math.floor(r(4) * EYE_STYLES.length)],
      mouth: MOUTH_STYLES[Math.floor(r(5) * MOUTH_STYLES.length)],
      bodyShape: BODY_SHAPES[Math.floor(r(6) * BODY_SHAPES.length)],
      cheekColor: `${BODY_COLORS[Math.floor(r(7) * BODY_COLORS.length)]}55`,
      hasBlush: r(8) > 0.4,
      armStyle: Math.floor(r(9) * 3),
      legStyle: Math.floor(r(10) * 3),
    };
  }, [name]);

  const bodyRadius = traits.bodyShape === "round" ? "50%" :
    traits.bodyShape === "bean" ? "50% 50% 45% 45%" :
    traits.bodyShape === "square" ? "28%" : "60% 40% 50% 50%";

  const renderEyes = () => {
    const s = dims * 0.08;
    switch (traits.eyes) {
      case "big":
        return (
          <>
            <circle cx="38%" cy="38%" r={s * 1.4} fill="white" />
            <circle cx="38%" cy="38%" r={s * 0.8} fill="#333" />
            <circle cx="36%" cy="36%" r={s * 0.3} fill="white" />
            <circle cx="62%" cy="38%" r={s * 1.4} fill="white" />
            <circle cx="62%" cy="38%" r={s * 0.8} fill="#333" />
            <circle cx="60%" cy="36%" r={s * 0.3} fill="white" />
          </>
        );
      case "sleepy":
        return (
          <>
            <line x1="30%" y1="40%" x2="46%" y2="38%" stroke="#333" strokeWidth={2.5} strokeLinecap="round" />
            <line x1="54%" y1="38%" x2="70%" y2="40%" stroke="#333" strokeWidth={2.5} strokeLinecap="round" />
          </>
        );
      case "wink":
        return (
          <>
            <circle cx="38%" cy="38%" r={s} fill="#333" />
            <path d="M 54,38 Q 60,32 66,38" fill="none" stroke="#333" strokeWidth={2.5} strokeLinecap="round"
              style={{ transform: `scale(${dims / 90})`, transformOrigin: "60% 38%" }} />
          </>
        );
      case "stars":
        return (
          <>
            <text x="35%" y="42%" fontSize={s * 2.2} textAnchor="middle">⭐</text>
            <text x="65%" y="42%" fontSize={s * 2.2} textAnchor="middle">⭐</text>
          </>
        );
      default: // dots
        return (
          <>
            <circle cx="38%" cy="40%" r={s} fill="#333" />
            <circle cx="62%" cy="40%" r={s} fill="#333" />
          </>
        );
    }
  };

  const renderMouth = () => {
    const scale = dims / 90;
    switch (traits.mouth) {
      case "open":
        return <ellipse cx="50%" cy="60%" rx={dims * 0.08} ry={dims * 0.06} fill="#333" />;
      case "cat":
        return (
          <path d={`M ${35 * scale},${54 * scale} Q ${45 * scale},${62 * scale} ${45 * scale},${54 * scale} M ${45 * scale},${54 * scale} Q ${45 * scale},${62 * scale} ${55 * scale},${54 * scale}`}
            fill="none" stroke="#333" strokeWidth={2} strokeLinecap="round" />
        );
      case "tongue":
        return (
          <>
            <path d={`M ${35 * scale},${54 * scale} Q ${45 * scale},${62 * scale} ${55 * scale},${54 * scale}`}
              fill="none" stroke="#333" strokeWidth={2} strokeLinecap="round" />
            <ellipse cx="50%" cy={58 * scale} rx={dims * 0.04} ry={dims * 0.035} fill="#FF6B6B" />
          </>
        );
      case "o":
        return <circle cx="50%" cy="58%" r={dims * 0.04} fill="#333" />;
      default: // smile
        return (
          <path d={`M ${35 * scale},${52 * scale} Q ${45 * scale},${62 * scale} ${55 * scale},${52 * scale}`}
            fill="none" stroke="#333" strokeWidth={2} strokeLinecap="round" />
        );
    }
  };

  const renderAccessory = () => {
    const scale = dims / 90;
    switch (traits.accessory) {
      case "hat":
        return (
          <g>
            <rect x={25 * scale} y={2 * scale} width={40 * scale} height={18 * scale} rx={4 * scale} fill={traits.bodyColor2} />
            <rect x={18 * scale} y={16 * scale} width={54 * scale} height={6 * scale} rx={3 * scale} fill={traits.bodyColor2} />
          </g>
        );
      case "bow":
        return (
          <g>
            <polygon points={`${45 * scale},${12 * scale} ${30 * scale},${4 * scale} ${30 * scale},${20 * scale}`} fill={traits.bodyColor2} />
            <polygon points={`${45 * scale},${12 * scale} ${60 * scale},${4 * scale} ${60 * scale},${20 * scale}`} fill={traits.bodyColor2} />
            <circle cx={45 * scale} cy={12 * scale} r={4 * scale} fill={traits.bodyColor2} />
          </g>
        );
      case "antenna":
        return (
          <g>
            <line x1={45 * scale} y1={18 * scale} x2={45 * scale} y2={2 * scale} stroke={traits.bodyColor2} strokeWidth={2.5} />
            <circle cx={45 * scale} cy={1 * scale} r={4 * scale} fill={traits.bodyColor2} />
          </g>
        );
      case "crown":
        return (
          <g>
            <polygon
              points={`${24 * scale},${20 * scale} ${28 * scale},${6 * scale} ${36 * scale},${14 * scale} ${45 * scale},${2 * scale} ${54 * scale},${14 * scale} ${62 * scale},${6 * scale} ${66 * scale},${20 * scale}`}
              fill="#FFEAA7" stroke="#F39C12" strokeWidth={1.5}
            />
          </g>
        );
      case "headband":
        return (
          <rect x={20 * scale} y={14 * scale} width={50 * scale} height={5 * scale} rx={2.5 * scale} fill={traits.bodyColor2} />
        );
      default:
        return null;
    }
  };

  const renderArms = () => {
    const scale = dims / 90;
    const armColor = traits.bodyColor;
    switch (traits.armStyle) {
      case 0: // Waving
        return (
          <>
            <motion.line x1={8 * scale} y1={50 * scale} x2={-4 * scale} y2={32 * scale}
              stroke={armColor} strokeWidth={4 * scale} strokeLinecap="round"
              animate={hovered ? { x2: -8 * scale, y2: 26 * scale } : {}} />
            <line x1={82 * scale} y1={50 * scale} x2={94 * scale} y2={60 * scale}
              stroke={armColor} strokeWidth={4 * scale} strokeLinecap="round" />
          </>
        );
      case 1: // Both down
        return (
          <>
            <line x1={10 * scale} y1={48 * scale} x2={-2 * scale} y2={64 * scale}
              stroke={armColor} strokeWidth={4 * scale} strokeLinecap="round" />
            <line x1={80 * scale} y1={48 * scale} x2={92 * scale} y2={64 * scale}
              stroke={armColor} strokeWidth={4 * scale} strokeLinecap="round" />
          </>
        );
      default: // T-pose
        return (
          <>
            <line x1={8 * scale} y1={45 * scale} x2={-6 * scale} y2={45 * scale}
              stroke={armColor} strokeWidth={4 * scale} strokeLinecap="round" />
            <line x1={82 * scale} y1={45 * scale} x2={96 * scale} y2={45 * scale}
              stroke={armColor} strokeWidth={4 * scale} strokeLinecap="round" />
          </>
        );
    }
  };

  const renderLegs = () => {
    const scale = dims / 90;
    const legColor = traits.bodyColor;
    switch (traits.legStyle) {
      case 0: // Standing
        return (
          <>
            <line x1={36 * scale} y1={78 * scale} x2={32 * scale} y2={92 * scale}
              stroke={legColor} strokeWidth={4 * scale} strokeLinecap="round" />
            <line x1={54 * scale} y1={78 * scale} x2={58 * scale} y2={92 * scale}
              stroke={legColor} strokeWidth={4 * scale} strokeLinecap="round" />
          </>
        );
      case 1: // Together
        return (
          <>
            <line x1={40 * scale} y1={78 * scale} x2={40 * scale} y2={92 * scale}
              stroke={legColor} strokeWidth={4 * scale} strokeLinecap="round" />
            <line x1={50 * scale} y1={78 * scale} x2={50 * scale} y2={92 * scale}
              stroke={legColor} strokeWidth={4 * scale} strokeLinecap="round" />
          </>
        );
      default: // Dancing
        return (
          <motion.g animate={hovered ? { rotate: [0, -5, 5, 0] } : {}} transition={{ duration: 0.6, repeat: Infinity }}>
            <line x1={36 * scale} y1={78 * scale} x2={28 * scale} y2={92 * scale}
              stroke={legColor} strokeWidth={4 * scale} strokeLinecap="round" />
            <line x1={54 * scale} y1={78 * scale} x2={62 * scale} y2={92 * scale}
              stroke={legColor} strokeWidth={4 * scale} strokeLinecap="round" />
          </motion.g>
        );
    }
  };

  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative cursor-pointer select-none"
      style={{ width: dims, height: dims + dims * 0.15 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.92, rotate: -3 }}
    >
      {/* Floating animation wrapper */}
      <motion.div
        className="absolute inset-0"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg width={dims} height={dims + dims * 0.12} viewBox={`-10 -5 ${dims + 20} ${dims + 15}`} overflow="visible">
          {/* Arms (behind body) */}
          {renderArms()}

          {/* Body */}
          <rect
            x={dims * 0.1} y={dims * 0.15}
            width={dims * 0.8} height={dims * 0.7}
            rx={bodyRadius === "50%" ? dims * 0.4 : bodyRadius === "28%" ? dims * 0.22 : dims * 0.3}
            fill={traits.bodyColor}
            style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" }}
          />

          {/* Belly spot */}
          <ellipse cx="50%" cy="55%" rx={dims * 0.15} ry={dims * 0.12}
            fill="white" opacity={0.15} />

          {/* Eyes */}
          {renderEyes()}

          {/* Blush */}
          {traits.hasBlush && (
            <>
              <ellipse cx="28%" cy="48%" rx={dims * 0.06} ry={dims * 0.035} fill={traits.cheekColor} />
              <ellipse cx="72%" cy="48%" rx={dims * 0.06} ry={dims * 0.035} fill={traits.cheekColor} />
            </>
          )}

          {/* Mouth */}
          {renderMouth()}

          {/* Accessory */}
          {renderAccessory()}

          {/* Legs */}
          {renderLegs()}
        </svg>
      </motion.div>

      {/* Shadow */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          bottom: -2,
          width: dims * 0.5,
          height: 5,
          background: "radial-gradient(ellipse, rgba(0,0,0,0.15), transparent)",
          filter: "blur(2px)",
        }}
        animate={{ width: hovered ? dims * 0.6 : dims * 0.4, opacity: hovered ? 0.3 : 0.2 }}
      />
    </motion.div>
  );
}
