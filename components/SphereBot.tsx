"use client";

import { useFrame } from "@react-three/fiber";
import { Html, Sparkles } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { Color, Group, ShaderMaterial } from "three";
import { useMemo, useRef, useState } from "react";
import type { Bot } from "@/lib/schema";

const vertexShader = `uniform float uTime;uniform float uStress;varying vec3 vN;varying float vWave;float n(vec3 p){return sin(p.x*3.1+uTime)*sin(p.y*4.3-uTime*.7)*sin(p.z*3.7+uTime*.4);}void main(){vN=normal;float w=n(position)*(0.025+uStress*.11)+sin(position.y*9.0+uTime*1.5)*.012;vWave=w;vec3 p=position+normal*w;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;
const fragmentShader = `uniform vec3 uColor;uniform float uTime;varying vec3 vN;varying float vWave;void main(){float fres=pow(1.0-abs(dot(normalize(vN),vec3(0.,0.,1.))),2.6);float bands=.5+.5*sin(vWave*80.0+uTime*1.2);vec3 c=uColor*(.28+fres*2.4+bands*.22);gl_FragColor=vec4(c,.82+fres*.18);}`;

type Props = { bot: Bot; position: [number, number, number]; onSelect: () => void };

export function BotSphere({ bot, position, onSelect }: Props) {
  const group = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const flat = !bot.active || bot.state === "flat";
  const positive = !flat && bot.pnl > 0;
  const negative = !flat && bot.pnl < 0;
  const marketActivity = Math.min(2.5, bot.marketVelocity / 10);
  const emotionalVelocity = Math.min(2, Math.abs(bot.pnlVelocity) / 10);
  const scale = flat ? 0.58 : 0.68 + Math.sqrt(Math.min(100, bot.exposurePct) / 100) * 0.9;
  const color = flat ? "#66818d" : positive ? "#31f5bd" : "#8f1d3c";
  const material = useMemo(() => new ShaderMaterial({
    transparent: true,
    vertexShader,
    fragmentShader,
    uniforms: { uTime: { value: 0 }, uStress: { value: 0 }, uColor: { value: new Color(color) } },
  }), [color]);

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    material.uniforms.uTime.value = clock.elapsedTime * (1 + marketActivity * 0.8);
    material.uniforms.uStress.value = negative ? Math.min(2, 0.5 + emotionalVelocity) : 0;
    material.uniforms.uColor.value.lerp(new Color(color), Math.min(1, delta * 3));
    group.current.rotation.y += delta * (flat ? 0.02 : 0.12 + marketActivity * 0.18 + emotionalVelocity * 0.08);
    const breathing = flat ? 0.012 : negative ? 0.06 + emotionalVelocity * 0.04 : 0.025;
    const direction = positive ? 0.14 + Math.min(0.32, bot.pnl / 1000) : negative ? -0.1 - Math.min(0.18, Math.abs(bot.pnl) / 1000) : 0;
    group.current.position.y = position[1] + Math.sin(clock.elapsedTime * (flat ? 0.35 : 0.7 + marketActivity) + position[0]) * breathing + direction;
  });

  return (
    <RigidBody type="kinematicPosition" colliders="ball">
      <group ref={group} position={position} scale={scale} onClick={(event) => { event.stopPropagation(); onSelect(); }} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)}>
        <mesh material={material}><icosahedronGeometry args={[1, 5]} /></mesh>
        <mesh scale={1.03}><icosahedronGeometry args={[1, 5]} /><meshBasicMaterial color={color} wireframe transparent opacity={flat ? 0.025 : 0.055} /></mesh>
        {!flat && <Sparkles count={positive ? 90 : 55} scale={2.1} size={positive ? 3 : 1.6} speed={positive ? 0.8 + marketActivity : -(0.25 + marketActivity * 0.5)} color={color} noise={0.4} />}
        {hover && <Html center distanceFactor={7}><div className="glass" style={{ whiteSpace: "nowrap" }}>{bot.name}<br /><b className={positive ? "positive" : negative ? "negative" : ""}>{flat ? "SIN POSICIÓN" : `${bot.pnl.toFixed(2)} €`}</b></div></Html>}
      </group>
    </RigidBody>
  );
}
