"use client";

import { useFrame } from "@react-three/fiber";
import { Html, Sparkles } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import { Color, Group, ShaderMaterial } from "three";
import { useMemo, useRef, useState } from "react";
import type { Bot } from "@/lib/schema";

const vertexShader = `uniform float uTime;uniform float uStress;varying vec3 vN;varying float vWave;float n(vec3 p){return sin(p.x*3.1+uTime)*sin(p.y*4.3-uTime*.7)*sin(p.z*3.7+uTime*.4);}void main(){vN=normal;float w=n(position)*(0.035+uStress*.09)+sin(position.y*9.0+uTime*1.5)*.018;vWave=w;vec3 p=position+normal*w;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;
const fragmentShader = `uniform vec3 uColor;uniform float uTime;varying vec3 vN;varying float vWave;void main(){float fres=pow(1.0-abs(dot(normalize(vN),vec3(0.,0.,1.))),2.6);float bands=.5+.5*sin(vWave*80.0+uTime*1.2);vec3 c=uColor*(.28+fres*2.4+bands*.22);gl_FragColor=vec4(c,.82+fres*.18);}`;

type Props = { bot: Bot; position: [number, number, number]; onSelect: () => void };

export function BotSphere({ bot, position, onSelect }: Props) {
  const group = useRef<Group>(null);
  const [hover, setHover] = useState(false);
  const positive = bot.pnl > 2;
  const negative = bot.pnl < -2;
  const scale = 0.78 + Math.sqrt(bot.exposurePct / 100) * 0.82;
  const color = positive ? "#31f5bd" : negative ? "#d3325b" : "#79a8bb";
  const material = useMemo(
    () => new ShaderMaterial({
      transparent: true,
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uStress: { value: 0 },
        uColor: { value: new Color(color) },
      },
    }),
    [color],
  );

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uStress.value = negative ? 1 : 0;
    material.uniforms.uColor.value.lerp(new Color(color), Math.min(1, delta * 3));
    group.current.rotation.y += delta * (positive ? 0.28 : 0.05);
    group.current.position.y = position[1]
      + Math.sin(clock.elapsedTime * (negative ? 1.7 : 0.55) + position[0]) * (negative ? 0.11 : 0.04)
      + (positive ? 0.14 : negative ? -0.1 : 0);
  });

  return (
    <RigidBody type="kinematicPosition" colliders="ball">
      <group
        ref={group}
        position={position}
        scale={scale}
        onClick={(event) => { event.stopPropagation(); onSelect(); }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <mesh material={material}>
          <icosahedronGeometry args={[1, 64]} />
        </mesh>
        <mesh scale={1.03}>
          <icosahedronGeometry args={[1, 16]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.055} />
        </mesh>
        <Sparkles count={positive ? 90 : negative ? 45 : 25} scale={2.1} size={positive ? 3 : 1.4} speed={positive ? 0.8 : negative ? -0.35 : 0.08} color={color} />
        {hover && (
          <Html center distanceFactor={7}>
            <div className="glass" style={{ whiteSpace: "nowrap" }}>
              {bot.name}<br />
              <b className={positive ? "positive" : negative ? "negative" : ""}>{bot.pnl.toFixed(2)} €</b>
            </div>
          </Html>
        )}
      </group>
    </RigidBody>
  );
}
