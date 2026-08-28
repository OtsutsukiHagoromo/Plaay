"""
Runs via GitHub Actions for the Back to School sale (29-31 Aug 2026).

  enable  - Aug 28 20:00 UTC (= Aug 29 00:00 GST): shows the hero sale slide
            and the announcement bar sale text. The rest of the sale UI is
            date-gated in Liquid and the discount is scheduled in Shopify,
            so they need no flip.
  disable - Aug 31 20:05 UTC (= Sep 1 00:05 GST): flips bts_sale_enabled off
            and re-disables the announcement block, hero slide and homepage
            countdown section.

Cron schedules re-fire every year, so scheduled runs are guarded to the 2026
sale dates; pass --force (used by manual workflow_dispatch runs) to bypass.
Mirrors disable_eid_sale.py's comment-preserving JSON handling.
"""
import json
import sys
from datetime import datetime, timezone

SETTINGS = 'config/settings_data.json'
INDEX = 'templates/index.json'
HERO_SECTION = '4ae9c22c-dd9d-4d0b-bb5c-7da4d20021b3'
ALLOWED_DATES = {
    'enable': {'2026-08-28', '2026-08-29'},
    'disable': {'2026-08-31', '2026-09-01'},
}


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
    args = sys.argv[1:]
    force = '--force' in args
    mode = next((a for a in args if a in ('enable', 'disable')), None)
    if mode is None:
        sys.exit('usage: toggle_bts2_sale.py enable|disable [--force]')

    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    if not force and today not in ALLOWED_DATES[mode]:
        print(f'Skipping: {mode} run on {today} is outside the 2026 sale window '
              f'(annual cron re-fire guard). Use --force to override.')
        return

    on = mode == 'enable'

    comment, data = load(SETTINGS)
    data['current']['bts_sale_enabled'] = on
    blocks = data['current']['sections']['announcement-bar']['blocks']
    if 'announcement_text_qzKxiQ' in blocks:
        if on:
            blocks['announcement_text_qzKxiQ'].pop('disabled', None)
        else:
            blocks['announcement_text_qzKxiQ']['disabled'] = True
    save(SETTINGS, comment, data)

    comment, data = load(INDEX)
    slide = data['sections'][HERO_SECTION]['blocks']['slide_earVyE']
    if on:
        slide.pop('disabled', None)
    else:
        slide['disabled'] = True
        data['sections']['cu_countdown_timer_jJqyWW']['disabled'] = True
    save(INDEX, comment, data)

    print(f'Done: {mode}d Back to School sale '
          f'(toggle={on}, announcement + hero slide {"shown" if on else "hidden"}).')


if __name__ == '__main__':
    main()
