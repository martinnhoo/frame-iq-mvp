import { useState } from "react";
import { motion } from "framer-motion";

interface Persona3DAvatarProps {
  emoji: string;
  name: string;
  gender: string;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

/**
 * A 3D-looking animated avatar for personas.
 * Uses CSS 3D transforms + framer-motion for a floating, interactive feel.
 */
export default function Persona3DAvatar({ emoji, name, gender, size = "md", onClick }: Persona3DAvatarProps) {
  const [hovered, setHovered] = useState(false);

  const dims = size === "sm" ? 56 : size === "md" ? 80 : 110;
  const emojiSize = size === "sm" ? "text-2xl" : size === "md" ? "text-4xl" : "text-5xl";

  // Generate consistent color from name
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue1 = hash % 360;
  const hue2 = (hue1 + 40) % 360;

  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative cursor-pointer select-none"
      style={{ width: dims, height: dims, perspective: 600 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* Glow */}
      <motion.div
        className="absolute inset-0 rounded-full blur-xl opacity-40"
        style={{
          background: `radial-gradient(circle, hsl(${hue1}, 70%, 50%), transparent)`,
        }}
        animate={{ opacity: hovered ? 0.6 : 0.25, scale: hovered ? 1.3 : 1 }}
        transition={{ duration: 0.4 }}
      />

      {/* 3D body/sphere */}
      <motion.div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: `linear-gradient(135deg, hsl(${hue1}, 60%, 35%), hsl(${hue2}, 50%, 20%))`,
          boxShadow: `
            inset -4px -6px 12px rgba(0,0,0,0.5),
            inset 4px 4px 12px rgba(255,255,255,0.15),
            0 8px 24px rgba(0,0,0,0.4)
          `,
          transformStyle: "preserve-3d",
        }}
        animate={{
          rotateY: hovered ? 12 : 0,
          rotateX: hovered ? -8 : 0,
          y: hovered ? -4 : 0,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        {/* Highlight arc */}
        <div
          className="absolute rounded-full"
          style={{
            top: "10%",
            left: "15%",
            width: "35%",
            height: "20%",
            background: `radial-gradient(ellipse, rgba(255,255,255,0.3), transparent)`,
            filter: "blur(4px)",
          }}
        />

        {/* Emoji face */}
        <motion.div
          className={`absolute inset-0 flex items-center justify-center ${emojiSize}`}
          animate={{
            y: hovered ? -2 : 0,
            rotateZ: hovered ? 5 : 0,
          }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          {emoji}
        </motion.div>
      </motion.div>

      {/* Floating animation */}
      <motion.div
        className="absolute inset-0"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Shadow on ground */}
      <motion.div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full"
        style={{
          width: dims * 0.6,
          height: 6,
          background: `radial-gradient(ellipse, rgba(${hue1 > 180 ? "100,150,255" : "200,100,255"},0.3), transparent)`,
          filter: "blur(3px)",
        }}
        animate={{ width: hovered ? dims * 0.7 : dims * 0.5, opacity: hovered ? 0.5 : 0.3 }}
      />
    </motion.div>
  );
}
