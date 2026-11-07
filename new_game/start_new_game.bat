@echo off
rem 새 게임: PC 게임으로 실행
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --user-data-dir="%LOCALAPPDATA%\new_game_profile" --app="file:///%~dp0index.html"
