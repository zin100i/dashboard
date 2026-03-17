#!/bin/bash
# Chromium 키오스크 자동 실행 스크립트
# Pi 부팅 후 X 환경에서 실행
# ~/.config/autostart/dashboard.desktop 또는 /etc/xdg/autostart 에 등록

# 서버가 뜰 때까지 잠시 대기
sleep 3

# 마우스 커서 숨기기 (unclutter 필요: sudo apt install unclutter)
unclutter -idle 0 &

# Chromium 키오스크 모드 실행
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --no-first-run \
  --check-for-update-interval=31536000 \
  http://localhost:5000
