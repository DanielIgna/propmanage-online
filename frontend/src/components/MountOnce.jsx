// MountOnce — renders children only after the second StrictMode mount
// has completed. This sidesteps the @react-three/fiber 9.6.1 + React 19
// `applyProps: Cannot set "x-line-number"` bug that fires during the
// double-mount reconciliation in dev.
import React, { useEffect, useState } from "react";

export const MountOnce = ({ children, fallback = null }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Use rAF + microtask so we land after StrictMode's second mount.
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  return ready ? children : fallback;
};

export default MountOnce;
