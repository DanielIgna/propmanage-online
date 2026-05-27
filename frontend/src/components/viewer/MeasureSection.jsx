// Digital Twin viewer — Phase D tools: Tape Measure markers + 3D line/label.
import React from "react";
import { Html } from "@react-three/drei";

export const MeasureMarkers = ({ points }) => {
  if (!points.length) return null;
  return (
    <>
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshBasicMaterial color={i === 0 ? 0x22d3ee : 0xfacc15} />
        </mesh>
      ))}
      {points.length === 2 && (
        <line>
          <bufferGeometry attach="geometry">
            <bufferAttribute
              attach="attributes-position"
              array={new Float32Array([...points[0].toArray(), ...points[1].toArray()])}
              count={2}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial attach="material" color={0xfacc15} linewidth={3} />
        </line>
      )}
      {points.length === 2 && (
        <Html
          position={points[0].clone().lerp(points[1], 0.5).toArray()}
          center
          distanceFactor={10}
          style={{ pointerEvents: "none" }}
        >
          <div className="px-2.5 py-1 rounded-full bg-amber-400 text-stone-900 text-xs font-semibold whitespace-nowrap shadow-lg">
            {points[0].distanceTo(points[1]).toFixed(2)} m
          </div>
        </Html>
      )}
    </>
  );
};
