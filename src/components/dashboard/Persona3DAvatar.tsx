import { useMemo } from "react";

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

const SKIN_TONES = [
  { base: "#FFDFC4", shadow: "#E8C5A5", blush: "#FFB8B8" },
  { base: "#F0C8A0", shadow: "#D4AD85", blush: "#E8A090" },
  { base: "#D4A574", shadow: "#B88A5C", blush: "#C8907A" },
  { base: "#C68642", shadow: "#A86E30", blush: "#B87858" },
  { base: "#8D5524", shadow: "#724418", blush: "#7D4A38" },
  { base: "#5C3A1E", shadow: "#482E14", blush: "#5A3828" },
  { base: "#E8B89D", shadow: "#CC9D82", blush: "#D8A090" },
  { base: "#F1C27D", shadow: "#D4A664", blush: "#E0A878" },
  { base: "#A0522D", shadow: "#884420", blush: "#904840" },
  { base: "#FFDBAC", shadow: "#E4C094", blush: "#F0B8A8" },
  { base: "#D2B48C", shadow: "#B89970", blush: "#C0A080" },
  { base: "#6B3A2A", shadow: "#562E1E", blush: "#603830" },
];

const HAIR_COLORS = [
  "#1A1110", "#2C1608", "#3D2200", "#6B3510", "#8B5E3C",
  "#C4862B", "#D4A76A", "#E8D5A0", "#A03020", "#E0E0E0",
];

const TOP_COLORS = [
  "#6C5CE7", "#00B894", "#E17055", "#0984E3", "#FDCB6E",
  "#E84393", "#00CEC9", "#D63031", "#636E72", "#A29BFE",
  "#2D3436", "#0A3D62", "#B53471", "#1B9CFC", "#F97F51",
];

const HAIR_STYLES = [
  "short", "curly", "long", "spiky", "bun", "mohawk",
  "side", "afro", "braids", "buzz", "wavy", "hijab", "none",
];

const ACCESSORY_TYPES = [
  "none", "glasses", "sunglasses", "earring", "headphones",
  "beanie", "none", "none", "none", "none",
];

export default function Persona3DAvatar({ name, gender, size = "md", onClick }: Persona3DAvatarProps) {
  const dims = size === "sm" ? 64 : size === "md" ? 96 : 128;
  const safeName = name || "?";
  const hash = safeName.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const r = (o: number) => seeded(hash, o);

  const traits = useMemo(() => {
    const skinIdx = Math.floor(r(1) * SKIN_TONES.length);
    const g = (gender || "").toLowerCase();
    const isFemale = g.includes("female") || g.includes("feminino") || g.includes("mujer") || g.includes("mulher");
    return {
      skin: SKIN_TONES[skinIdx],
      hair: HAIR_COLORS[Math.floor(r(2) * HAIR_COLORS.length)],
      top: TOP_COLORS[Math.floor(r(3) * TOP_COLORS.length)],
      hairStyle: HAIR_STYLES[Math.floor(r(4) * HAIR_STYLES.length)],
      accessory: ACCESSORY_TYPES[Math.floor(r(5) * ACCESSORY_TYPES.length)],
      eyeType: Math.floor(r(6) * 4),
      mouthType: Math.floor(r(7) * 4),
      noseType: Math.floor(r(8) * 3),
      topStyle: Math.floor(r(9) * 3),
      eyebrowThick: r(11) > 0.5,
      freckles: r(13) > 0.8,
      facialHair: !isFemale && r(15) > 0.6
        ? ["stubble", "beard", "mustache"][Math.floor(r(16) * 3)]
        : "none",
      isFemale,
      earSize: 3 + r(17) * 2,
    };
  }, [safeName, gender]);

  const { skin, hair: hc, top: tc } = traits;

  // Gradient IDs unique per instance
  const gid = `pa${hash}`;

  const Hair = () => {
    switch (traits.hairStyle) {
      case "short":
        return <path d="M26 44 Q26 18 50 14 Q74 18 74 44 Q70 30 50 27 Q30 30 26 44Z" fill={hc} />;
      case "curly":
        return (
          <g fill={hc}>
            <circle cx="30" cy="30" r="9" /><circle cx="44" cy="22" r="10" />
            <circle cx="56" cy="22" r="10" /><circle cx="70" cy="30" r="9" />
            <circle cx="37" cy="18" r="8" /><circle cx="55" cy="15" r="8" />
            <circle cx="63" cy="18" r="8" />
          </g>
        );
      case "long":
        return (
          <g fill={hc}>
            <path d="M24 44 Q24 14 50 10 Q76 14 76 44 Q72 26 50 23 Q28 26 24 44Z" />
            <path d="M24 44 Q20 56 22 76 Q26 64 30 52Z" opacity="0.85" />
            <path d="M76 44 Q80 56 78 76 Q74 64 70 52Z" opacity="0.85" />
          </g>
        );
      case "spiky":
        return (
          <g fill={hc}>
            <polygon points="33,34 37,8 41,30" /><polygon points="42,28 47,4 52,26" />
            <polygon points="50,26 55,6 60,28" /><polygon points="59,30 63,12 67,34" />
          </g>
        );
      case "bun":
        return (
          <g fill={hc}>
            <path d="M28 42 Q28 20 50 16 Q72 20 72 42 Q68 28 50 26 Q32 28 28 42Z" />
            <circle cx="50" cy="12" r="11" />
          </g>
        );
      case "mohawk":
        return <path d="M42 36 Q42 4 50 0 Q58 4 58 36 Q56 24 50 22 Q44 24 42 36Z" fill={hc} />;
      case "side":
        return (
          <g fill={hc}>
            <path d="M24 42 Q24 16 50 12 Q76 16 76 36 Q70 24 50 22 Q30 24 24 42Z" />
            <path d="M24 42 Q18 36 20 24 Q24 16 32 14 Q24 22 24 42Z" />
          </g>
        );
      case "afro":
        return <ellipse cx="50" cy="30" rx="32" ry="28" fill={hc} />;
      case "braids":
        return (
          <g fill={hc}>
            <path d="M26 40 Q26 16 50 12 Q74 16 74 40 Q70 26 50 24 Q30 26 26 40Z" />
            <path d="M26 40 Q24 56 22 78 Q26 72 28 54Z" />
            <path d="M74 40 Q76 56 78 78 Q74 72 72 54Z" />
          </g>
        );
      case "buzz":
        return <path d="M28 42 Q28 20 50 17 Q72 20 72 42 Q68 32 50 30 Q32 32 28 42Z" fill={hc} opacity="0.5" />;
      case "wavy":
        return (
          <g fill={hc}>
            <path d="M24 42 Q24 14 50 10 Q76 14 76 42 Q72 26 50 23 Q28 26 24 42Z" />
            <path d="M22 42 Q18 52 24 60 Q28 50 22 42Z" />
            <path d="M78 42 Q82 52 76 60 Q72 50 78 42Z" />
          </g>
        );
      case "hijab":
        return (
          <g>
            <path d="M20 46 Q20 8 50 5 Q80 8 80 46 Q80 64 74 74 L68 72 Q72 56 72 46 Q72 18 50 16 Q28 18 28 46 Q28 56 32 72 L26 74 Q20 64 20 46Z" fill={hc} />
            <path d="M26 74 Q30 82 50 84 Q70 82 74 74 L76 100 L24 100Z" fill={hc} />
          </g>
        );
      default:
        return null;
    }
  };

  const Eyes = () => {
    const eyeWhite = "rgba(255,255,255,0.95)";
    const iris = ["#2C1810", "#4A6741", "#3B6B9A", "#5C4033"][traits.eyeType % 4];
    switch (traits.eyeType) {
      case 0: // Round expressive
        return (
          <g>
            <ellipse cx="39" cy="46" rx="5" ry="4.5" fill={eyeWhite} />
            <ellipse cx="61" cy="46" rx="5" ry="4.5" fill={eyeWhite} />
            <circle cx="39.5" cy="46.5" r="2.8" fill={iris} />
            <circle cx="61.5" cy="46.5" r="2.8" fill={iris} />
            <circle cx="39.5" cy="46.5" r="1.4" fill="#0D0805" />
            <circle cx="61.5" cy="46.5" r="1.4" fill="#0D0805" />
            <circle cx="38" cy="44.5" r="1" fill="white" opacity="0.9" />
            <circle cx="60" cy="44.5" r="1" fill="white" opacity="0.9" />
            {/* Eyelids */}
            <path d="M33 44 Q39 41.5 45 44" fill="none" stroke={skin.shadow} strokeWidth="1" />
            <path d="M55 44 Q61 41.5 67 44" fill="none" stroke={skin.shadow} strokeWidth="1" />
          </g>
        );
      case 1: // Almond
        return (
          <g>
            <path d="M34 46 Q39 42 44 46 Q39 49 34 46Z" fill={eyeWhite} />
            <path d="M56 46 Q61 42 66 46 Q61 49 56 46Z" fill={eyeWhite} />
            <circle cx="39" cy="46" r="2.2" fill={iris} />
            <circle cx="61" cy="46" r="2.2" fill={iris} />
            <circle cx="39" cy="46" r="1.1" fill="#0D0805" />
            <circle cx="61" cy="46" r="1.1" fill="#0D0805" />
            <circle cx="38" cy="45" r="0.7" fill="white" opacity="0.8" />
            <circle cx="60" cy="45" r="0.7" fill="white" opacity="0.8" />
          </g>
        );
      case 2: // Relaxed / happy
        return (
          <g>
            <path d="M35 46 Q39 43 43 46" fill="none" stroke="#2C1810" strokeWidth="2" strokeLinecap="round" />
            <path d="M57 46 Q61 43 65 46" fill="none" stroke="#2C1810" strokeWidth="2" strokeLinecap="round" />
          </g>
        );
      default: // Wide
        return (
          <g>
            <ellipse cx="39" cy="46" rx="5.5" ry="5.5" fill={eyeWhite} />
            <ellipse cx="61" cy="46" rx="5.5" ry="5.5" fill={eyeWhite} />
            <circle cx="40" cy="47" r="3.2" fill={iris} />
            <circle cx="62" cy="47" r="3.2" fill={iris} />
            <circle cx="40" cy="47" r="1.6" fill="#0D0805" />
            <circle cx="62" cy="47" r="1.6" fill="#0D0805" />
            <circle cx="38.5" cy="44.5" r="1.3" fill="white" opacity="0.85" />
            <circle cx="60.5" cy="44.5" r="1.3" fill="white" opacity="0.85" />
          </g>
        );
    }
  };

  const Eyebrows = () => {
    const bw = traits.eyebrowThick ? 2.5 : 1.8;
    const bc = hc === "#1A1110" || hc === "#2C1608" ? "#2A1A10" : hc;
    return (
      <g stroke={bc} strokeWidth={bw} strokeLinecap="round" fill="none" opacity="0.8">
        <path d="M34 39 Q39 36 44 38" />
        <path d="M56 38 Q61 36 66 39" />
      </g>
    );
  };

  const Nose = () => {
    switch (traits.noseType) {
      case 0:
        return <path d="M48 52 Q50 55 52 52" fill="none" stroke={skin.shadow} strokeWidth="1.5" strokeLinecap="round" />;
      case 1:
        return <ellipse cx="50" cy="52.5" rx="3" ry="2" fill={skin.shadow} opacity="0.35" />;
      default:
        return (
          <g>
            <path d="M49 48 L47 53 Q50 55 53 53 L51 48" fill={skin.shadow} opacity="0.2" />
            <path d="M47 53 Q50 55 53 53" fill="none" stroke={skin.shadow} strokeWidth="1" strokeLinecap="round" />
          </g>
        );
    }
  };

  const Mouth = () => {
    switch (traits.mouthType) {
      case 0: // Smile
        return (
          <g>
            <path d="M42 59 Q50 67 58 59" fill="#C4655A" />
            <path d="M43 59 Q50 63 57 59" fill="white" opacity="0.9" />
          </g>
        );
      case 1: // Gentle smile
        return <path d="M43 60 Q50 65 57 60" fill="none" stroke="#9B5A50" strokeWidth="2" strokeLinecap="round" />;
      case 2: // Smirk
        return <path d="M44 60 Q48 62 55 58" fill="none" stroke="#9B5A50" strokeWidth="1.8" strokeLinecap="round" />;
      default: // Neutral-happy
        return (
          <g>
            <path d="M44 60 Q50 64 56 60" fill="#C4655A" opacity="0.7" />
            <path d="M44 60 Q50 58 56 60" fill="none" stroke="#A85A50" strokeWidth="0.6" />
          </g>
        );
    }
  };

  const FacialHair = () => {
    if (traits.facialHair === "none") return null;
    switch (traits.facialHair) {
      case "beard":
        return <path d="M34 58 Q34 74 50 78 Q66 74 66 58" fill={hc} opacity="0.3" />;
      case "mustache":
        return <path d="M41 56 Q45 59 50 56 Q55 59 59 56" fill={hc} opacity="0.45" />;
      default: // stubble
        return (
          <g opacity="0.15" fill={hc}>
            <rect x="36" y="56" width="28" height="14" rx="6" />
          </g>
        );
    }
  };

  const Top = () => {
    const topDarker = tc + "CC";
    switch (traits.topStyle) {
      case 0: // Crew neck
        return (
          <g>
            <path d="M26 78 Q26 72 34 70 L42 74 Q50 76 58 74 L66 70 Q74 72 74 78 L76 100 L24 100Z" fill={tc} />
            <path d="M42 74 Q50 76 58 74" fill="none" stroke={topDarker} strokeWidth="1" />
          </g>
        );
      case 1: // V-neck
        return (
          <g>
            <path d="M26 78 Q26 72 34 70 L42 74 L50 82 L58 74 L66 70 Q74 72 74 78 L76 100 L24 100Z" fill={tc} />
            <path d="M42 74 L50 82 L58 74" fill={skin.base} stroke={topDarker} strokeWidth="0.5" />
          </g>
        );
      default: // Collared
        return (
          <g>
            <path d="M26 78 Q26 72 34 70 L42 74 Q50 76 58 74 L66 70 Q74 72 74 78 L76 100 L24 100Z" fill={tc} />
            <path d="M42 74 L38 68 L42 74 Q50 76 58 74 L62 68 L58 74" fill={tc} stroke="white" strokeWidth="0.8" opacity="0.4" />
          </g>
        );
    }
  };

  const Accessory = () => {
    switch (traits.accessory) {
      case "glasses":
        return (
          <g fill="none" stroke="#4A4040" strokeWidth="1.5" opacity="0.8">
            <rect x="32" y="42" width="14" height="10" rx="5" />
            <rect x="54" y="42" width="14" height="10" rx="5" />
            <line x1="46" y1="47" x2="54" y2="47" />
            <line x1="32" y1="47" x2="26" y2="44" />
            <line x1="68" y1="47" x2="74" y2="44" />
          </g>
        );
      case "sunglasses":
        return (
          <g>
            <rect x="31" y="42" width="16" height="10" rx="4" fill="#1A1A1A" opacity="0.8" />
            <rect x="53" y="42" width="16" height="10" rx="4" fill="#1A1A1A" opacity="0.8" />
            <line x1="47" y1="47" x2="53" y2="47" stroke="#1A1A1A" strokeWidth="1.5" />
            <line x1="31" y1="47" x2="26" y2="44" stroke="#1A1A1A" strokeWidth="1.5" />
            <line x1="69" y1="47" x2="74" y2="44" stroke="#1A1A1A" strokeWidth="1.5" />
          </g>
        );
      case "earring":
        return <circle cx="24" cy="54" r="2.5" fill="#FFD700" opacity="0.8" />;
      case "headphones":
        return (
          <g opacity="0.7">
            <path d="M22 44 Q22 16 50 14 Q78 16 78 44" fill="none" stroke="#555" strokeWidth="3.5" />
            <rect x="18" y="40" width="7" height="12" rx="3.5" fill="#444" />
            <rect x="75" y="40" width="7" height="12" rx="3.5" fill="#444" />
          </g>
        );
      case "beanie":
        return (
          <g>
            <path d="M24 40 Q24 12 50 8 Q76 12 76 40 L74 42 L26 42Z" fill={tc} opacity="0.85" />
            <rect x="24" y="38" width="52" height="6" rx="3" fill={tc} />
            <circle cx="50" cy="8" r="4" fill={tc} />
          </g>
        );
      default:
        return null;
    }
  };

  const Ears = () => {
    const es = traits.earSize;
    if (traits.hairStyle === "afro" || traits.hairStyle === "hijab") return null;
    return (
      <g>
        <ellipse cx={26} cy={48} rx={es} ry={es + 1} fill={skin.base} />
        <ellipse cx={74} cy={48} rx={es} ry={es + 1} fill={skin.base} />
        <ellipse cx={26} cy={48} rx={es - 1.2} ry={es - 0.5} fill={skin.shadow} opacity="0.25" />
        <ellipse cx={74} cy={48} rx={es - 1.2} ry={es - 0.5} fill={skin.shadow} opacity="0.25" />
      </g>
    );
  };

  return (
    <div
      onClick={onClick}
      className="relative select-none transition-transform duration-200 hover:scale-105 cursor-pointer"
      style={{ width: dims, height: dims }}
    >
      <svg
        width={dims}
        height={dims}
        viewBox="0 0 100 110"
        style={{ overflow: "visible", filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.3))" }}
      >
        <defs>
          {/* Skin gradient for depth */}
          <radialGradient id={`${gid}-skin`} cx="45%" cy="35%" r="60%">
            <stop offset="0%" stopColor={skin.base} />
            <stop offset="100%" stopColor={skin.shadow} />
          </radialGradient>
          {/* Background circle */}
          <radialGradient id={`${gid}-bg`} cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </radialGradient>
        </defs>

        {/* Background circle */}
        <circle cx="50" cy="55" r="48" fill={`url(#${gid}-bg)`} />

        {/* Body / top */}
        <Top />

        {/* Neck */}
        <rect x="43" y="66" width="14" height="8" rx="5" fill={skin.base} />
        <rect x="44" y="66" width="12" height="4" rx="4" fill={skin.shadow} opacity="0.12" />

        {/* Ears */}
        <Ears />

        {/* Head */}
        <ellipse cx="50" cy="44" rx="24" ry="26" fill={`url(#${gid}-skin)`} />

        {/* Hair behind for certain styles */}
        {traits.hairStyle !== "hijab" && <Hair />}

        {/* Eyes */}
        <Eyes />

        {/* Eyebrows */}
        <Eyebrows />

        {/* Nose */}
        <Nose />

        {/* Cheek blush */}
        <ellipse cx="33" cy="54" rx="5" ry="3" fill={skin.blush} opacity="0.15" />
        <ellipse cx="67" cy="54" rx="5" ry="3" fill={skin.blush} opacity="0.15" />

        {/* Freckles */}
        {traits.freckles && (
          <g opacity="0.25" fill={skin.shadow}>
            <circle cx="35" cy="52" r="0.7" /><circle cx="37" cy="54" r="0.6" /><circle cx="34" cy="55" r="0.5" />
            <circle cx="63" cy="52" r="0.7" /><circle cx="65" cy="54" r="0.6" /><circle cx="66" cy="55" r="0.5" />
          </g>
        )}

        {/* Mouth */}
        <Mouth />

        {/* Facial hair */}
        <FacialHair />

        {/* Accessories */}
        <Accessory />

        {/* Hijab rendered on top */}
        {traits.hairStyle === "hijab" && <Hair />}
      </svg>
    </div>
  );
}
