'use strict';

// ── 배경 이미지 목록 ──────────────────────────────────
// images/ 폴더에 파일 추가 후 여기에 파일명만 넣으면 됩니다
const BACKGROUNDS = [
  'images/bg1.jpg',
  'images/bg2.jpg',
  'images/bg3.jpg',
  'images/bg4.jpg',
  'images/bg5.jpg',
  'images/bg6.jpg',
  'images/bg7.jpg',
  'images/bg8.jpg',
  'images/bg9.jpg',
  'images/bg10.jpg',
  'images/bg11.jpg',
  'images/bg12.jpg',
];
const BG_INTERVAL_MS = 2 * 60 * 1000;  // 2분

let bgCurrentLayer = 'a';  // 현재 보이는 레이어
let bgLastIndex = -1;

function pickRandomIndex() {
  if (BACKGROUNDS.length === 1) return 0;
  let idx;
  do { idx = Math.floor(Math.random() * BACKGROUNDS.length); }
  while (idx === bgLastIndex);
  return idx;
}

function rotateBg() {
  const idx = pickRandomIndex();
  bgLastIndex = idx;
  const url = `url('${BACKGROUNDS[idx]}')`;

  if (bgCurrentLayer === 'a') {
    // b에 새 이미지 로드 후 페이드인, a 페이드아웃
    const b = document.getElementById('bg-b');
    b.style.backgroundImage = url;
    b.style.opacity = '1';
    document.getElementById('bg-a').style.opacity = '0';
    bgCurrentLayer = 'b';
  } else {
    const a = document.getElementById('bg-a');
    a.style.backgroundImage = url;
    a.style.opacity = '1';
    document.getElementById('bg-b').style.opacity = '0';
    bgCurrentLayer = 'a';
  }
}

// 배경 시작 및 주기적 교체
if (BACKGROUNDS.length > 0) {
  // 초기 이미지 즉시 표시 (페이드 없이)
  const idx = pickRandomIndex();
  bgLastIndex = idx;
  const bgA = document.getElementById('bg-a');
  bgA.style.backgroundImage = `url('${BACKGROUNDS[idx]}')`;
  bgA.style.opacity = '1';

  if (BACKGROUNDS.length > 1) {
    setInterval(rotateBg, BG_INTERVAL_MS);
  }
}

// ── 시계 ──────────────────────────────────────────────
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ── 시계 ──────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h  = String(now.getHours()).padStart(2, '0');
  const m  = String(now.getMinutes()).padStart(2, '0');
  const s  = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('time').textContent = `${h}:${m}:${s}`;

  const y   = now.getFullYear();
  const mo  = String(now.getMonth() + 1).padStart(2, '0');
  const d   = String(now.getDate()).padStart(2, '0');
  document.getElementById('date').textContent =
    `${y}년 ${mo}월 ${d}일 (${DAYS[now.getDay()]})`;
}

// ── 날씨 아이콘 / 텍스트 ──────────────────────────────
function getIconClass(sky, pty, hour) {
  const p = parseInt(pty, 10);
  const s = parseInt(sky, 10);
  const day = hour >= 6 && hour < 19;

  if (p === 1) return 'wi-rain';
  if (p === 2) return 'wi-rain-mix';
  if (p === 3) return 'wi-snow';
  if (p === 4) return day ? 'wi-day-showers' : 'wi-night-showers';
  if (s === 1) return day ? 'wi-day-sunny'   : 'wi-night-clear';
  if (s === 3) return day ? 'wi-day-cloudy'  : 'wi-night-cloudy';
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

// ── 카드 렌더링 ───────────────────────────────────────
function renderCard(id, { sky, pty, tmp, tmn, tmx }, hour) {
  document.getElementById(`icon-${id}`).className =
    `wi ${getIconClass(sky, pty, hour)} weather-icon`;
  document.getElementById(`temp-${id}`).textContent =
    tmp !== '--' ? `${tmp}°` : '--°';
  document.getElementById(`desc-${id}`).textContent =
    getSkyDesc(sky, pty);

  const minmaxEl = document.getElementById(`minmax-${id}`);
  if (minmaxEl) {
    const lo = tmn != null ? `${tmn}°` : '--°';
    const hi = tmx != null ? `${tmx}°` : '--°';
    minmaxEl.textContent = `↓${lo} ↑${hi}`;
  }
}

// ── 날씨 데이터 요청 ──────────────────────────────────
async function fetchWeather() {
  try {
    const res = await fetch('/api/weather');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.error) { console.warn('[weather]', data.error); return; }

    const nowH  = new Date().getHours();
    const plus2H = data.forecast2h.hour ?? (nowH + 2) % 24;

    // 2시간 후 라벨
    document.getElementById('label-2h').textContent =
      `${String(plus2H).padStart(2, '0')}:00 예보`;

    renderCard('today',    data.current,    nowH);
    renderCard('2h',       data.forecast2h, plus2H);
    renderCard('tomorrow', data.tomorrow,   12);

  } catch (e) {
    console.warn('[weather] 로드 실패:', e.message);
  }
}

// ── 시작 ──────────────────────────────────────────────
updateClock();
setInterval(updateClock, 1000);

fetchWeather();
setInterval(fetchWeather, 10 * 60 * 1000);  // 10분마다 갱신
