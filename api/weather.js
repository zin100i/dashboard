/**
 * Vercel Serverless Function — 기상청 단기예보 API 프록시
 * 수원: nx=60, ny=121
 *
 * 환경변수: KMA_API_KEY (Vercel 대시보드 > Settings > Environment Variables)
 */

const FORECAST_URL =
  'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
const NX = 60;
const NY = 121;

// ── 기상청 발표 시각 계산 ─────────────────────────────
function getBaseDateTime() {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
  );
  const baseHours = [2, 5, 8, 11, 14, 17, 20, 23];

  for (let i = baseHours.length - 1; i >= 0; i--) {
    const h = baseHours[i];
    const threshold = new Date(now);
    threshold.setHours(h, 10, 0, 0);
    if (now >= threshold) {
      return {
        baseDate: toDateStr(now),
        baseTime: String(h).padStart(2, '0') + '00',
      };
    }
  }
  // 자정 직후 → 전날 23시 기준
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return { baseDate: toDateStr(yesterday), baseTime: '2300' };
}

function toDateStr(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

// ── 예보 파싱 ─────────────────────────────────────────
function parseForecast(items) {
  const map = {};
  for (const item of items) {
    const key = `${item.fcstDate}_${item.fcstTime}`;
    if (!map[key]) map[key] = { date: item.fcstDate, time: item.fcstTime };
    map[key][item.category] = item.fcstValue;
  }
  return map;
}

function closestSlot(map, targetDate, targetHour) {
  const slots = Object.values(map).filter(v => v.date === targetDate);
  if (!slots.length) return {};
  const target = ((targetHour % 24) + 24) % 24 * 60;
  slots.sort((a, b) => {
    const ah = parseInt(a.time.slice(0, 2)) * 60;
    const bh = parseInt(b.time.slice(0, 2)) * 60;
    return Math.abs(ah - target) - Math.abs(bh - target);
  });
  return slots[0];
}

function dailyExtremes(map, dateStr) {
  let tmn = null, tmx = null;
  for (const slot of Object.values(map)) {
    if (slot.date !== dateStr) continue;
    if (slot.TMN != null) tmn = parseFloat(slot.TMN);
    if (slot.TMX != null) tmx = parseFloat(slot.TMX);
  }
  return { tmn, tmx };
}

// ── 핸들러 ────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const API_KEY = process.env.KMA_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'KMA_API_KEY 환경변수가 없습니다.' });
  }

  const { baseDate, baseTime } = getBaseDateTime();
  const params = new URLSearchParams({
    serviceKey: API_KEY,
    pageNo: '1',
    numOfRows: '1000',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: String(NX),
    ny: String(NY),
  });

  try {
    const apiRes = await fetch(`${FORECAST_URL}?${params}`);
    const json = await apiRes.json();
    const items = json?.response?.body?.items?.item;

    if (!Array.isArray(items)) {
      return res.status(502).json({ error: '기상청 응답 파싱 실패', raw: json });
    }

    const map = parseForecast(items);

    const now = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
    );
    const todayStr    = toDateStr(now);
    const tomorrowStr = toDateStr(new Date(now.getTime() + 86400000));
    const nowH        = now.getHours();
    const plus2H      = nowH + 2;
    const plus2Date   = plus2H >= 24 ? tomorrowStr : todayStr;

    const current  = closestSlot(map, todayStr, nowH);
    const future2h = closestSlot(map, plus2Date, plus2H);
    const tmrNoon  = closestSlot(map, tomorrowStr, 12);
    const todayEx  = dailyExtremes(map, todayStr);
    const tmrEx    = dailyExtremes(map, tomorrowStr);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      current: {
        tmp: current.TMP  ?? '--',
        sky: current.SKY  ?? '1',
        pty: current.PTY  ?? '0',
        tmn: todayEx.tmn,
        tmx: todayEx.tmx,
      },
      forecast2h: {
        hour: ((plus2H % 24) + 24) % 24,
        tmp:  future2h.TMP ?? '--',
        sky:  future2h.SKY ?? '1',
        pty:  future2h.PTY ?? '0',
      },
      tomorrow: {
        tmp: tmrNoon.TMP ?? '--',
        sky: tmrNoon.SKY ?? '1',
        pty: tmrNoon.PTY ?? '0',
        tmn: tmrEx.tmn,
        tmx: tmrEx.tmx,
      },
    });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
};
