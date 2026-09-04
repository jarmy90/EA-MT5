"use client";

import { Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, Environment, Preload, Sparkles } from "@react-three/drei";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { Physics } from "@react-three/rapier";
import { Vector2, Vector3 } from "three";
import { BotSphere } from "./SphereBot";
import { useTelemetry } from "./WebSocketProvider";

const POSITIONS: [[number, number, number], [number, number, number], [number, number, number], [number, number, number]] = [
  [-3, 1, 0],
  [3, 1, -1],
  [-2.7, -2, -1],
  [2.8, -1.8, 0.5],
];

function CameraRig() {
  const { camera } = useThree();
  const { data, selected, cinema } = useTelemetry();

  useFrame(({ clock }, delta) => {
    const target = new Vector3(0, 0, 9);
    if (selected && data) {
      const index = data.bots.findIndex((bot) => bot.id === selected);
      const position = POSITIONS[index];
      if (position) target.set(position[0] * 0.55, position[1] * 0.55, 5.2);
    } else if (cinema) {
      const index = Math.floor(clock.elapsedTime / 6) % 4;
      const position = POSITIONS[index];
      target.set(position[0] * 0.45, position[1] * 0.45, 6.1);
    }
    camera.position.lerp(target, 1 - Math.exp(-delta * 1.8));
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function World() {
  const { data, setSelected } = useTelemetry();
  const bots = data?.bots ?? [];
  const aberration = useMemo(() => new Vector2(0.00035, 0.00035), []);

  return (
    <>
      <color attach="background" args={["#010205"]} />
      <fog attach="fog" args={["#010205", 7, 22]} />
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 2, 5]} intensity={7} color="#80dfff" />
      <Environment preset="night" />
      <Sparkles count={700} scale={[18, 12, 12]} size={1.1} speed={0.08} opacity={0.3} />
      <Physics gravity={[0, 0, 0]} timeStep="vary">
        <group>
          {bots.map((bot, index) => {
            const position = POSITIONS[index];
            return position ? <BotSphere key={bot.id} bot={bot} position={position} onSelect={() => setSelected(bot.id)} /> : null;
          })}
        </group>
      </Physics>
      <CameraRig />
      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={1.8} luminanceThreshold={0.12} radius={0.85} />
        <ChromaticAberration offset={aberration} radialModulation />
        <Noise opacity={0.025} />
        <Vignette eskil={false} offset={0.2} darkness={0.82} />
      </EffectComposer>
      <Preload all />
    </>
  );
}

export function Scene() {
  return (
    <Canvas dpr={[1, 1.7]} gl={{ antialias: false, powerPreference: "high-performance" }} camera={{ position: [0, 0, 9], fov: 48 }}>
      <Suspense fallback={null}>
        <World />
        <AdaptiveDpr pixelated />
      </Suspense>
    </Canvas>
  );
}
