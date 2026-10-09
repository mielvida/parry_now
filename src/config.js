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
  // 슬라임
  SLIME_W: 28,
  SLIME_H: 24,
  SLIME_WALK_SPEED: 50,
  SLIME_CHASE_SPEED: 100,
  SLIME_SIGHT_X: 192,      // 이 범위 안에 플레이어가 들어오면 추적 (6타일)
  SLIME_SIGHT_Y: 96,
  SLIME_GRAVITY_SCALE: 0.35, // 슬라임 전용 중력 배율: 낮을수록 느리고 둥실한 점프
  SLIME_JUMP_SPEED: 227,   // 높이 ≈ 38px: 1타일(32px) 턱은 오르고 2타일(64px)은 못 오름
  SLIME_JUMP_RANGE: 64,    // 추적 중 플레이어와 가로 거리가 이 안(2타일)이면 점프
  SLIME_JUMP_COOLDOWN: 1.0,
  SLIME_AIR_SPEED_MULT: 0.5, // 공중에서는 가로 속도가 절반으로 느려짐
  SLIME_CROUCH_TIME: 0.15, // 점프 직전 웅크리는 시간
  SLIME_LAND_TIME: 0.18,   // 착지 후 납작해지는 시간
  SLIME_SAFE_DROP: 3,      // 추적 중 이 타일 수 안에 바닥이 있으면 낭떠러지로 보지 않음

  COYOTE_TIME: 0.1,    // 발판을 떠난 직후에도 점프 허용 (초)
  JUMP_BUFFER: 0.1,     // 착지 직전에 누른 점프 입력 기억 (초)
};
