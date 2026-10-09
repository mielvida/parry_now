// 게임 전역 상수. 수치 튜닝은 이 파일에서만 한다.
window.Game = window.Game || {};

Game.Config = {
  TILE: 32,            // 타일 한 변 (px)
  VIEW_W: 960,         // 화면 해상도
  VIEW_H: 576,
  DT: 1 / 60,          // 고정 시간 스텝 (초)

  PLAYER_LIVES: 3,     // 시작 목숨 수
  PLAYER_INVULN: 1.5,  // 피격 후 무적 시간 (초). 같은 슬라임에게 연속으로 맞는 것을 막는다
  GAME_OVER_DELAY: 1,  // 게임오버 후 재시작 입력을 받기 시작하는 시간 (연타로 건너뛰기 방지)

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
  // 박쥐 (날아다니는 몬스터)
  BAT_W: 28,
  BAT_H: 20,
  BAT_PATROL_SPEED: 60,
  BAT_CHASE_SPEED: 120,
  BAT_DIVE_SPEED: 220,     // 급강하 속도 (패링 타이밍을 읽을 수 있게 느리게)
  BAT_SIGHT_X: 224,        // 이 범위 안에 플레이어가 들어오면 추적 (7타일)
  BAT_SIGHT_Y: 192,
  BAT_HOVER: 96,           // 추적 중 플레이어 위쪽 이 높이에서 맴돈다
  BAT_WINDUP: 0.4,         // 급강하 직전 예비동작 시간
  BAT_DIVE_TIME: 0.9,      // 급강하 최대 지속 시간
  BAT_COOLDOWN: 1.6,       // 급강하 후 다음 급강하까지 대기
  SLIME_SPAWN_BATCH: 30,   // - 키를 한 번 누를 때 소환되는 슬라임 수
  SLIME_MAX: 300,          // 슬라임 총 수 상한 (성능 보호)
  SLIME_SAFE_DROP: 3,      // 추적 중 이 타일 수 안에 바닥이 있으면 낭떠러지로 보지 않음

  // 패링
  PARRY_WINDOW: 0.3,       // 패링 버튼을 누른 뒤 판정이 유지되는 시간 (초)
  SWING_FRAMES: 20,        // 검 휘두르기 애니메이션 프레임 수 (60Hz 기준 약 0.33초)
  SWING_SLASH_FRAME: 5,    // 이 프레임부터 실제로 베기 시작 (앞의 0~4는 치켜들기)
  // 검 던지기 (패링 버튼 길게 누르기)
  SWORD_MIN_HOLD: 0.3,     // 이 시간(초) 이상 누르고 떼야 검을 던진다 (짧게 톡 누르면 패링만)
  SWORD_CHARGE_TIME: 1.5,  // 이 시간(초) 이상 누르면 게이지 가득
  SWORD_SHORT_TILES: 1,    // 게이지가 절반에 못 미친 채 뗐을 때 날아가는 거리 (타일)
  SWORD_HALF_GAUGE: 0.5,   // 이 비율(게이지 절반)을 넘으면 SWORD_MIN_TILES부터 늘어나기 시작
  SWORD_MIN_TILES: 1,      // 게이지가 절반을 막 넘었을 때 날아가는 거리 (타일). 여기서 가득(4칸)까지 비례
  SWORD_THROW_TILES: 4,    // 가득 채웠을 때 날아가는 거리 (타일). 그 사이는 채운 만큼 비례
  SWORD_OUT_SPEED: 600,    // 나가는 속도 (px/s)
  SWORD_BACK_SPEED: 700,   // 돌아오는 속도 (px/s)
  SWORD_CATCH_RADIUS: 12,  // 손에서 이 거리 안이면 다시 잡음
  PARRY_COOLDOWN: 0.6,     // 다음 패링까지 대기 (연타 방지)
  PARRY_REACH: 12,         // 플레이어 몸에서 이 거리(px) 안의 몹까지 튕겨냄
  PARRY_KNOCK_VX: 520,     // 튕겨나가는 가로 속도
  PARRY_KNOCK_VY: 380,     // 튕겨나가는 위쪽 속도
  PARRY_MAX_FLIGHT: 2,     // 패링에 맞은 슬라임이 아무것에도 안 닿아도 이 시간(초) 뒤엔 터짐
  SLIME_RESPAWN_TIME: 3,   // 터진 슬라임이 부활하기까지의 시간 (초)
  SLIME_APPEAR_TIME: 0.4,  // 부활 직후 나타나는 연출 시간 (이 동안은 해롭지 않음)
  HIT_STOP: 0.07,          // 패링 성공 순간 화면이 멈추는 시간 (타격감)

  COYOTE_TIME: 0.1,    // 발판을 떠난 직후에도 점프 허용 (초)
  JUMP_BUFFER: 0.1,     // 착지 직전에 누른 점프 입력 기억 (초)
};
