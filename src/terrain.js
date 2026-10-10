// 지형 관리: 타일맵 데이터 + 충돌 질의. 렌더링/입력은 모른다.
(function (G) {
  const { TILE } = G.Config;

  class Terrain {
    // rows: 문자열 배열. '#' = 솔리드, 'P' = 플레이어 시작점, 'H'/'L'/'K'/'W'/'A'/'V'/'D'/'X' = 장식·상점·마을 사람·동굴 입구/출구, 그 외 = 빈 공간
    constructor(rows) {
      this.rows = rows.length;
      this.cols = Math.max(...rows.map((r) => r.length));
      this.width = this.cols * TILE;
      this.height = this.rows * TILE;
      this.spawn = { x: TILE, y: TILE };
      this.grid = [];
      this.slimeSpawns = [];
      this.batSpawns = [];
      this.crabSpawns = [];
      this.golemSpawns = []; // 흙괴물 (G)
      this.darkStoneSpawns = []; // 어둠의 돌 (k)
      this.shadeSpawns = [];     // 시크너의 그림자 (j)
      this.story = null;         // 이야기 진행 (다크월드 문을 보일지 정한다). main이 연결한다
      this.homeLots = [];    // 마을의 내 집 터 (Y)
      this.home = null;      // 인벤토리의 home (산 집 종류, 놓은 장식품). main이 연결한다
      this.homeSlots = [];   // 집 안의 꾸밀 자리 (home 스테이지에서 main이 채운다)
      this.treasure = null; // 보물 상자 위치 {col,row}
      this.houses = [];     // 해변 집 위치 {col,row} (장식)
      this.luggage = [];    // 짐더미 위치 {col,row} (장식)
      this.shops = [];      // 상점 {col,row,kind:'potion'|'sword'}
      this.villagers = [];  // 마을 사람 {col,row}
      this.caveEntrances = []; // 마을의 동굴 입구 {col,row}
      this.waters = [];     // 숲의 샘물 'w' {col,row}: 어둠의 크리스탈을 씻는다
      this.altars = [];     // 화산의 신성의 제단 'v' {col,row}: 정화된 크리스탈을 신성 크리스탈로 바꾼다
      this.exits = [];      // 동굴의 마을 출구 {col,row}
      this.gates = [];      // 마을의 스테이지 문 {col,row,stage}: F 숲, N 설산, M 화산

      rows.forEach((line, r) => {
        const row = [];
        for (let c = 0; c < this.cols; c++) {
          const ch = line[c] || '.';
          row.push(ch === '#');
          if (ch === 'P') this.spawn = { col: c, row: r };
          if (ch === 'S') this.slimeSpawns.push({ col: c, row: r });
          if (ch === 'B') this.batSpawns.push({ col: c, row: r });
          if (ch === 'C') this.crabSpawns.push({ col: c, row: r });
          if (ch === 'G') this.golemSpawns.push({ col: c, row: r });
          if (ch === 'k') this.darkStoneSpawns.push({ col: c, row: r });
          if (ch === 'j') this.shadeSpawns.push({ col: c, row: r });
          if (ch === 'E') this.shops.push({ col: c, row: r, kind: 'dweapon' });
          if (ch === 'I') this.shops.push({ col: c, row: r, kind: 'ditem' });
          if (ch === 'a') this.shops.push({ col: c, row: r, kind: 'darmor' });
          if (ch === 'p') this.shops.push({ col: c, row: r, kind: 'pants' });
          if (ch === 'g') this.shops.push({ col: c, row: r, kind: 'weapon2' });
          if (ch === 'm') this.shops.push({ col: c, row: r, kind: 'mgshell' });
          if (ch === 'n') this.shops.push({ col: c, row: r, kind: 'mgtarget' });
          if (ch === 'd') this.shops.push({ col: c, row: r, kind: 'mgduel' });
          if (ch === 'q') this.shops.push({ col: c, row: r, kind: 'mggun' });
          if (ch === 'O') this.shops.push({ col: c, row: r, kind: 'dupgrade' });
          if (ch === 'Z') this.gates.push({ col: c, row: r, stage: 'darkhub' });
          if (ch === 'J') this.gates.push({ col: c, row: r, stage: 'dungeon' });
          if (ch === 'T') this.treasure = { col: c, row: r };
          if (ch === 'H') this.houses.push({ col: c, row: r });
          if (ch === 'L') this.luggage.push({ col: c, row: r });
          if (ch === 'K') this.shops.push({ col: c, row: r, kind: 'potion' });
          if (ch === 'W') this.shops.push({ col: c, row: r, kind: 'sword' });
          if (ch === 'A') this.shops.push({ col: c, row: r, kind: 'armor' });
          if (ch === 'U') this.shops.push({ col: c, row: r, kind: 'mine' });
          if (ch === 'R') this.shops.push({ col: c, row: r, kind: 'estate' });
          if (ch === 'Q') this.shops.push({ col: c, row: r, kind: 'decor' });
          if (ch === 'Y') this.homeLots.push({ col: c, row: r });
          if (ch === 'V') this.villagers.push({ col: c, row: r });
          if (ch === 'D') this.caveEntrances.push({ col: c, row: r });
          if (ch === 'X') this.exits.push({ col: c, row: r });
          if (ch === 'w') this.waters.push({ col: c, row: r });
          if (ch === 'v') this.altars.push({ col: c, row: r });
          if (ch === 'F') this.gates.push({ col: c, row: r, stage: 'forest' });
          if (ch === 'u') this.gates.push({ col: c, row: r, stage: 'orecave' });
          if (ch === 'N') this.gates.push({ col: c, row: r, stage: 'snow' });
          if (ch === 'M') this.gates.push({ col: c, row: r, stage: 'volcano' });
        }
        this.grid.push(row);
      });
    }

    // 맵 위/좌/우 바깥은 벽, 아래쪽 바깥은 허공(낙사 -> 리스폰)
    isSolid(col, row) {
      if (col < 0 || col >= this.cols || row < 0) return true;
      if (row >= this.rows) return false;
      return this.grid[row][col];
    }

    // 주어진 AABB와 겹치는 솔리드 타일들의 사각형 목록
    solidTilesIn(x, y, w, h) {
      const EPS = 0.001; // 경계에 딱 붙은 상태는 "겹침"이 아니다
      const c0 = Math.floor(x / TILE);
      const c1 = Math.floor((x + w - EPS) / TILE);
      const r0 = Math.floor(y / TILE);
      const r1 = Math.floor((y + h - EPS) / TILE);
      const out = [];
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (this.isSolid(c, r)) out.push({ x: c * TILE, y: r * TILE, w: TILE, h: TILE });
        }
      }
      return out;
    }

    // 빈 타일이면서 바로 아래가 땅인 곳 = 서 있을 수 있는 자리 (몹 배치 후보)
    standingSpots() {
      const out = [];
      for (let r = 0; r < this.rows - 1; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (!this.grid[r][c] && this.grid[r + 1][c]) out.push({ col: c, row: r });
        }
      }
      return out;
    }

    // 타일 바닥 중앙에 서도록 px 좌표로 변환 (엔티티 크기 필요)
    placeOnTile(col, row, entityW, entityH) {
      return {
        x: col * TILE + (TILE - entityW) / 2,
        y: (row + 1) * TILE - entityH,
      };
    }

    // 타일 한가운데에 놓이도록 px 좌표로 변환 (날아다니는 몹용)
    centerOnTile(col, row, entityW, entityH) {
      return {
        x: col * TILE + (TILE - entityW) / 2,
        y: row * TILE + (TILE - entityH) / 2,
      };
    }

    spawnFor(entityW, entityH) {
      const s = this.spawn;
      if (s.col === undefined) return { x: s.x, y: s.y };
      return this.placeOnTile(s.col, s.row, entityW, entityH);
    }
  }

  G.Terrain = Terrain;
})(window.Game);
