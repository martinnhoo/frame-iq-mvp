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

const SKIN_COLORS = ["#FFDFC4","#F0C8A0","#D4A574","#C68642","#8D5524","#5C3A1E","#E8B89D","#F1C27D","#A0522D","#FFDBAC","#D2B48C","#6B3A2A","#E6C2A0","#B07040"];
const HAIR_COLORS = ["#1A1A1A","#2C1608","#4A3000","#8B4513","#C4682B","#D4A76A","#F0E68C","#CC3300","#E0E0E0","#FFFFFF"];
const TOP_COLORS  = ["#6C5CE7","#00B894","#E17055","#0984E3","#FDCB6E","#E84393","#00CEC9","#D63031","#636E72","#A29BFE","#2D3436","#0A3D62","#B53471","#1B9CFC","#F97F51"];
const HAIR_STYLES = ["short","curly","long","spiky","bun","mohawk","side","afro","braids","buzz","wavy","hijab","none"];
const ACCESSORY_TYPES = ["none","glasses","sunglasses","earring","headphones","beanie","bowtie","bandana","none","none"];
const FACE_SHAPES = ["oval","round","square","long"];

export default function Persona3DAvatar({ name, gender, size = "md", onClick }: Persona3DAvatarProps) {
  const dims = size === "sm" ? 64 : size === "md" ? 96 : 128;
  const safeName = name || "?";
  const hash = safeName.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const r = (o: number) => seeded(hash, o);

  const traits = useMemo(() => {
    const skin = SKIN_COLORS[Math.floor(r(1) * SKIN_COLORS.length)];
    return {
      skin,
      hair:      HAIR_COLORS[Math.floor(r(2) * HAIR_COLORS.length)],
      top:       TOP_COLORS[Math.floor(r(3) * TOP_COLORS.length)],
      hairStyle: HAIR_STYLES[Math.floor(r(4) * HAIR_STYLES.length)],
      accessory: ACCESSORY_TYPES[Math.floor(r(5) * ACCESSORY_TYPES.length)],
      eyeType:   Math.floor(r(6) * 6),
      mouthType: Math.floor(r(7) * 6),
      noseType:  Math.floor(r(8) * 5),
      topStyle:  Math.floor(r(9) * 4),
      faceShape: FACE_SHAPES[Math.floor(r(10) * FACE_SHAPES.length)],
      eyebrowType: Math.floor(r(11) * 4),
      freckles:    r(13) > 0.75,
      beauty_mark: r(14) > 0.8,
      facial_hair: (gender || "").toLowerCase() !== "female" && r(15) > 0.55
        ? ["stubble","beard","mustache","goatee"][Math.floor(r(16) * 4)]
        : "none",
    };
  }, [safeName, gender]);

  const skinDarker = useMemo(() => {
    const num = parseInt(traits.skin.slice(1), 16);
    const rv = Math.max(0, ((num >> 16) & 255) - 30);
    const g  = Math.max(0, ((num >> 8)  & 255) - 30);
    const b  = Math.max(0, (num & 255) - 30);
    return `rgb(${rv},${g},${b})`;
  }, [traits.skin]);

  const face = useMemo(() => {
    switch (traits.faceShape) {
      case "round":  return { rx: 23, ry: 23, cy: 41 };
      case "square": return { rx: 22, ry: 22, cy: 40 };
      case "long":   return { rx: 20, ry: 26, cy: 40 };
      default:       return { rx: 22, ry: 24, cy: 40 };
    }
  }, [traits.faceShape]);

  const hc = traits.hair;

  const Hair = () => {
    switch (traits.hairStyle) {
      case "short":  return <path d="M30 38 Q30 18 50 15 Q70 18 70 38 Q65 28 50 26 Q35 28 30 38Z" fill={hc}/>;
      case "curly":  return <g fill={hc}><circle cx="32" cy="28" r="8"/><circle cx="45" cy="22" r="9"/><circle cx="58" cy="22" r="9"/><circle cx="68" cy="28" r="8"/><circle cx="38" cy="18" r="7"/><circle cx="55" cy="16" r="7"/></g>;
      case "long":   return <g fill={hc}><path d="M28 38 Q28 14 50 12 Q72 14 72 38 Q68 26 50 24 Q32 26 28 38Z"/><path d="M28 38 Q24 50 26 68 Q28 58 32 48Z"/><path d="M72 38 Q76 50 74 68 Q72 58 68 48Z"/></g>;
      case "spiky":  return <g fill={hc}><polygon points="35,32 38,10 42,30"/><polygon points="43,30 47,6 51,28"/><polygon points="52,28 56,8 60,30"/><polygon points="61,30 64,14 67,34"/></g>;
      case "bun":    return <g fill={hc}><path d="M32 38 Q32 22 50 18 Q68 22 68 38 Q64 28 50 26 Q36 28 32 38Z"/><circle cx="50" cy="14" r="10"/></g>;
      case "mohawk": return <path d="M44 34 Q44 6 50 2 Q56 6 56 34 Q54 26 50 24 Q46 26 44 34Z" fill={hc}/>;
      case "side":   return <g fill={hc}><path d="M28 38 Q28 16 50 14 Q72 16 72 34 Q66 24 50 22 Q34 24 28 38Z"/><path d="M28 38 Q22 34 24 24 Q26 18 34 16 Q28 22 28 38Z"/></g>;
      case "afro":   return <ellipse cx="50" cy="30" rx="30" ry="26" fill={hc}/>;
      case "braids": return <g fill={hc}><path d="M30 36 Q30 18 50 14 Q70 18 70 36 Q66 26 50 24 Q34 26 30 36Z"/><path d="M30 36 Q28 50 26 72 Q28 68 30 50Z"/><path d="M70 36 Q72 50 74 72 Q72 68 70 50Z"/></g>;
      case "buzz":   return <path d="M30 38 Q30 22 50 19 Q70 22 70 38 Q66 32 50 30 Q34 32 30 38Z" fill={hc} opacity="0.6"/>;
      case "wavy":   return <g fill={hc}><path d="M28 38 Q28 14 50 12 Q72 14 72 38 Q68 26 50 24 Q32 26 28 38Z"/><path d="M26 38 Q22 46 28 54 Q32 46 26 38Z"/><path d="M74 38 Q78 46 72 54 Q68 46 74 38Z"/></g>;
      case "hijab":  return <g><path d="M24 42 Q24 10 50 8 Q76 10 76 42 Q76 60 70 70 L64 68 Q68 54 68 42 Q68 20 50 18 Q32 20 32 42 Q32 54 36 68 L30 70 Q24 60 24 42Z" fill={hc}/><path d="M30 70 Q34 76 50 78 Q66 76 70 70 L72 100 L28 100Z" fill={hc}/></g>;
      default: return null;
    }
  };

  const Eyes = () => {
    switch (traits.eyeType) {
      case 0: return <g><circle cx="40" cy="42" r="3.5" fill="white"/><circle cx="60" cy="42" r="3.5" fill="white"/><circle cx="40.5" cy="42.5" r="2" fill="#2C1810"/><circle cx="60.5" cy="42.5" r="2" fill="#2C1810"/><circle cx="39.5" cy="41" r="0.8" fill="white"/><circle cx="59.5" cy="41" r="0.8" fill="white"/></g>;
      case 1: return <g><circle cx="40" cy="42" r="2.2" fill="#2C1810"/><circle cx="60" cy="42" r="2.2" fill="#2C1810"/></g>;
      case 2: return <g><path d="M36 42 Q40 40 44 42" fill="none" stroke="#2C1810" strokeWidth="2" strokeLinecap="round"/><path d="M56 42 Q60 40 64 42" fill="none" stroke="#2C1810" strokeWidth="2" strokeLinecap="round"/></g>;
      case 3: return <g><ellipse cx="40" cy="42" rx="4.5" ry="5" fill="white"/><ellipse cx="60" cy="42" rx="4.5" ry="5" fill="white"/><circle cx="41" cy="43" r="2.8" fill="#2C1810"/><circle cx="61" cy="43" r="2.8" fill="#2C1810"/><circle cx="39.5" cy="40.5" r="1.2" fill="white"/><circle cx="59.5" cy="40.5" r="1.2" fill="white"/></g>;
      case 4: return <g><ellipse cx="40" cy="42" rx="4" ry="3" fill="white"/><ellipse cx="60" cy="42" rx="4" ry="3" fill="white"/><circle cx="40" cy="42" r="1.8" fill="#3B2614"/><circle cx="60" cy="42" r="1.8" fill="#3B2614"/></g>;
      default: return <g><path d="M36 42 Q40 39 44 42 Q40 43 36 42Z" fill="white"/><path d="M56 42 Q60 39 64 42 Q60 43 56 42Z" fill="white"/><circle cx="40" cy="42" r="1.5" fill="#1A1005"/><circle cx="60" cy="42" r="1.5" fill="#1A1005"/></g>;
    }
  };

  const Mouth = () => {
    switch (traits.mouthType) {
      case 0: return <path d="M43 55 Q50 62 57 55" fill="none" stroke="#5C3A2E" strokeWidth="1.8" strokeLinecap="round"/>;
      case 1: return <g><path d="M42 54 Q50 64 58 54" fill="#5C3A2E"/><path d="M44 54 Q50 58 56 54" fill="white"/></g>;
      case 2: return <path d="M46 55 Q50 59 54 55" fill="none" stroke="#5C3A2E" strokeWidth="1.5" strokeLinecap="round"/>;
      case 3: return <g><path d="M43 55 Q47 58 50 55" fill="none" stroke="#5C3A2E" strokeWidth="1.5" strokeLinecap="round"/><path d="M50 55 Q53 58 57 55" fill="none" stroke="#5C3A2E" strokeWidth="1.5" strokeLinecap="round"/></g>;
      case 4: return <g><ellipse cx="50" cy="55" rx="6" ry="3" fill="#C4756A"/><path d="M44 55 Q50 53 56 55" fill="none" stroke="#A05A50" strokeWidth="0.8"/></g>;
      default: return <line x1="45" y1="56" x2="55" y2="56" stroke="#5C3A2E" strokeWidth="1.5" strokeLinecap="round"/>;
    }
  };

  const Eyebrows = () => {
    switch (traits.eyebrowType) {
      case 0: return <g><line x1="36" y1="36" x2="44" y2="35" stroke="#3B2614" strokeWidth="1.5" strokeLinecap="round"/><line x1="56" y1="35" x2="64" y2="36" stroke="#3B2614" strokeWidth="1.5" strokeLinecap="round"/></g>;
      case 1: return <g><path d="M35 36 Q40 33 45 35" fill="none" stroke="#3B2614" strokeWidth="2.5" strokeLinecap="round"/><path d="M55 35 Q60 33 65 36" fill="none" stroke="#3B2614" strokeWidth="2.5" strokeLinecap="round"/></g>;
      case 2: return <g><path d="M36 37 Q40 32 44 35" fill="none" stroke="#3B2614" strokeWidth="1.5" strokeLinecap="round"/><path d="M56 35 Q60 32 64 37" fill="none" stroke="#3B2614" strokeWidth="1.5" strokeLinecap="round"/></g>;
      default: return <g><line x1="36" y1="35.5" x2="44" y2="35.5" stroke="#3B2614" strokeWidth="1.8" strokeLinecap="round"/><line x1="56" y1="35.5" x2="64" y2="35.5" stroke="#3B2614" strokeWidth="1.8" strokeLinecap="round"/></g>;
    }
  };

  const Top = () => {
    const tc = traits.top;
    switch (traits.topStyle) {
      case 0: return <path d="M30 72 Q30 68 36 66 L44 70 L56 70 L64 66 Q70 68 70 72 L72 100 L28 100 Z" fill={tc}/>;
      case 1: return <g><path d="M30 72 Q30 68 36 66 L44 70 L56 70 L64 66 Q70 68 70 72 L72 100 L28 100 Z" fill={tc}/><path d="M44 70 L47 78 L50 72 L53 78 L56 70" fill="white" stroke="white" strokeWidth="0.5"/></g>;
      case 2: return <g><path d="M30 72 Q30 68 36 66 L44 70 L56 70 L64 66 Q70 68 70 72 L72 100 L28 100 Z" fill={tc}/><path d="M44 70 L50 82 L56 70" fill={traits.skin}/></g>;
      default: return <path d="M28 72 Q28 66 36 64 L44 70 L56 70 L64 64 Q72 66 72 72 L74 100 L26 100 Z" fill={tc}/>;
    }
  };

  const Accessory = () => {
    switch (traits.accessory) {
      case "glasses":    return <g fill="none" stroke="#3B2614" strokeWidth="1.8"><circle cx="40" cy="42" r="6"/><circle cx="60" cy="42" r="6"/><line x1="46" y1="42" x2="54" y2="42"/><line x1="34" y1="42" x2="28" y2="40"/><line x1="66" y1="42" x2="72" y2="40"/></g>;
      case "sunglasses": return <g><rect x="33" y="38" width="14" height="9" rx="3" fill="#1A1A1A" opacity="0.85"/><rect x="53" y="38" width="14" height="9" rx="3" fill="#1A1A1A" opacity="0.85"/><line x1="47" y1="42" x2="53" y2="42" stroke="#1A1A1A" strokeWidth="1.5"/></g>;
      case "earring":    return <circle cx="28" cy="50" r="2" fill="#FFD700"/>;
      case "headphones": return <g><path d="M26 40 Q26 18 50 16 Q74 18 74 40" fill="none" stroke="#555" strokeWidth="3"/><rect x="22" y="36" width="6" height="10" rx="3" fill="#555"/><rect x="72" y="36" width="6" height="10" rx="3" fill="#555"/></g>;
      case "beanie":     return <g><path d="M28 36 Q28 14 50 12 Q72 14 72 36 L70 38 L30 38 Z" fill={traits.top} opacity="0.9"/><rect x="28" y="34" width="44" height="5" rx="2" fill={traits.top}/></g>;
      case "bowtie":     return <g><polygon points="44,70 38,66 38,74" fill="#E84393"/><polygon points="56,70 62,66 62,74" fill="#E84393"/><circle cx="50" cy="70" r="2.5" fill="#C73078"/></g>;
      default: return null;
    }
  };

  const FacialHair = () => {
    if (traits.facial_hair === "none") return null;
    switch (traits.facial_hair) {
      case "beard":    return <path d="M36 54 Q36 68 50 72 Q64 68 64 54" fill={hc} opacity="0.35"/>;
      case "mustache": return <path d="M42 52 Q46 55 50 52 Q54 55 58 52" fill={hc} opacity="0.5"/>;
      case "goatee":   return <path d="M46 55 Q50 58 54 55 L53 64 Q50 66 47 64Z" fill={hc} opacity="0.4"/>;
      default: return null;
    }
  };

  const Nose = () => {
    switch (traits.noseType) {
      case 0: return <circle cx="50" cy="49" r="1.5" fill={skinDarker}/>;
      case 1: return <path d="M48 48 L50 51 L52 48" fill="none" stroke={skinDarker} strokeWidth="1.5" strokeLinecap="round"/>;
      case 2: return <ellipse cx="50" cy="49" rx="2.5" ry="1.5" fill={skinDarker}/>;
      default: return <path d="M50 45 L48 50 L52 50Z" fill={skinDarker} opacity="0.4"/>;
    }
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
        viewBox="0 0 100 120"
        style={{ overflow: "visible", filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.2))" }}
      >
        <Top/>
        <rect x="44" y="62" width="12" height="10" rx="4" fill={traits.skin}/>
        <ellipse cx="50" cy={face.cy} rx={face.rx} ry={face.ry} fill={traits.skin}/>
        {traits.hairStyle !== "hijab" && <Hair/>}
        <Eyes/>
        <Eyebrows/>
        <Nose/>
        {traits.freckles && (
          <g opacity="0.3" fill={skinDarker}>
            <circle cx="37" cy="48" r="0.6"/><circle cx="39" cy="50" r="0.5"/>
            <circle cx="61" cy="48" r="0.6"/><circle cx="63" cy="50" r="0.5"/>
          </g>
        )}
        {traits.beauty_mark && <circle cx="58" cy="52" r="1" fill="#3B2614" opacity="0.6"/>}
        <Mouth/>
        <FacialHair/>
        <g opacity="0.2">
          <ellipse cx="34" cy="52" rx="4" ry="2.5" fill="#FF8A8A"/>
          <ellipse cx="66" cy="52" rx="4" ry="2.5" fill="#FF8A8A"/>
        </g>
        <Accessory/>
        {traits.hairStyle === "hijab" && <Hair/>}
      </svg>
    </div>
  );
}
