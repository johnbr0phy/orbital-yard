/* Tribute War broadcast layer: event log, importance scoring, kill feed,
   strength / momentum, shot grammar for the Broadcast director, time scale
   with deterministic slow motion, and the factual end-of-battle story.

   Pure logic, no DOM and no WebGL. The page feeds it events that already
   happened in the simulation; nothing here reads or consumes combat
   randomness, so a seed plays the same war whether anybody watches or not. */
(function (root) {
  'use strict';

  // Importance of each event type. Capital kill > hero duel > ion strike >
  // squadron wipe > dogfight, as the broadcast brief orders them.
  const WEIGHTS = {
    firstOneKill: 130, capitalKill: 100, heroKill: 92, capitalBreakup: 96,
    heroDuel: 70, ionStrike: 62, ionCharge: 56, capitalDanger: 58,
    squadronWipe: 42, reinforcements: 36, cloakReveal: 26, arrival: 22,
    dogfight: 12, kill: 7, victory: 150
  };
  // Seconds an event stays newsworthy (score halves at half this time).
  const SHELF = {ionCharge: 6, capitalDanger: 5, heroDuel: 8, reinforcements: 9, arrival: 8};

  function scoreEvent(ev, now) {
    const base = WEIGHTS[ev.type] ?? 5;
    const size = ev.size ? Math.min(1.6, Math.max(.7, .7 + Math.log10(Math.max(10, ev.size)) * .22)) : 1;
    const age = Math.max(0, now - ev.t), shelf = SHELF[ev.type] ?? 4;
    // Anticipation events (a charging ion cannon, a capital about to go) are
    // worth most just before they pay off; ev.until marks the payoff.
    if (ev.until != null && now <= ev.until) return base * size * (.75 + .25 * Math.min(1, age / Math.max(.1, ev.until - ev.t)));
    const since = ev.until != null ? now - ev.until : age;
    return base * size * Math.exp(-since * Math.LN2 / (shelf * .5)) * (ev.hero ? 1.12 : 1);
  }

  /* ------------------------------ event log ------------------------------ */
  function createLog(limit = 4000) {
    const events = [];
    return {
      events,
      push(ev) { events.push(ev); if (events.length > limit) events.splice(0, events.length - limit); return ev; },
      since(t) { const out = []; for (let i = events.length - 1; i >= 0 && events[i].t >= t; i--) out.push(events[i]); return out.reverse(); },
      top(n, filter) { return events.filter(e => !filter || filter(e)).map(e => ({e, s: WEIGHTS[e.type] ?? 5})).sort((a, b) => b.s - a.s || a.e.t - b.e.t).slice(0, n).map(x => x.e); },
      clear() { events.length = 0; }
    };
  }

  /* ------------------------------ kill feed ------------------------------ */
  // Capitals and heroes get their own line; fighters of one class and side
  // fold into "TIE/LN ×14 lost" while losses keep arriving within the window.
  function createFeed({groupWindow = 4, keep = 6, life = 9} = {}) {
    const lines = [];
    let uid = 0;
    return {
      lines,
      push(ev) {
        if (!/kill|Kill/.test(ev.type)) return null;
        const major = ev.type !== 'kill';
        if (!major) {
          const g = lines.find(l => l.group && l.side === ev.side && l.klass === ev.klass && ev.t - l.last < groupWindow);
          if (g) { g.count++; g.last = ev.t; g.until = ev.t + life; g.text = feedGroupText(g); return g; }
        }
        const line = {id: ++uid, t: ev.t, last: ev.t, until: ev.t + (major ? life + 3 : life), side: ev.side, klass: ev.klass,
          count: 1, group: !major, major, hero: !!ev.hero, text: ''};
        line.text = major ? `${ev.name} destroyed${ev.byName ? ' by ' + ev.byName : ''}` : feedGroupText({...line, name: ev.name});
        line.name = ev.name;
        lines.unshift(line);
        if (lines.length > keep * 3) lines.length = keep * 3;
        return line;
      },
      visible(now) { return lines.filter(l => now < l.until && now >= l.t - .01).slice(0, keep); },
      clear() { lines.length = 0; }
    };
  }
  function feedGroupText(g) { return g.count > 1 ? `${g.klass} ×${g.count} lost` : `${g.name || g.klass} lost`; }

  /* ------------------------- strength and momentum ------------------------ */
  // Value of a live hull: plate still standing, big hulls count for more but
  // not linearly, so a fleet of fighters is not erased by one dreadnought.
  function shipValue(s) {
    if (!s || s.dead) return 0;
    const max = Math.max(1, s.hpMax || 1);
    return Math.pow(max, .8) * Math.max(0, Math.min(1, (s.hp ?? max) / max));
  }
  function strength(ships, filter) {
    const out = [0, 0];
    for (const s of ships) if (!s.dead && (!filter || filter(s))) out[s.side] += shipValue(s);
    return out;
  }
  function createMomentum({interval = 1, keep = 900} = {}) {
    const samples = [];
    let next = 0;
    return {
      samples,
      sample(t, str) {
        if (t < next) return false;
        next = t + interval;
        const total = str[0] + str[1];
        samples.push({t, share: total > 0 ? str[0] / total : .5});
        if (samples.length > keep) samples.shift();
        return true;
      },
      // Largest change in share across a window: the battle's turning point.
      turningPoint(window = 20) {
        let best = null;
        for (let i = 0, j = 0; i < samples.length; i++) {
          while (samples[i].t - samples[j].t > window) j++;
          const d = samples[i].share - samples[j].share;
          if (!best || Math.abs(d) > Math.abs(best.delta)) best = {t: samples[i].t, from: samples[j].t, delta: d};
        }
        return best && Math.abs(best.delta) > .08 ? best : null;
      },
      reset() { samples.length = 0; next = 0; }
    };
  }

  /* ------------------------------ time scale ------------------------------ */
  // The simulation always advances in fixed 1/30 s steps. This clock only
  // decides how many sim seconds a wall second buys, so slow motion and fast
  // forward cannot change the outcome of a seeded war.
  const RATES = [0, .25, .5, 1, 2, 4];
  function createClock() {
    const c = {
      rate: 1, slow: 1, slowT: -1, slowHold: 0, reduced: false, paused: false,
      setRate(r) { c.rate = Math.max(0, Math.min(4, r)); c.paused = c.rate === 0; },
      // Ease to 0.25x over 0.35 s, hold, then ease back over 0.7 s (wall time).
      slowMo(hold = 1.6) { if (c.reduced) return false; c.slowT = 0; c.slowHold = hold; return true; },
      slowFactor() {
        if (c.slowT < 0) return 1;
        const a = .35, h = c.slowHold, b = .7, t = c.slowT, lo = .25;
        const ease = u => u * u * (3 - 2 * u);
        if (t < a) return 1 + (lo - 1) * ease(t / a);
        if (t < a + h) return lo;
        if (t < a + h + b) return lo + (1 - lo) * ease((t - a - h) / b);
        return 1;
      },
      advance(wallDt) {
        if (c.slowT >= 0) { c.slowT += wallDt; if (c.slowT > .35 + c.slowHold + .7) c.slowT = -1; }
        c.slow = c.slowFactor();
        return wallDt * c.rate * c.slow;
      },
      get slowing() { return c.slowT >= 0; }
    };
    return c;
  }

  /* ------------------------------- director ------------------------------- */
  // Shot grammar for Broadcast: establish → build → climax → reaction.
  // Candidates are {kind, subject, partner, score, phase?, event?}. The page
  // supplies them from live events and forecasts; this decides when to cut.
  const PHASE_ORDER = ['establish', 'build', 'climax', 'reaction'];
  const HOLD = {establish: [4.5, 7], build: [4, 9], climax: [3, 7], reaction: [3.2, 5]};
  function createDirector({minHold = 3.2} = {}) {
    const d = {
      phase: null, shot: null, started: -Infinity, clock: 0, history: [],
      reset() { d.phase = null; d.shot = null; d.started = -Infinity; d.clock = 0; d.history.length = 0; },
      // dt is wall time; returns a new shot when the director cuts, else null.
      update(dt, candidates, alive = () => true) {
        d.clock += dt;
        const held = d.clock - d.started, [floor, ceil] = d.phase ? HOLD[d.phase] : [0, 0];
        const hold = Math.max(minHold, floor);
        const best = pickBest(candidates, d);
        const subjectGone = d.shot && d.shot.subject != null && !alive(d.shot.subject) && !d.shot.payoff;
        let next = null;
        if (!d.phase) next = candidates.find(c => c.phase === 'establish') || best;
        else {
          // A far more important event may interrupt any shot once the global
          // floor has passed; otherwise each phase holds for its own floor.
          const urgent = best && best.score >= 90 && (!d.shot || best.score > (d.shot.score || 0) * 1.25) && best.subject !== d.shot?.subject;
          if (urgent && held >= minHold) next = {...best, phase: 'climax'};
          else if ((held >= hold && held >= ceil) || (subjectGone && held >= Math.max(1.2, minHold))) next = nextInGrammar(d, candidates, best);
        }
        if (!next) return null;
        d.history.push({subject: d.shot?.subject, kind: d.shot?.kind, phase: d.phase, at: d.clock});
        if (d.history.length > 24) d.history.shift();
        d.phase = next.phase || 'build'; d.shot = next; d.started = d.clock;
        return next;
      }
    };
    return d;
  }
  function recentlyShown(d, c) { return d.history.some(h => h.subject === c.subject && h.subject != null && d.clock - h.at < 30); }
  function pickBest(candidates, d) {
    let best = null;
    for (const c of candidates) {
      const s = c.score - (recentlyShown(d, c) ? 18 : 0) - (d.shot && c.kind === d.shot.kind && c.subject === d.shot.subject ? 30 : 0);
      if (!best || s > best.adj) best = {...c, adj: s};
    }
    return best;
  }
  function nextInGrammar(d, candidates, best) {
    let want = PHASE_ORDER[(PHASE_ORDER.indexOf(d.phase) + 1) % PHASE_ORDER.length];
    // Re-establish the geography at most every 25 s; otherwise keep building.
    const lastWide = d.history.filter(h => h.phase === 'establish').pop();
    if (want === 'establish' && lastWide && d.clock - lastWide.at < 25 && candidates.some(c => c.phase === 'build')) want = 'build';
    const pool = candidates.filter(c => c.phase === want);
    if (want === 'reaction') {
      // React to what we just saw: the survivor or the victor's captain.
      const r = pool.find(c => d.shot && (c.subject === d.shot.partner || c.subject === d.shot.subject)) || pool[0];
      return r || (best && {...best, phase: 'build'});
    }
    if (want === 'climax') {
      const c = pool.sort((a, b) => b.score - a.score)[0];
      // Nothing is about to pay off: keep building on something new rather
      // than forcing a climax or going wide again.
      if (c && c.score >= 30) return c;
      const b = candidates.filter(x => x.phase === 'build' && x.subject !== d.shot?.subject).map(x => ({...x, adj: x.score - (recentlyShown(d, x) ? 18 : 0)})).sort((x, y) => y.adj - x.adj)[0];
      return b || candidates.find(x => x.phase === 'establish') || best;
    }
    const p = pool.map(c => ({...c, adj: c.score - (recentlyShown(d, c) ? 12 : 0)})).sort((a, b) => b.adj - a.adj)[0];
    return p || best;
  }

  /* ---------------------------- end of battle ---------------------------- */
  const fmt = t => { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };

  // MVP: kills weighted by what the victims were worth; survivors and heroes
  // break ties. Returns {id, score, kills}.
  function mvp(ships, log) {
    const score = new Map();
    for (const e of log.events) if (/kill|Kill/.test(e.type) && e.by != null) {
      const cur = score.get(e.by) || {score: 0, kills: 0};
      cur.score += e.value || 1; cur.kills++; score.set(e.by, cur);
    }
    let best = null;
    for (const [id, v] of score) {
      const s = ships[id]; if (!s) continue;
      const total = v.score * (s.dead ? .85 : 1) * (s.hero ? 1.05 : 1);
      if (!best || total > best.total || (total === best.total && id < best.id)) best = {id, score: v.score, kills: v.kills, total};
    }
    return best;
  }

  // Three to five factual lines built only from logged events and totals.
  function story(log, summary, momentum) {
    const lines = [], E = log.events, names = summary.names;
    lines.push(`${names[0]} met ${names[1]}${summary.place ? ' over ' + summary.place : ''}. The battle lasted ${fmt(summary.duration)}.`);
    const first = E.find(e => /kill|Kill/.test(e.type) && e.byName);
    if (first) lines.push(`First blood at ${fmt(first.t)}: ${first.name} destroyed by ${first.byName}.`);
    const tp = momentum && momentum.turningPoint();
    if (tp) {
      // Only report what the log shows in that window; never claim a cause.
      const favoured = tp.delta > 0 ? names[0] : names[1];
      const inWindow = E.filter(e => e.t >= tp.from && e.t <= tp.t && /Kill|ionStrike/.test(e.type)).sort((a, b) => (WEIGHTS[b.type] || 0) - (WEIGHTS[a.type] || 0) || (b.value || 0) - (a.value || 0))[0];
      lines.push(`Momentum swung toward ${favoured} between ${fmt(tp.from)} and ${fmt(tp.t)}${inWindow ? '; in that stretch ' + describe(inWindow) : ''}.`);
    }
    const big = E.filter(e => ['firstOneKill', 'capitalKill', 'heroKill'].includes(e.type)).sort((a, b) => (b.value || 0) - (a.value || 0))[0];
    if (big && big !== first) lines.push(`The biggest loss: ${big.name} at ${fmt(big.t)}${big.byName ? ', to ' + big.byName : ''}.`);
    if (summary.winner != null) {
      const w = summary.winner, left = summary.alive[w], had = summary.spawned[w];
      lines.push(`${names[w]} held the sky with ${left} of ${had} ships still flying${summary.mvpName ? '; ' + summary.mvpName + ' led with ' + summary.mvpKills + ' kill' + (summary.mvpKills === 1 ? '' : 's') : ''}.`);
    }
    return lines.slice(0, 5);
  }
  function describe(e) {
    switch (e.type) {
      case 'ionStrike': return `an ion strike from ${e.byName || e.name} hit`;
      case 'ionCharge': return `${e.name} charged its ion cannon`;
      case 'reinforcements': return `${e.name} arrived`;
      case 'heroDuel': return `${e.name} met ${e.byName} head to head`;
      default: return `${e.name} was destroyed${e.byName ? ' by ' + e.byName : ''}`;
    }
  }

  // Deterministic service record from the ship's seed. Flavour, not canon.
  function serviceRecord(seed, klass) {
    let h = (seed >>> 0) ^ 0x9E3779B9;
    const r = () => { h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D) >>> 0; h = Math.imul(h ^ (h >>> 12), 0x297A2D39) >>> 0; return ((h ^ (h >>> 15)) >>> 0) / 4294967296; };
    const years = 2 + Math.floor(r() * 26), actions = 1 + Math.floor(r() * 40), commend = Math.floor(r() * 6);
    const refits = Math.floor(r() * 4);
    return `${years} years in service · ${actions} prior engagements · ${commend} commendation${commend === 1 ? '' : 's'}${refits ? ' · ' + refits + ' refit' + (refits > 1 ? 's' : '') : ''}`;
  }

  // Matchup odds from per-fleet ratings (Elo-style, 400 points = 10:1).
  function odds(ratingA, ratingB) { return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400)); }

  const API = {WEIGHTS, RATES, scoreEvent, createLog, createFeed, shipValue, strength, createMomentum, createClock, createDirector, mvp, story, serviceRecord, odds, fmt};
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.ArmadaBroadcast = API;
})(typeof self !== 'undefined' ? self : this);
