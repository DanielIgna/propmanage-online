"""Blender headless conversion script — DAE / OBJ / FBX → GLB.

Run from FastAPI backend as:
    blender --background --python /app/backend/blender_convert.py -- INPUT OUTPUT

NB: SketchUp `.skp` is NOT supported by Blender on Linux (no SDK release).
Architects must export from SketchUp Desktop as Collada (.dae) — a free
1-click File → Export → 3D Model → COLLADA — and upload that .dae instead.
PropManage will auto-convert it to .glb via this script in ~10-30 seconds.
"""
import bpy
import sys
import os

# Args passed after "--" sentinel
argv = sys.argv
try:
    sep = argv.index("--")
    args = argv[sep + 1:]
except ValueError:
    args = []

if len(args) < 2:
    print("[blender_convert] usage: blender --background --python THIS -- INPUT OUTPUT")
    sys.exit(2)

input_path, output_path = args[0], args[1]
if not os.path.isfile(input_path):
    print(f"[blender_convert] ERROR: input file not found: {input_path}")
    sys.exit(3)

ext = os.path.splitext(input_path)[1].lower()
print(f"[blender_convert] input={input_path} ({ext}) output={output_path}")

# 1) Wipe the default scene (Blender starts with a cube + lamp + camera we don't want)
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2) Import based on file extension
try:
    if ext == ".dae":
        bpy.ops.wm.collada_import(filepath=input_path)
    elif ext == ".obj":
        bpy.ops.import_scene.obj(filepath=input_path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=input_path)
    elif ext in (".glb", ".gltf"):
        # Already a glTF asset — just normalize / re-export.
        bpy.ops.import_scene.gltf(filepath=input_path)
    elif ext == ".stl":
        bpy.ops.import_mesh.stl(filepath=input_path)
    elif ext == ".ply":
        bpy.ops.import_mesh.ply(filepath=input_path)
    else:
        print(f"[blender_convert] ERROR: unsupported input extension: {ext}")
        sys.exit(4)
except Exception as e:  # noqa: BLE001
    print(f"[blender_convert] ERROR during import: {e}")
    sys.exit(5)

# 3) Quick scene info for debugging
mesh_count = sum(1 for o in bpy.data.objects if o.type == "MESH")
print(f"[blender_convert] imported {mesh_count} mesh objects")
if mesh_count == 0:
    print("[blender_convert] ERROR: no meshes imported — file is empty or corrupt")
    sys.exit(6)

# 4) Export as glTF Binary (.glb) — embedded textures, draco-compressed when small enough
try:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_apply=True,           # apply modifiers
        export_yup=True,             # gltf convention
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_lights=False,
        export_cameras=False,
    )
except Exception as e:  # noqa: BLE001
    import traceback
    print(f"[blender_convert] ERROR during export: {type(e).__name__}: {e}")
    traceback.print_exc()
    sys.exit(7)

if not os.path.isfile(output_path):
    print(f"[blender_convert] ERROR: output GLB not produced")
    sys.exit(8)

size = os.path.getsize(output_path)
print(f"[blender_convert] OK — wrote {size} bytes to {output_path}")
sys.exit(0)
