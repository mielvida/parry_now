// 게임 전역 상수. 수치 튜닝은 이 파일에서만 한다.
window.Game = window.Game || {};

Game.Config = {
  TILE: 32,            // 타일 한 변 (px)
  VIEW_W: 960,         // 화면 해상도
  VIEW_H: 576,
  DT: 1 / 60,          // 고정 시간 스텝 (초)

  PIXEL: 1,            // 픽셀 화면: 월드를 게임 화면의 1/PIXEL 해상도(480x288, 타일 16px)로 그려 정수배로 키운다. 1이면 끔
  SMOOTH_SPRITES: true, // 움직이는 것(캐릭터, 몬스터, 이펙트)은 도트 격자에 맞추지 않고 반 도트 단위로 부드럽게 그린다. false면 칼같이 도트에 맞춤
  POSTERIZE: 0,        // (노이즈로 보여서 끔) 16 같은 값을 주면 색을 거칠게 줄인다
  POSTERIZE_UNUSED: 16,       // 픽셀 화면의 색 단계 (클수록 색이 거칠다. 옛날 게임 느낌, 너무 크면 얼룩져 보인다). 0이면 끔
  INTRO_CUTSCENE: true, // 처음 시작할 때 보물 지도 컷신을 재생 (Enter/Space로 건너뛰기)
  CHEST_W: 28,
  CHEST_H: 24,
  DOOR_W: 30,
  DOOR_H: 40,
  PLAYER_LIVES: 3,     // 시작 목숨 수
  PLAYER_INVULN: 1.5,  // 피격 후 무적 시간 (초). 같은 슬라임에게 연속으로 맞는 것을 막는다
  GAME_OVER_DELAY: 1,  // 게임오버 후 재시작 입력을 받기 시작하는 시간 (연타로 건너뛰기 방지)

  // 플레이어 (단위: px, px/s, px/s²)
  PLAYER_W: 24,
  PLAYER_H: 32,
  MOVE_SPEED: 220,
  ACCEL_GROUND: 2400,
  ACCEL_AIR: 1600,
  ACCEL_ICE: 520,       // 얼음 바닥(설산)에서의 가속/감속: 미끄럽다
  GRAVITY: 1800,
  MAX_FALL_SPEED: 900,  // 타일 높이(32px)보다 한 프레임 이동량이 작도록 제한 -> 터널링 방지
  JUMP_SPEED: 640,      // 최대 점프 높이 ≈ v²/2g ≈ 114px (약 3.5타일)
  DASH_TILES: 3,        // Shift 대시 거리 (타일)
  DASH_SPEED: 600,      // 대시 속도 (px/s). 거리를 다 가면 끝난다 (96px / 600 = 약 0.16초: 날아가는 모습이 보이게)
  DASH_COOLDOWN: 0.7,   // 대시 후 다음 대시까지 대기 (초)
  DASH_TRAIL: 0.3,      // 대시 잔상이 남는 시간 (초)
  DASH_GRACE: 0.2,      // 대시가 끝난 뒤에도 잠시 맞지 않는 시간 (몬스터 몸 안에서 끝나도 바로 맞지 않게)
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
  // 꽃게 (해변의 몬스터. 옆걸음 + 집게를 치켜든 뒤 옆으로 돌진)
  CRAB_W: 30,
  CRAB_H: 20,
  CRAB_WALK_SPEED: 40,
  CRAB_CHASE_SPEED: 80,
  CRAB_SIGHT_X: 224,       // 이 범위 안에 플레이어가 들어오면 추적 (7타일)
  CRAB_SIGHT_Y: 64,
  CRAB_ATTACK_RANGE: 128,  // 가로 거리가 이 안(4타일)이면 돌진 예비동작
  CRAB_WINDUP: 0.45,       // 집게를 치켜드는 예비동작 시간 (패링 타이밍을 읽을 수 있게)
  CRAB_DASH_SPEED: 300,
  CRAB_DASH_TIME: 0.45,
  CRAB_COOLDOWN: 1.6,      // 돌진 후 다음 돌진까지 대기
  CRAB_COIN: 8,            // 꽃게를 쓰러뜨리면 떨어뜨리는 코인
  SLIME_COIN: 5,           // 슬라임을 쓰러뜨리면 떨어뜨리는 코인
  BAT_COIN: 6,             // 박쥐를 쓰러뜨리면 떨어뜨리는 코인
  SLIME_EXP: 1,            // 몬스터를 쓰러뜨리면 얻는 경험치
  BAT_EXP: 2,
  CRAB_EXP: 3,
  GOLEM_EXP: 3,
  GOLDEN_BAT_CHANCE: 0.05, // 박쥐가 생기거나 부활할 때 황금박쥐가 될 확률 (아주 가끔)
  GOLDEN_BAT_HP: 5,        // 황금박쥐 체력: 근접 공격은 한 대에 1씩 깎여서 5대를 때려야 죽는다 (독 3은 부족)
  GOLDEN_BAT_SPEED: 1.35,  // 황금박쥐는 더 빠르다
  GOLDEN_BAT_COIN: 200,    // 황금박쥐가 떨어뜨리는 코인
  MINE_COINS: 100,         // 마을 동굴 보물 상자의 코인 (업그레이드 1레벨)
  MINE_COINS_PER_LEVEL: 25, // 동굴 보상 업그레이드 한 레벨마다 늘어나는 상자 코인 (15레벨 = 450)
  MINE_MAX_LEVEL: 15,      // 동굴 보상 업그레이드 최고 레벨
  MINE_UPGRADE_PRICE: 100, // 1 -> 2레벨 업그레이드 가격
  MINE_UPGRADE_STEP: 30,   // 레벨이 오를수록 가격이 이만큼씩 늘어난다
  CRIT_BASE_DAMAGE: 10,    // 치명타 대미지 (0레벨). 보상 상점에서 한 레벨마다 +1, 20레벨이면 30
  CRIT_MAX_LEVEL: 20,
  CRIT_UPGRADE_PRICE: 200, // 1레벨 업그레이드 가격
  CRIT_UPGRADE_STEP: 80,   // 레벨이 오를수록 가격이 이만큼씩 늘어난다
  CRIT_BASE_CHANCE: 0.01,  // 기본 치명타 확률 (1%). 집 장식을 놓을수록 오른다
  DECOR_COIN_BONUS: 0.1,   // 집에 장식품(가구)을 하나 놓을 때마다 코인 획득량이 이만큼(+10%) 늘어난다
  DECOR_CRIT_BONUS: 0.003, // 집에 장식품을 하나 놓을 때마다 치명타 확률이 이만큼(+0.3%) 늘어난다
  // 이야기와 다크월드: 마을 동굴을 15번 클리어하면 시크너의 이야기가 나오고 다크월드로 가는 문이 열린다
  CAVE_CLEARS_FOR_STORY: 15,
  DUNGEON_FLOORS: 100,     // 다크월드 던전 층 수 (100층에 시크너)
  STAMINA_MAX: 100,        // 스태미나 최대치: 대시와 폭탄/총/활 공격에 쓴다
  STAMINA_REGEN: 16,       // 초당 회복량
  STAMINA_MAX_LEVELS: 20,  // 보상 상점: 스태미나 최대 강화 레벨 (20레벨: 100 -> 500)
  STAMINA_MAX_STEP: 20,    // 레벨마다 최대 스태미나 +20
  STAMINA_MAX_PRICE: 300,  // 1레벨 가격 (레벨마다 STEP씩 늘어난다)
  STAMINA_MAX_PRICE_STEP: 120,
  STAMINA_REGEN_LEVELS: 10, // 보상 상점: 스태미나 회복 속도 최대 강화 레벨
  STAMINA_REGEN_STEP: 6,   // 레벨마다 초당 회복량 +6 (16 -> 76)
  STAMINA_REGEN_PRICE: 300,
  STAMINA_REGEN_PRICE_STEP: 220,
  DASH_STAMINA: 25,        // 대시 한 번에 드는 스태미나
  BOSS_STONE_HP: 1500,     // 정의의 어둠돌 (33층)
  BOSS_JUSTICE_HP: 3000,   // 정의의 어둠 (66층)
  BOSS_SIKNER_HP: 8000,    // 시크너 (100층, 최종보스)
  DARKSTONE_COIN: 15,
  DARKSTONE_EXP: 4,
  SHADE_COIN: 18,
  SHADE_EXP: 5,
  VILLAGE_SPEED_MAX: 3,    // 마을 달리기 업그레이드 최고 레벨의 이동 속도 배수 (마을에서만 적용)
  VILLAGE_SPEED_LEVELS: 5, // 마을 달리기 업그레이드 레벨 수
  VILLAGE_SPEED_PRICE: 300, // 1레벨 가격
  VILLAGE_SPEED_STEP: 150, // 레벨이 오를수록 가격이 이만큼씩 늘어난다
  TREASURE_COINS: 50,      // 동굴 보물 상자에서 얻는 코인
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
  PARRY_KNOCK_VX: 520,     // 튕겨나가는 가로 속도
  PARRY_KNOCK_VY: 380,     // 튕겨나가는 위쪽 속도
  PARRY_MAX_FLIGHT: 2,     // 패링에 맞은 슬라임이 아무것에도 안 닿아도 이 시간(초) 뒤엔 터짐
  SLIME_RESPAWN_TIME: 3,   // 터진 슬라임이 부활하기까지의 시간 (초)
  SLIME_APPEAR_TIME: 0.4,  // 부활 직후 나타나는 연출 시간 (이 동안은 해롭지 않음)
  // 몬스터 체력/마법 피해 (슬라임·꽃게 3, 박쥐 2). 독: 3초 동안 1초마다 1씩, 총 3
  POISON_TICKS: 3,
  POISON_TICK_DAMAGE: 1,
  FIRE_DAMAGE: 2,
  BURN_TICKS: 3,           // 화염 무기: 불타는 동안 1초마다 1씩, 총 3
  BURN_TICK_DAMAGE: 1,
  FREEZE_TIME: 2.5,        // 서리 무기: 얼어붙어 있는 시간 (이 안에 다시 때려도 되고, 맞으면 얼음 조각으로 부서진다)
  LIGHTNING_DAMAGE: 1,
  // 슬라임·꽃게(2번 맞아야 죽는 몬스터): 첫 타에 밀려나 기절하고, 기절 중에 다시 맞으면 날아가 터진다
  PUSH_DIST: 64,           // 첫 타에 밀려나는 거리 (2타일)
  PUSH_TIME: 0.15,         // 밀려나는 데 걸리는 시간
  STAGGER_TIME: 1.5,       // 기절해 있는 시간 (이 안에 다시 때려야 죽는다. 지나면 다시 움직인다)
  HIT_GRACE: 0.35,         // 첫 타 직후 이 시간 동안은 같은 휘두르기로 두 번 맞지 않는다
  GUARD_TIME: 0.35,        // 패링 성공 후 가드 자세를 유지하는 시간
  HIT_STOP: 0.07,          // 패링 성공 순간 화면이 멈추는 시간 (타격감)

  // 화산 스테이지: 몬스터가 더 빠르고, 맨 끝에서 용머리 3개와 싸운다
  VOLCANO_MOB_SPEED: 1.4,  // 화산에서는 모든 몬스터의 이동 속도가 이 배수로 빨라진다
  BOSS_HEAD_HP: 100,        // 용머리 하나의 체력 (근접 한 대 = 1, 대검/전설의 검 = 2, 불 마법 = 2)
  BOSS_STUN_TIME: 2.5,     // 5패턴마다 모든 머리가 기절하는 시간 (이때 땅에 떨어져 있어 때릴 수 있다)
  BOSS_SLAM_DOWN: 1.5,     // 머리 찍기 후 땅에 박혀 있는 시간 (이때 때릴 수 있다)
  BOSS_PARRY_DAMAGE: 8,    // 꼬리/머리 찍기를 패링으로 쳐냈을 때 머리가 입는 피해
  BOSS_METEOR_DAMAGE: 3,     // 패링으로 쳐낸 운석이 머리에 주는 피해
  BOSS_ICE_BONUS: 3,       // 얼음 속성 무기는 보스(불의 용)에게 한 대당 이만큼 더 큰 피해
  BOSS_LAVA_HEIGHT: 60,    // 용암 패턴: 바닥에서 용암이 이만큼 차오른다 (위 발판으로 올라가 피한다)
  BOSS_REFLECT_DAMAGE: 6,  // 패링으로 되튕긴 화염구가 머리에 주는 피해

  // 설산: 몬스터가 느리지만 한 방이 아프다. 끝에는 하얀 털복숭이 보스
  SNOW_MOB_SPEED: 0.6,     // 설산에서는 모든 몬스터의 이동 속도가 이 배수로 느려진다
  SNOW_MOB_DAMAGE: 2,      // 설산 몬스터에게 닿으면 목숨이 이만큼 깎인다
  BOSS_KING_HP: 500,       // 왕슬라임 보스 체력 (숲)
  BOSS_YETI_HP: 1000,       // 털복숭이 침팬지 보스 체력
  BOSS_FIRE_BONUS: 3,      // 불 속성 무기는 털복숭이 침팬지에게 한 대당 이만큼 더 큰 피해
  // 흙괴물 (설산)
  GOLEM_W: 34,
  GOLEM_H: 38,
  GOLEM_WALK_SPEED: 32,
  GOLEM_CHASE_SPEED: 58,
  GOLEM_SIGHT_X: 224,
  GOLEM_SIGHT_Y: 72,
  GOLEM_ATTACK_RANGE: 110, // 가로 거리가 이 안이면 몸 던지기 예비동작
  GOLEM_WINDUP: 0.6,
  GOLEM_LUNGE_SPEED: 280,
  GOLEM_LUNGE_TIME: 0.35,
  GOLEM_COOLDOWN: 2.0,
  GOLEM_COIN: 10,          // 흙괴물을 쓰러뜨리면 떨어뜨리는 코인

  COYOTE_TIME: 0.1,    // 발판을 떠난 직후에도 점프 허용 (초)
  JUMP_BUFFER: 0.1,     // 착지 직전에 누른 점프 입력 기억 (초)
};
