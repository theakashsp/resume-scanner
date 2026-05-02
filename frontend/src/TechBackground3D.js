import { useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Float, Line } from '@react-three/drei';

const CYBER = '#3b82f6';
const NEON = '#8b5cf6';

/** Read-only mouse target for parallax (updated on window mousemove — no React rerenders). */
function useWindowMouseTarget() {
  const mouse = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);
  return mouse;
}

function SkillNetwork({ mouse }) {
  const root = useRef();

  const { nodePositions, linePairs } = useMemo(() => {
    const count = 12;
    const nodes = [];
    for (let i = 0; i < count; i++) {
      const t = (i / count) * Math.PI * 2;
      const u = Math.acos(1 - (2 * (i + 0.5)) / count);
      const r = 2.0 + (i % 4) * 0.2;
      nodes.push([
        r * Math.sin(u) * Math.cos(t),
        r * Math.cos(u) * 0.85,
        r * Math.sin(u) * Math.sin(t),
      ]);
    }
    const pairs = [];
    for (let i = 0; i < nodes.length; i++) {
      pairs.push([nodes[i], nodes[(i + 1) % nodes.length]]);
      pairs.push([nodes[i], nodes[(i + 4) % nodes.length]]);
      pairs.push([nodes[i], nodes[(i + 7) % nodes.length]]);
    }
    return { nodePositions: nodes, linePairs: pairs };
  }, []);

  useFrame((_, delta) => {
    if (!root.current) return;
    root.current.rotation.y += delta * 0.042;
    const tx = mouse.current.x * 0.2;
    const ty = mouse.current.y * 0.14;
    root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, ty, delta * 1.6);
    root.current.rotation.y += tx * delta * 0.12;
  });

  return (
    <group ref={root}>
      {linePairs.map((pair, i) => (
        <Line
          key={i}
          points={[pair[0], pair[1]]}
          color={NEON}
          lineWidth={1}
          transparent
          opacity={0.18}
        />
      ))}
      {nodePositions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshBasicMaterial
            color={CYBER}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  );
}

function TechOrnaments({ mouse }) {
  const g1 = useRef();
  const g2 = useRef();

  useFrame((_, delta) => {
    const tx = mouse.current.x * 0.22;
    const ty = mouse.current.y * 0.16;
    if (g1.current) {
      g1.current.rotation.x += delta * 0.035;
      g1.current.rotation.y += delta * 0.065;
      g1.current.rotation.x = THREE.MathUtils.lerp(g1.current.rotation.x, ty, delta * 1.2);
      g1.current.rotation.z = THREE.MathUtils.lerp(g1.current.rotation.z, tx * 0.4, delta * 1.2);
    }
    if (g2.current) {
      g2.current.rotation.y -= delta * 0.05;
      g2.current.rotation.z += delta * 0.018;
      g2.current.rotation.x = THREE.MathUtils.lerp(g2.current.rotation.x, -ty * 0.35, delta * 1.0);
    }
  });

  return (
    <>
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.35}>
        <group ref={g1} position={[-1.8, 0.4, -0.5]} scale={0.65}>
          <mesh>
            <icosahedronGeometry args={[1.15, 1]} />
            <meshBasicMaterial color={CYBER} wireframe transparent opacity={0.2} />
          </mesh>
        </group>
      </Float>
      <Float speed={0.9} rotationIntensity={0.12} floatIntensity={0.28}>
        <group ref={g2} position={[1.6, -0.3, 0.2]} scale={0.55}>
          <mesh>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={NEON} wireframe transparent opacity={0.18} />
          </mesh>
        </group>
      </Float>
    </>
  );
}

function Scene({ mouse }) {
  return (
    <>
      <SkillNetwork mouse={mouse} />
      <TechOrnaments mouse={mouse} />
    </>
  );
}

/**
 * Premium hero backdrop: skill graph + floating tech solids, mouse parallax via window coords.
 * Parent should use pointer-events: none so uploads stay clickable.
 */
export default function TechBackground3D() {
  const mouse = useWindowMouseTarget();

  return (
    <Canvas
      camera={{ position: [0, 0, 7.8], fov: 42 }}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      }}
      dpr={[1, 2]}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <Scene mouse={mouse} />
    </Canvas>
  );
}
