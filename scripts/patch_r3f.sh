#!/bin/bash
# Patch react-three-fiber to ignore Emergent's preview JSX annotation props (x-*).
# These are injected as DOM-style props on every JSX element (x-file-name, x-line-number, etc.)
# and R3F treats them as "pierced" Three.js props, throwing on mount.
# Run after every `yarn install` / `yarn add` that touches @react-three/fiber.
set -e
FIBER_DIR="/app/frontend/node_modules/@react-three/fiber/dist"
if [ ! -d "$FIBER_DIR" ]; then
  echo "Skipping: @react-three/fiber not installed."
  exit 0
fi
for f in "$FIBER_DIR"/events-*.{cjs.dev.js,cjs.prod.js,esm.js}; do
  [ -f "$f" ] || continue
  # Add __source/__self to REACT_INTERNAL_PROPS if missing.
  grep -q "'__source', '__self'" "$f" || sed -i "s/const REACT_INTERNAL_PROPS = \['children', 'key', 'ref'\];/const REACT_INTERNAL_PROPS = ['children', 'key', 'ref', '__source', '__self'];/g" "$f"
  # Ignore all "x-*" props in diffProps and applyProps.
  grep -q "prop.startsWith('x-')" "$f" || sed -i "s/if (RESERVED_PROPS.includes(prop)) continue;/if (RESERVED_PROPS.includes(prop) || prop.startsWith('x-')) continue;/g" "$f"
done
echo "Patched @react-three/fiber to ignore Emergent JSX x-* props."
