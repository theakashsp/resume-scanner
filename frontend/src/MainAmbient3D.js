import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

function AmbientParticles() {
  const ref = useRef();
  const positions = useMemo(() => {
    const count = 280;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 24;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.007;
    ref.current.rotation.x -= delta * 0.002;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#3b82f6" size={0.045} transparent opacity={0.28} depthWrite={false} />
    </points>
  );
}

function AmbientArcs() {
  const ref = useRef();
  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.z += delta * 0.01;
    ref.current.rotation.y -= delta * 0.015;
  });

  return (
    <group ref={ref} position={[0, 0, -5.5]}>
      <mesh rotation={[0.8, 0.2, 0.1]} scale={3.8}>
        <torusGeometry args={[1, 0.02, 12, 140]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.12} />
      </mesh>
      <mesh rotation={[1.1, 0.8, 0.3]} scale={5.3}>
        <torusGeometry args={[1, 0.015, 12, 140]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

export default function MainAmbient3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 45 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      dpr={[1, 1.8]}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <AmbientArcs />
      <AmbientParticles />
    </Canvas>
  );
}
