@echo off
rem Starts the game with music playing immediately (no click needed)
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --autoplay-policy=no-user-gesture-required --user-data-dir="%LOCALAPPDATA%\parry_now_profile" --app="file:///%~dp0index.html"
