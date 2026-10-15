@echo off
rem 바다 위의 섬: PC 게임으로 실행 (전체 화면, 소리 바로 재생)
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --autoplay-policy=no-user-gesture-required --user-data-dir="%LOCALAPPDATA%\sea_island_profile" --start-fullscreen --app="file:///%~dp0index.html"
