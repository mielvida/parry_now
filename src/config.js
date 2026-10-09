// 게임 전역 상수. 수치 튜닝은 이 파일에서만 한다.
window.Game = window.Game || {};

Game.Config = {
  TILE: 32,            // 타일 한 변 (px)
  VIEW_W: 960,         // 화면 해상도
  VIEW_H: 576,
  DT: 1 / 60,          // 고정 시간 스텝 (초)

  // 플레이어 (단위: px, px/s, px/s²)
  PLAYER_W: 24,
  PLAYER_H: 32,
  MOVE_SPEED: 220,
  ACCEL_GROUND: 2400,
  ACCEL_AIR: 1600,
  GRAVITY: 1800,
  MAX_FALL_SPEED: 900,  // 타일 높이(32px)보다 한 프레임 이동량이 작도록 제한 -> 터널링 방지
  JUMP_SPEED: 640,      // 최대 점프 높이 ≈ v²/2g ≈ 114px (약 3.5타일)
  JUMP_CUT_GRAVITY: 2,  // 점프 키를 일찍 떼면 상승 중 중력을 N배로 -> 가변 점프 높이
  COYOTE_TIME: 0.1,     // 발판을 떠난 직후에도 점프 허용 (초)
  JUMP_BUFFER: 0.1,     // 착지 직전에 누른 점프 입력 기억 (초)
};
