// ===== لوحة المتصدرين لألعاب مدار (قاعدة بيانات D1 مربوطة باسم LEADERBOARD) =====
const LB_GAMES = { g10u1: 12, g11u1: 39 }; // رمز اللعبة: أقصى عدد نجوم فيها
let lbReady = false;
function lbJson(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
async function handleScores(request, env) {
  try {
    const db = env.LEADERBOARD;
    if (!db) return lbJson({ ok: false, error: 'db-not-bound' }, 503);
    if (!lbReady) {
      await db.prepare('CREATE TABLE IF NOT EXISTS scores (game TEXT NOT NULL, pid TEXT NOT NULL, name TEXT NOT NULL, stars INTEGER NOT NULL DEFAULT 0, points INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, PRIMARY KEY (game, pid))').run();
      lbReady = true;
    }
    const url = new URL(request.url);
    const isAdmin = !!env.ADMIN_KEY && request.headers.get('x-admin-key') === env.ADMIN_KEY;
    const cleanPid = v => String(v || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);

    if (request.method === 'POST') {
      let b;
      try { b = await request.json(); } catch (e) { return lbJson({ ok: false, error: 'bad-json' }, 400); }
      const game = String(b.game || '');
      if (!(game in LB_GAMES)) return lbJson({ ok: false, error: 'game' }, 400);
      const pid = cleanPid(b.pid);
      if (pid.length < 8) return lbJson({ ok: false, error: 'pid' }, 400);
      const name = String(b.name || '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
      if (!name) return lbJson({ ok: false, error: 'name' }, 400);
      const stars = Math.max(0, Math.min(LB_GAMES[game], Math.floor(Number(b.stars) || 0)));
      const points = Math.max(0, Math.min(100000, Math.floor(Number(b.points) || 0)));
      await db.prepare('INSERT INTO scores (game, pid, name, stars, points, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ' +
        'ON CONFLICT(game, pid) DO UPDATE SET name = excluded.name, stars = MAX(scores.stars, excluded.stars), points = MAX(scores.points, excluded.points), updated = excluded.updated')
        .bind(game, pid, name, stars, points, Date.now()).run();
      return lbJson({ ok: true });
    }

    if (request.method === 'GET') {
      const game = url.searchParams.get('game') || '';
      if (!(game in LB_GAMES)) return lbJson({ ok: false, error: 'game' }, 400);
      const me = cleanPid(url.searchParams.get('pid'));
      const { results } = await db.prepare('SELECT pid, name, stars, points, updated FROM scores WHERE game = ?1 ORDER BY stars DESC, points DESC, updated ASC LIMIT ?2')
        .bind(game, isAdmin ? 2000 : 20).all();
      const total = (await db.prepare('SELECT COUNT(*) AS c FROM scores WHERE game = ?1').bind(game).first()).c;
      let mine = null;
      if (me) {
        const row = await db.prepare('SELECT stars, points, updated FROM scores WHERE game = ?1 AND pid = ?2').bind(game, me).first();
        if (row) {
          const ahead = await db.prepare('SELECT COUNT(*) AS c FROM scores WHERE game = ?1 AND (stars > ?2 OR (stars = ?2 AND points > ?3) OR (stars = ?2 AND points = ?3 AND updated < ?4))')
            .bind(game, row.stars, row.points, row.updated).first();
          mine = { rank: ahead.c + 1, stars: row.stars, points: row.points };
        }
      }
      const rows = results.map(r => isAdmin ? r : { name: r.name, stars: r.stars, points: r.points, me: !!me && r.pid === me });
      return lbJson({ ok: true, game, total, rows, mine, admin: isAdmin });
    }

    if (request.method === 'DELETE') {
      if (!isAdmin) return lbJson({ ok: false, error: 'forbidden' }, 403);
      await db.prepare('DELETE FROM scores WHERE game = ?1 AND pid = ?2')
        .bind(url.searchParams.get('game') || '', cleanPid(url.searchParams.get('pid'))).run();
      return lbJson({ ok: true });
    }
    return lbJson({ ok: false, error: 'method' }, 405);
  } catch (err) {
    return lbJson({ ok: false, error: 'server', detail: String(err).slice(0, 200) }, 500);
  }
}

