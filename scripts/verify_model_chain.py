import os
import re

# 1. Extract IDs from RestorationCard.tsx
card_path = "src/components/RestorationCard.tsx"
ui_ids = []
with open(card_path, 'r') as f:
    content = f.read()
    # matches { id: 'some-id', ... }
    matches = re.findall(r"id:\s*'([^']+)'", content)
    ui_ids = matches

print(f"UI Model IDs found: {len(ui_ids)}")
for mid in ui_ids:
    print(f" - {mid}")

# 2. Extract mappings from copy-ai-assets.cjs (naively)
copy_path = "scripts/copy-ai-assets.cjs"
mappings = {}
with open(copy_path, 'r') as f:
    lines = f.readlines()
    for line in lines:
        if "src:" in line and "dest:" in line and "//" not in line.split("src:")[0]: # Skip commented
            # extract src and dest
            # src: '...', dest: '...'
            m = re.search(r"src:\s*'([^']+)',\s*dest:\s*'([^']+)'", line)
            if m:
                src, dest = m.groups()
                # Dest usually serves as the ID or ID.onnx
                # The worker adds '.onnx' to the ID.
                # So if ID is 'foo', it looks for 'foo.onnx'.
                basename = os.path.basename(dest)
                model_id = basename.replace('.onnx', '')
                mappings[model_id] = src

print(f"\nCopy Script Mappings found: {len(mappings)}")
for mid, src in mappings.items():
    print(f" - ID: {mid.ljust(30)} -> SRC: {src}")

# 3. Verification
print(f"\n--- Verification ---")
missing_in_copy = []
missing_on_disk = []

for uid in ui_ids:
    if uid not in mappings:
        # Check if maybe the ID is different from filename?
        # ai.worker.ts: const modelPath = ... /models/restoration/${modelName}.onnx
        # So usually ID matches filename.
        missing_in_copy.append(uid)
    else:
        src_path = mappings[uid]
        if not os.path.exists(src_path):
            missing_on_disk.append((uid, src_path))

if missing_in_copy:
    print(f"\n[!] UI IDs missing from Copy Script (Config mismatch?):")
    for m in missing_in_copy:
        print(f" - {m}")
else:
    print(f"\n[OK] All UI IDs have a corresponding copy entry.")

if missing_on_disk:
    print(f"\n[!] Active Models missing from Local Disk:")
    for uid, src in missing_on_disk:
        print(f" - ID: {uid} refers to {src} (NOT FOUND)")
else:
    print(f"\n[OK] All active models exist on disk.")
