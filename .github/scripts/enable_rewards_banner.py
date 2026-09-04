"""
Switches on the two rewards-ladder surfaces that Liquid cannot date-gate: the hero
banner slide (templates/index.json) and the announcement bar line
(config/settings_data.json).

Everything else in the rewards ladder - the cart bar, the PDP card, the mystery-gift
threshold - is date-gated in Liquid to 2026-09-05T00:00:00+04:00, and the tier
discounts are scheduled inside Shopify, so both of those flip on their own. This
script exists only for the two JSON-driven surfaces.

Runs once at 2026-09-04 20:00 UTC (= 5 Sep 00:00 GST). Cron schedules re-fire every
year, so a scheduled run only acts on the expected dates; pass --force (used by the
manual workflow_dispatch fallback) to bypass that guard.

Mirrors disable_eid_sale.py / toggle_bts2_sale.py comment-preserving JSON handling.
"""
import json
import sys
from datetime import datetime, timezone

SETTINGS = 'config/settings_data.json'
INDEX = 'templates/index.json'
HERO_SECTION = '4ae9c22c-dd9d-4d0b-bb5c-7da4d20021b3'
HERO_SLIDE = 'slide_earVyE'
ANNOUNCEMENT_BLOCK = 'announcement_text_qzKxiQ'
ALLOWED_DATES = {'2026-09-04', '2026-09-05'}


def load(path):
    with open(path, 'r', encoding='utf-8') as f:
        raw = f.read()
    idx = raw.index('{')
    return raw[:idx], json.loads(raw[idx:])


def save(path, comment, data):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(comment)
        json.dump(data, f, indent=2, ensure_ascii=False)


def main():
    force = '--force' in sys.argv[1:]
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    if not force and today not in ALLOWED_DATES:
        print('Skipping: %s is outside the rewards go-live window '
              '(annual cron re-fire guard). Use --force to override.' % today)
        return

    comment, data = load(SETTINGS)
    blocks = data['current']['sections']['announcement-bar']['blocks']
    if ANNOUNCEMENT_BLOCK in blocks:
        blocks[ANNOUNCEMENT_BLOCK].pop('disabled', None)
    save(SETTINGS, comment, data)

    comment, data = load(INDEX)
    data['sections'][HERO_SECTION]['blocks'][HERO_SLIDE].pop('disabled', None)
    save(INDEX, comment, data)

    print('Done: rewards hero slide and announcement line are now visible.')


if __name__ == '__main__':
    main()
