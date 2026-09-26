"""
Runs via GitHub Actions for the Plaay Day sale (27-30 Sep 2026, 20% off sitewide).

The sale went live by merge (it was already past midnight GST on 27 Sep), so the
schedule only tears it down:

  disable - Sep 30 20:05 UTC (= Oct 1 00:05 GST): flips bts_sale_enabled off, hides
            the sale announcement line, hero slide and homepage countdown, and brings
            back the rewards-ladder announcement line and hero slide.
  enable  - manual only (workflow_dispatch): the exact reverse.

The badge, PDP card, cart line, tier bar and gift threshold are date-gated in Liquid
and the 20% automatic discount is scheduled in Shopify, so they need no flip.

Cron schedules re-fire every year, so scheduled runs are guarded to the 2026 sale
dates; pass --force (used by manual runs) to bypass. Mirrors the comment-preserving
JSON handling of the earlier sale scripts.
"""
import json
import sys
from datetime import datetime, timezone

SETTINGS = 'config/settings_data.json'
INDEX = 'templates/index.json'
HERO_SECTION = '4ae9c22c-dd9d-4d0b-bb5c-7da4d20021b3'
SALE_SLIDE = 'slide_plaayDay'
REWARDS_SLIDE = 'slide_earVyE'
COUNTDOWN = 'cu_countdown_timer_jJqyWW'
SALE_LINE = 'announcement_text_yP4HrN'
REWARDS_LINE = 'announcement_text_qzKxiQ'
ALLOWED_DATES = {'2026-09-30', '2026-10-01'}


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
        sys.exit('usage: toggle_plaay_day_sale.py enable|disable [--force]')

    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    if not force and today not in ALLOWED_DATES:
        print(f'Skipping: {mode} run on {today} is outside the 2026 sale window '
              f'(annual cron re-fire guard). Use --force to override.')
        return

    on = mode == 'enable'

    comment, data = load(SETTINGS)
    data['current']['bts_sale_enabled'] = on
    blocks = data['current']['sections']['announcement-bar']['blocks']
    show(blocks[SALE_LINE], on)
    show(blocks[REWARDS_LINE], not on)
    save(SETTINGS, comment, data)

    comment, data = load(INDEX)
    slides = data['sections'][HERO_SECTION]['blocks']
    show(slides[SALE_SLIDE], on)
    show(slides[REWARDS_SLIDE], not on)
    show(data['sections'][COUNTDOWN], on)
    save(INDEX, comment, data)

    print(f'Done: {mode}d Plaay Day sale (toggle={on}; sale announcement, hero slide '
          f'and countdown {"shown" if on else "hidden"}; rewards line + slide '
          f'{"hidden" if on else "shown"}).')


if __name__ == '__main__':
    main()
