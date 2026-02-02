"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export function MagnetizeButton({
  children,
  className = "",
  particleCount = 12,
  attractRadius = 48,
  particleColor = "bg-brand-cream/70",
  onMagnet,
}) {
  const containerRef = useRef(null);
  const [active, setActive] = useState(false);

  const x = useSpring(0, { stiffness: 240, damping: 18 });
  const y = useSpring(0, { stiffness: 240, damping: 18 });

  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    setMounted(true);
    setParticles(
      Array.from({ length: particleCount }).map((_, index) => ({
        id: `particle-${index}`,
        baseX: randomBetween(-attractRadius, attractRadius),
        baseY: randomBetween(-attractRadius, attractRadius),
        size: randomBetween(3, 6),
        delay: randomBetween(0, 0.12),
      }))
    );
  }, [particleCount, attractRadius]);

  const handleMove = (event) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = event.clientX - (rect.left + rect.width / 2);
    const offsetY = event.clientY - (rect.top + rect.height / 2);
    x.set(offsetX * 0.25);
    y.set(offsetY * 0.25);
    if (onMagnet) {
      onMagnet({ x: offsetX, y: offsetY, active: true });
    }
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
    setActive(false);
    if (onMagnet) {
      onMagnet({ x: 0, y: 0, active: false });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex ${className}`}
      onMouseMove={handleMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={handleLeave}
    >
      <motion.div style={{ x, y }} className="relative z-10">
        {children}
      </motion.div>

      {mounted &&
        particles.map((particle) => (
        <MagnetParticle
          key={particle.id}
          particle={particle}
          active={active}
          x={x}
          y={y}
          particleColor={particleColor}
        />
      ))}
    </div>
  );
}

function MagnetParticle({ particle, active, x, y, particleColor }) {
  const px = useTransform(x, (value) => value + particle.baseX);
  const py = useTransform(y, (value) => value + particle.baseY);

  return (
    <motion.span
      className={`pointer-events-none absolute left-1/2 top-1/2 rounded-full ${particleColor}`}
      style={{
        width: particle.size,
        height: particle.size,
        marginLeft: -particle.size / 2,
        marginTop: -particle.size / 2,
        x: px,
        y: py,
      }}
      animate={active ? { opacity: 0.9, scale: 1 } : { opacity: 0, scale: 0.6 }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 16,
        delay: particle.delay,
      }}
    />
  );
}
