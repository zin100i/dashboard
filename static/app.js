'use strict';

const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ── 시계 ──────────────────────────────────
function updateClock() {
  const now = new Date();
  const h  = String(now.getHours()).padStart(2, '0');
  const m  = String(now.getMinutes()).padStart(2, '0');
  const s  = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('time').textContent = `${h}:${m}:${s}`;

  const y   = now.getFullYear();
  const mo  = String(now.getMonth() + 1).padStart(2, '0');
  const d   = String(now.getDate()).padStart(2, '0');
  const day = DAYS[now.getDay()];
  document.getElementById('date').textContent = `${y}년 ${mo}월 ${d}일 (${day})`;
}

// ── 날씨 아이콘 클래스 결정 ──────────────
function getIconClass(sky, pty, hour) {
  const p = parseInt(pty, 10);
  const s = parseInt(sky, 10);
  const daytime = hour >= 6 && hour < 19;

  if (p === 1) return 'wi-rain';
  if (p === 2) return 'wi-rain-mix';
  if (p === 3) return 'wi-snow';
  if (p === 4) return daytime ? 'wi-day-showers' : 'wi-night-showers';

  if (s === 1) return daytime ? 'wi-day-sunny'  : 'wi-night-clear';
  if (s === 3) return daytime ? 'wi-day-cloudy' : 'wi-night-cloudy';
  return 'wi-cloudy';
}

function getSkyDesc(sky, pty) {
  const p = parseInt(pty, 10);
  const s = parseInt(sky, 10);
  if (p === 1) return '비';
  if (p === 2) return '비/눈';
  if (p === 3) return '눈';
  if (p === 4) return '소나기';
  if (s === 1) return '맑음';
  if (s === 3) return '구름많음';
  return '흐림';
}

// ── 카드 업데이트 ─────────────────────────
function updateCard(id, data, hour, showMinMax) {
  const iconEl = document.getElementById(`icon-${id}`);
  const iconClass = getIconClass(data.sky, data.pty, hour);

  // weather-icon 기본 클래스 유지, wi 아이콘 교체
  iconEl.className = `wi ${iconClass} weather-icon`;

  document.getElementById(`temp-${id}`).textContent =
    data.tmp !== '--' ? `${data.tmp}°` : '--°';

  document.getElementById(`desc-${id}`).textContent =
    getSkyDesc(data.sky, data.pty);

  if (showMinMax) {
    const tmn = data.tmn != null ? `${data.tmn}°` : '--°';
    const tmx = data.tmx != null ? `${data.tmx}°` : '--°';
    document.getElementById(`minmax-${id}`).textContent = `↓${tmn} ↑${tmx}`;
  }
}

// ── 날씨 데이터 가져오기 ──────────────────
async function fetchWeather() {
  try {
    const resp = await fetch('/api/weather');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    if (data.error) {
      console.warn('[weather] API 오류:', data.error);
      return;
    }

    const now = new Date();
    const twoH = (now.getHours() + 2) % 24;

    // 2시간 후 라벨 업데이트
    const label2h = document.getElementById('label-2h');
    const twoHTime = `${String(twoH).padStart(2, '0')}:00`;
    label2h.textContent = `${twoHTime} 예보`;

    updateCard('today',    data.current,   now.getHours(), true);
    updateCard('2h',       data.forecast2h, twoH,          false);
    updateCard('tomorrow', data.tomorrow,   12,             true);

  } catch (e) {
    console.warn('[weather] 데이터 로드 실패:', e.message);
  }
}

// ── 시작 ──────────────────────────────────
updateClock();
setInterval(updateClock, 1000);

fetchWeather();
setInterval(fetchWeather, 10 * 60 * 1000);   // 10분마다 갱신
