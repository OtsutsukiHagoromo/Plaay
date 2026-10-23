"""
Halloween sale (24-31 Oct 2026) on the LIVE theme, which Shopify publishes from the
staging-main branch (theme "Plaay/staging-main"). Run from a checkout of staging-main.

  disable - Oct 31 20:05 UTC (= Nov 1 00:05 GST): hides the Halloween hero slide and the two
            Halloween announcement messages (the bar falls back to the rewards ladder) and
            switches the sale kit off.
  enable  - manual only: the exact reverse.

Badges and the product-page / cart notes are date-gated in Liquid (snippets/sale-active) and
the discounts are Shopify automatic discounts with their own end time, so neither needs this.
Scheduled runs are guarded to the 2026 sale dates; pass --force (manual runs) to bypass.
"""
import json
import sys
from datetime import datetime, timezone

SETTINGS = 'config/settings_data.json'
INDEX = 'templates/index.json'
SLIDE = 'banner_halloween'
MESSAGES = ['msg_halloween_1', 'msg_halloween_2']
ALLOWED_DATES = {'2026-10-31', '2026-11-01'}


def load(path):
    with open(path, 'r', encoding='utf-8') as f:
        raw = f.read()
    idx = raw.index('{')
    return raw[:idx], json.loads(raw[idx:])


def save(path, comment, data):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(comment)
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')


def show(block, visible):
    if visible:
        block.pop('disabled', None)
    else:
        block['disabled'] = True


def main():
    args = sys.argv[1:]
    force = '--force' in args
    mode = next((a for a in args if a in ('enable', 'disable')), None)
    if mode is None:
        sys.exit('usage: toggle_halloween_live.py enable|disable [--force]')
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    if not force and today not in ALLOWED_DATES:
        print(f'Skipping: {mode} run on {today} is outside the 2026 sale window. Use --force to override.')
        return
    on = mode == 'enable'

    comment, data = load(SETTINGS)
    data['current']['sale_kit_enabled'] = on
    blocks = data['current']['sections']['pl-announcement'].get('blocks', {})
    for key in MESSAGES:
        if key in blocks:
            show(blocks[key], on)
    save(SETTINGS, comment, data)

    comment, data = load(INDEX)
    hero = data['sections']['hero']['blocks']
    if SLIDE in hero:
        show(hero[SLIDE], on)
    save(INDEX, comment, data)
    print(f'Done: {mode}d Halloween sale on the live theme (slide, announcement messages, sale kit).')


if __name__ == '__main__':
    main()
