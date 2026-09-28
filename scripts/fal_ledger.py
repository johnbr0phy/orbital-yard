#!/usr/bin/env python3
"""The fal.ai spending ledger for the audio pass: bench/audio/ledger.csv.

Every generation is reserved here *before* it is sent, at its full list price, and
the reservation is refused if it would take the running total past the stop line.
A failed request stays in the ledger (marked failed): I can't see fal's invoice from
here, so the ledger errs on the side of counting too much.

  CAP   = $10.00  the credit for this pass
  STOP  = $9.50   no reservation may take the total past this

Prices (fal.ai model pages, 2026-09-28):
  fal-ai/elevenlabs/sound-effects/v2   $0.002 per generated second
  fal-ai/elevenlabs/music              $0.60 per output minute, rounded up to the minute

python3 scripts/fal_ledger.py            prints the total
python3 scripts/fal_ledger.py --selftest checks the cap logic on a scratch ledger
"""
import csv, math, pathlib, threading, datetime, sys, os, tempfile, fcntl, contextlib

CAP, STOP = 10.00, 9.50
LEDGER = pathlib.Path(__file__).resolve().parent.parent / 'bench/audio/ledger.csv'
FIELDS = ['when', 'model', 'role', 'take', 'seconds', 'cost_usd', 'running_total_usd', 'status', 'file', 'prompt']
SFX, MUSIC = 'fal-ai/elevenlabs/sound-effects/v2', 'fal-ai/elevenlabs/music'
_tlock = threading.Lock()
@contextlib.contextmanager
def _lock_for(p):
    # threads and processes: a thread lock plus an flock on a sidecar file
    with _tlock:
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(str(p) + '.lock', 'w') as lf:
            fcntl.flock(lf, fcntl.LOCK_EX)
            try: yield
            finally: fcntl.flock(lf, fcntl.LOCK_UN)

class OverBudget(Exception): pass

def price(model, seconds):
    if model == SFX: return round(0.002 * seconds, 4)
    if model == MUSIC: return round(0.60 * math.ceil(seconds / 60 - 1e-9), 4)
    raise ValueError('unknown model ' + model)

def rows(path=None):
    p = pathlib.Path(path or LEDGER)
    if not p.exists(): return []
    with p.open(newline='') as f: return list(csv.DictReader(f))

def total(path=None): return round(sum(float(r['cost_usd']) for r in rows(path)), 4)

def reserve(model, role, take, seconds, prompt, path=None):
    """Adds a pending row and returns its index, or raises OverBudget. Thread-safe."""
    p = pathlib.Path(path or LEDGER)
    with _lock_for(p):
        cost = price(model, seconds); t = total(p)
        if t + cost > STOP + 1e-9: raise OverBudget(f'{role}-{take}: ${cost:.3f} would take the total from ${t:.3f} past ${STOP:.2f}')
        new = not p.exists()
        with p.open('a', newline='') as f:
            w = csv.DictWriter(f, FIELDS)
            if new: w.writeheader()
            w.writerow({'when': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'model': model, 'role': role, 'take': take,
                        'seconds': seconds, 'cost_usd': f'{cost:.4f}', 'running_total_usd': f'{t + cost:.4f}', 'status': 'sent', 'file': '', 'prompt': prompt})
        return len(rows(p)) - 1

def settle(index, status, file='', path=None):
    p = pathlib.Path(path or LEDGER)
    with _lock_for(p):
        rs = rows(p); rs[index]['status'] = status; rs[index]['file'] = file
        with p.open('w', newline='') as f:
            w = csv.DictWriter(f, FIELDS); w.writeheader(); w.writerows(rs)

def selftest():
    d = tempfile.mkdtemp(); p = os.path.join(d, 'l.csv')
    i = reserve(MUSIC, 'score', 1, 175, 'x', p); settle(i, 'ok', 'a.mp3', p)
    assert abs(total(p) - 1.80) < 1e-9, total(p)             # 175 s bills as 3 minutes
    n = 0
    try:
        while True: reserve(SFX, 'shot', n, 22, 'x', p); n += 1
    except OverBudget: pass
    assert total(p) <= STOP + 1e-9 and total(p) > STOP - 0.044, total(p)
    try: reserve(SFX, 'tiny', 0, 0.5, 'x', p); ok = total(p) + 0.001 <= STOP
    except OverBudget: ok = True
    assert ok
    rs = rows(p); run = 0
    for r in rs: run += float(r['cost_usd']); assert abs(run - float(r['running_total_usd'])) < 1e-6
    print('ok', total(p), len(rs))

if __name__ == '__main__':
    if '--selftest' in sys.argv: selftest()
    else: print(f'total ${total():.4f} of ${CAP:.2f} (stop at ${STOP:.2f}), {len(rows())} rows')
