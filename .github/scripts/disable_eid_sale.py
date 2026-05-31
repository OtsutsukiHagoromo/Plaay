"""
Runs at midnight GST (July 1 2026) via GitHub Actions.
Flips eid_sale_enabled to false and disables the Eid urgency
announcement bar block so the store reverts to normal instantly.
"""
import json

with open('config/settings_data.json', 'r', encoding='utf-8') as f:
    raw = f.read()

# settings_data.json has a leading /* comment */ before the JSON object
idx = raw.index('{')
comment = raw[:idx]
data = json.loads(raw[idx:])

# ── 1. Flip master Eid toggle ─────────────────────────────────────────────
data['current']['eid_sale_enabled'] = False

# ── 2. Disable the Eid urgency announcement bar block ─────────────────────
blocks = data['current']['sections']['announcement-bar']['blocks']
if 'announcement_text_qzKxiQ' in blocks:
    blocks['announcement_text_qzKxiQ']['disabled'] = True

# ── Write back (preserve the leading comment) ─────────────────────────────
with open('config/settings_data.json', 'w', encoding='utf-8') as f:
    f.write(comment)
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Done: eid_sale_enabled=false, announcement block disabled.")
