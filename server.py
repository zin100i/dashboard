"""
기상청 단기예보 API 프록시 + Flask 대시보드 서버
수원시: nx=60, ny=121

설치: pip install flask requests
실행: python3 server.py
"""

from flask import Flask, jsonify, send_from_directory
import requests
from datetime import datetime, timedelta

app = Flask(__name__, static_folder='static')

# ──────────────────────────────────────────
# 설정
# ──────────────────────────────────────────
API_KEY = 'YOUR_API_KEY_HERE'   # data.go.kr 인증키 (URL 인코딩 안 된 원본)
NX = 60                          # 수원 격자 X
NY = 121                         # 수원 격자 Y
FORECAST_URL = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'


def get_base_datetime():
    """기상청 단기예보 발표 시각 계산 (발표 후 10분 이후 사용 가능)"""
    now = datetime.now()
    base_hours = [2, 5, 8, 11, 14, 17, 20, 23]

    for h in reversed(base_hours):
        t = now.replace(hour=h, minute=0, second=0, microsecond=0)
        if now >= t + timedelta(minutes=10):
            return now.strftime('%Y%m%d'), f'{h:02d}00'

    # 자정 직후라 전날 23시 기준
    yesterday = now - timedelta(days=1)
    return yesterday.strftime('%Y%m%d'), '2300'


def parse_forecast(items):
    """API 응답 → {(날짜, 시각): {카테고리: 값}} 딕셔너리"""
    data = {}
    for item in items:
        key = (item['fcstDate'], item['fcstTime'])
        data.setdefault(key, {})[item['category']] = item['fcstValue']
    return data


def find_closest_key(data, target_date, target_time):
    """target 시각에 가장 가까운 예보 키 반환"""
    keys = [(d, t) for (d, t) in data if d == target_date]
    if not keys:
        return None
    target_min = int(target_time[:2]) * 60 + int(target_time[2:])
    keys.sort(key=lambda k: abs(int(k[1][:2]) * 60 + int(k[1][2:]) - target_min))
    return keys[0]


@app.route('/api/weather')
def get_weather():
    base_date, base_time = get_base_datetime()
    params = {
        'serviceKey': API_KEY,
        'pageNo': 1,
        'numOfRows': 1000,
        'dataType': 'JSON',
        'base_date': base_date,
        'base_time': base_time,
        'nx': NX,
        'ny': NY,
    }

    try:
        resp = requests.get(FORECAST_URL, params=params, timeout=10)
        resp.raise_for_status()
        body = resp.json()['response']['body']
        items = body['items']['item']
    except Exception as e:
        return jsonify({'error': f'API 호출 실패: {e}'}), 502

    forecast = parse_forecast(items)
    now = datetime.now()
    today_str = now.strftime('%Y%m%d')
    tomorrow = now + timedelta(days=1)
    tomorrow_str = tomorrow.strftime('%Y%m%d')
    two_hours = now + timedelta(hours=2)
    two_h_date = two_hours.strftime('%Y%m%d')
    two_h_time = f'{two_hours.hour:02d}00'

    def get_slot(date, time):
        key = find_closest_key(forecast, date, time) or (date, time)
        return forecast.get(key, {})

    # 현재 기상
    current_time = f'{now.hour:02d}00'
    current = get_slot(today_str, current_time)

    # 2시간 뒤
    future2h = get_slot(two_h_date, two_h_time)

    # 오늘 일 최저/최고
    def find_daily_extremes(date_str):
        tmn = tmx = None
        for (d, t), vals in forecast.items():
            if d != date_str:
                continue
            if 'TMN' in vals:
                tmn = float(vals['TMN'])
            if 'TMX' in vals:
                tmx = float(vals['TMX'])
        return tmn, tmx

    today_tmn, today_tmx = find_daily_extremes(today_str)
    tmr_tmn, tmr_tmx = find_daily_extremes(tomorrow_str)

    # 내일 낮 대표 기상 (12시)
    tomorrow_noon = get_slot(tomorrow_str, '1200')

    result = {
        'current': {
            'tmp': current.get('TMP', '--'),
            'sky': current.get('SKY', '1'),
            'pty': current.get('PTY', '0'),
            'tmn': today_tmn,
            'tmx': today_tmx,
        },
        'forecast2h': {
            'tmp': future2h.get('TMP', '--'),
            'sky': future2h.get('SKY', '1'),
            'pty': future2h.get('PTY', '0'),
        },
        'tomorrow': {
            'tmp': tomorrow_noon.get('TMP', '--'),
            'sky': tomorrow_noon.get('SKY', '1'),
            'pty': tomorrow_noon.get('PTY', '0'),
            'tmn': tmr_tmn,
            'tmx': tmr_tmx,
        },
    }
    return jsonify(result)


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('static', filename)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
