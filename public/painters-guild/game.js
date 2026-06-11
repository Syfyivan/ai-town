(() => {
  const WORLD = { width: 1100, height: 680 };
  const PLAYER_BOUNDS = { minX: 72, maxX: 1030, minY: 236, maxY: 590 };
  const INTERACT_DISTANCE = 128;
  const PHASES = ["构图", "打底", "上色", "精修", "装裱"];
  const STYLES = {
    portrait: { label: "肖像", colors: ["#b95b49", "#f0c889", "#2d2530"] },
    religious: { label: "宗教", colors: ["#d7ad55", "#678cc4", "#f6e1aa"] },
    landscape: { label: "风景", colors: ["#6f9d5f", "#4ba393", "#d2b86c"] },
    poster: { label: "海报", colors: ["#c7644b", "#d9aa4c", "#2aa198"] },
    abstract: { label: "实验", colors: ["#8d6aa9", "#5f92c8", "#d9aa4c"] }
  };
  const MODE_DATA = {
    fast: { label: "快画", speed: 1.36, quality: -0.012, fatigue: 1.25 },
    steady: { label: "稳画", speed: 1, quality: 0.008, fatigue: 1 },
    detail: { label: "精修", speed: 0.72, quality: 0.028, fatigue: 1.1 }
  };
  const ROLE_DATA = {
    sketch: { label: "速写师", phase: "构图" },
    finisher: { label: "精修师", phase: "精修" },
    mixer: { label: "调色师", phase: "上色" },
    social: { label: "社交画家", phase: "装裱" },
    apprentice: { label: "学徒", phase: "构图" }
  };
  const CLIENTS = [
    { name: "咖啡馆老板", place: "咖啡馆", style: "poster" },
    { name: "镇长办公室", place: "镇政厅", style: "portrait" },
    { name: "学校老师", place: "学校走廊", style: "landscape" },
    { name: "教堂管事", place: "教堂侧廊", style: "religious" },
    { name: "广场策展人", place: "小镇广场", style: "abstract" },
    { name: "面包店姐妹", place: "面包店", style: "poster" },
    { name: "旅店老板", place: "旅店大厅", style: "landscape" }
  ];
  const TITLES = {
    portrait: ["纪念肖像", "候选人画像", "家族小像", "店主肖像"],
    religious: ["祭坛草图", "圣徒壁画", "节日宗教画", "穹顶习作"],
    landscape: ["河岸风景", "花园长卷", "晨雾小景", "小镇远眺"],
    poster: ["新店招牌", "节日海报", "菜单插画", "工坊广告"],
    abstract: ["实验挂画", "色块练习", "梦境屏风", "新派展品"]
  };

  const els = {
    canvas: document.getElementById("guildCanvas"),
    day: document.getElementById("dayLabel"),
    clock: document.getElementById("clockLabel"),
    coins: document.getElementById("coinLabel"),
    wage: document.getElementById("wageLabel"),
    paint: document.getElementById("paintLabel"),
    prestige: document.getElementById("prestigeLabel"),
    orders: document.getElementById("orderList"),
    painters: document.getElementById("painterList"),
    log: document.getElementById("eventLog"),
    selected: document.getElementById("selectedLabel"),
    art: document.getElementById("artStrip"),
    artCount: document.getElementById("artCountLabel"),
    pause: document.getElementById("pauseButton"),
    speed: document.getElementById("speedButton"),
    reset: document.getElementById("resetButton"),
    newOrder: document.getElementById("newOrderButton"),
    modeButtons: [...document.querySelectorAll("[data-mode]")]
  };

  const ctx = els.canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const stationTemplates = [
    { id: "door", type: "door", label: "门口", x: 72, y: 128, w: 118, h: 130, slots: 1 },
    { id: "easel-small", type: "easel", label: "小画架", x: 255, y: 162, w: 138, h: 160, slots: 1, size: "small" },
    { id: "easel-large", type: "easel", label: "大画架", x: 505, y: 142, w: 226, h: 190, slots: 3, size: "large" },
    { id: "apprentice-desk", type: "desk", label: "学徒桌", x: 815, y: 162, w: 130, h: 135, slots: 1 },
    { id: "mixer", type: "mixer", label: "调色台", x: 142, y: 410, w: 138, h: 122, slots: 1 },
    { id: "bed", type: "bed", label: "床", x: 340, y: 430, w: 164, h: 110, slots: 1 },
    { id: "gallery", type: "gallery", label: "展示墙", x: 610, y: 420, w: 164, h: 122, slots: 1 },
    { id: "storage", type: "storage", label: "颜料柜", x: 856, y: 406, w: 146, h: 135, slots: 1 }
  ];

  const initialPainters = [
    createPainter("p1", "青岚", "sketch", "#4c8e62", "#6a3329", "door", 42),
    createPainter("p2", "阿澈", "finisher", "#547da8", "#3b2a28", "easel-small", 48),
    createPainter("p3", "南星", "mixer", "#b86a52", "#8b4b33", "mixer", 38),
    createPainter("p4", "小满", "social", "#8d6aa9", "#502d66", "gallery", 34),
    createPainter("me", "我", "apprentice", "#d38b54", "#6c3b28", "apprentice-desk", 9, true)
  ];

  let lastTime = performance.now();
  let uiTimer = 0;
  let hoveredStationId = "";
  let state = createState();
  const movementKeys = new Set();

  function createPainter(id, name, role, shirt, hair, stationId, skill, isPlayer = false) {
    return {
      id,
      name,
      role,
      shirt,
      hair,
      stationId,
      slotIndex: 0,
      targetStationId: stationId,
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      skill,
      fatigue: isPlayer ? 8 : 14,
      mood: 74,
      action: "idle",
      mode: "steady",
      isPlayer,
      contributed: new Set()
    };
  }

  function createState() {
    const nextState = {
      day: 1,
      minute: 8 * 60,
      dayCarry: 0,
      coins: 120,
      wage: 0,
      paint: 54,
      paintMax: 90,
      prestige: 8,
      speed: 1,
      paused: false,
      mode: "steady",
      selectedPainterId: "me",
      directorTimer: 0,
      orderTimer: 0,
      artSerial: 1,
      orders: [],
      tasks: [],
      paintings: [],
      stations: stationTemplates.map((station) => ({ ...station })),
      painters: initialPainters.map((painter) => ({ ...painter, contributed: new Set() })),
      log: []
    };

    normalizePainterSlots(nextState);
    for (const painter of nextState.painters) {
      const point = stationSlotPoint(nextState, painter.stationId, painter.slotIndex);
      painter.x = point.x;
      painter.y = point.y;
      painter.targetX = point.x;
      painter.targetY = point.y;
      syncPainterAction(nextState, painter);
    }

    nextState.orders.push(generateOrder(nextState, false));
    nextState.orders.push(generateOrder(nextState, true));
    nextState.orders.push(generateOrder(nextState, false));
    addLog(nextState, "画室开张，第一批客户已经到了。");
    addLog(nextState, "你作为学徒开始今天的日班。");
    return nextState;
  }

  function stationById(game, stationId) {
    return game.stations.find((station) => station.id === stationId);
  }

  function painterById(game, painterId) {
    return game.painters.find((painter) => painter.id === painterId);
  }

  function taskAtStation(game, stationId) {
    return game.tasks.find((task) => task.stationId === stationId);
  }

  function paintersAtStation(game, stationId) {
    return game.painters
      .filter((painter) => painter.stationId === stationId)
      .sort((a, b) => a.slotIndex - b.slotIndex);
  }

  function normalizePainterSlots(game) {
    for (const station of game.stations) {
      const used = new Set();
      for (const painter of paintersAtStation(game, station.id)) {
        if (!Number.isInteger(painter.slotIndex) || painter.slotIndex < 0 || painter.slotIndex >= station.slots || used.has(painter.slotIndex)) {
          painter.slotIndex = firstOpenSlot(game, station, used);
        }
        used.add(painter.slotIndex);
      }
    }
  }

  function firstOpenSlot(game, station, usedSlots = new Set(), exceptPainterId = "") {
    const used = new Set(usedSlots);
    for (const painter of game.painters) {
      if (painter.id !== exceptPainterId && painter.stationId === station.id && Number.isInteger(painter.slotIndex)) {
        used.add(painter.slotIndex);
      }
    }
    for (let i = 0; i < station.slots; i += 1) {
      if (!used.has(i)) return i;
    }
    return -1;
  }

  function freeSlot(game, station, painterId = "") {
    const painter = painterId ? painterById(game, painterId) : null;
    if (painter?.stationId === station.id && painter.slotIndex >= 0 && painter.slotIndex < station.slots) {
      return painter.slotIndex;
    }
    return firstOpenSlot(game, station, new Set(), painterId);
  }

  function stationSlotPoint(game, stationId, slotIndex = 0) {
    const station = stationById(game, stationId);
    if (!station) return { x: 120, y: 560 };
    const centerX = station.x + station.w / 2;
    const baseY = station.y + station.h - 18;
    if (station.type === "easel") {
      const offsets = station.slots === 3 ? [-42, 0, 42] : [0];
      return { x: centerX + (offsets[slotIndex] || 0), y: station.y + station.h + 8 };
    }
    if (station.type === "bed") return { x: centerX + (slotIndex - 0.5) * 26, y: station.y + station.h - 8 };
    if (station.type === "door") return { x: centerX + 10, y: baseY };
    if (station.type === "gallery") return { x: centerX + 34, y: baseY };
    if (station.type === "storage") return { x: centerX - 28, y: baseY };
    return { x: centerX, y: baseY };
  }

  function assignPainter(game, painterId, stationId, message = "") {
    const painter = painterById(game, painterId);
    const station = stationById(game, stationId);
    if (!painter || !station) return false;
    const slot = freeSlot(game, station, painter.id);
    if (slot < 0) return false;
    painter.stationId = station.id;
    painter.targetStationId = station.id;
    painter.slotIndex = slot;
    const target = stationSlotPoint(game, station.id, slot);
    painter.targetX = target.x;
    painter.targetY = target.y;
    if (message) addLog(game, message);
    syncPainterAction(game, painter);
    return true;
  }

  function syncPainterAction(game, painter) {
    const station = stationById(game, painter.stationId);
    const task = station?.type === "easel" ? taskAtStation(game, station.id) : null;
    if (distance(painter.x, painter.y, painter.targetX, painter.targetY) > 8) {
      painter.action = "walking";
      return;
    }
    if (!station) {
      painter.action = "idle";
    } else if (station.type === "easel") {
      painter.action = task ? "painting" : "waiting";
    } else if (station.type === "mixer") {
      painter.action = "mixing";
    } else if (station.type === "bed") {
      painter.action = "resting";
    } else if (station.type === "desk") {
      painter.action = "studying";
    } else if (station.type === "door") {
      painter.action = "receiving";
    } else if (station.type === "gallery") {
      painter.action = "curating";
    } else if (station.type === "storage") {
      painter.action = "sorting";
    } else {
      painter.action = "idle";
    }
  }

  function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function generateOrder(game, forceRush = false) {
    const client = pick(CLIENTS);
    const style = client.style;
    const rush = forceRush || Math.random() < 0.28;
    const deadline = rush ? 12 + Math.random() * 16 : 48 + Math.random() * 92;
    const base = rush ? 210 : 118;
    const pay = Math.round(base + deadline * (rush ? 7.2 : 1.6) + game.prestige * 7 + Math.random() * 55);
    return {
      id: "order-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7),
      title: pick(TITLES[style]),
      client: client.name,
      place: client.place,
      style,
      rush,
      deadline,
      maxDeadline: deadline,
      pay,
      paintCost: rush ? 8 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 4)
    };
  }

  function acceptOrder(game, orderId, stationId = "", painterId = "") {
    const order = game.orders.find((item) => item.id === orderId);
    if (!order) return false;
    if (game.paint < order.paintCost) {
      addLog(game, "颜料不够，调色台需要先补给。");
      return false;
    }
    const station = stationId ? stationById(game, stationId) : bestFreeEasel(game, true, painterId);
    if (!station) {
      addLog(game, "画架都满了。");
      return false;
    }
    game.orders = game.orders.filter((item) => item.id !== order.id);
    game.paint -= order.paintCost;
    game.tasks.push({
      id: "task-" + order.id,
      stationId: station.id,
      title: order.title,
      client: order.client,
      place: order.place,
      style: order.style,
      rush: order.rush,
      deadline: order.deadline,
      maxDeadline: order.maxDeadline,
      pay: order.pay,
      progress: 0,
      phaseIndex: 0,
      quality: 58 + Math.random() * 10,
      playerHelped: false
    });
    addLog(game, (order.rush ? "加急" : "普通") + "《" + order.title + "》挂到" + station.label + "。");
    for (const painter of paintersAtStation(game, station.id)) syncPainterAction(game, painter);
    return station.id;
  }

  function bestFreeEasel(game, preferPlayer = false, painterId = "") {
    const me = painterById(game, "me");
    if (preferPlayer) {
      const current = stationById(game, me.stationId);
      if (current?.type === "easel" && !taskAtStation(game, current.id)) return current;
    }
    return game.stations
      .filter((station) => station.type === "easel" && !taskAtStation(game, station.id))
      .filter((station) => !painterId || freeSlot(game, station, painterId) >= 0)
      .sort((a, b) => {
        const playerPenaltyA = paintersAtStation(game, a.id).some((painter) => painter.id === "me") ? 1 : 0;
        const playerPenaltyB = paintersAtStation(game, b.id).some((painter) => painter.id === "me") ? 1 : 0;
        if (playerPenaltyA !== playerPenaltyB) return playerPenaltyA - playerPenaltyB;
        return b.slots - a.slots;
      })[0];
  }

  function rejectOrder(game, orderId) {
    const order = game.orders.find((item) => item.id === orderId);
    if (!order) return;
    game.orders = game.orders.filter((item) => item.id !== orderId);
    game.prestige = Math.max(0, game.prestige - 1);
    addLog(game, "婉拒了《" + order.title + "》。");
  }

  function addLog(game, text) {
    game.log.unshift(text);
    game.log = game.log.slice(0, 9);
    uiTimer = 999;
  }

  function step(rawDt) {
    const dt = Math.min(rawDt, 0.055) * state.speed;
    const dayDelta = dt * 0.025;
    state.dayCarry += dayDelta;
    state.minute += dayDelta * 24 * 60;
    while (state.minute >= 24 * 60) {
      state.minute -= 24 * 60;
      state.day += 1;
      addLog(state, "第 " + state.day + " 天开始。");
    }

    state.orderTimer += dayDelta;
    if (state.orderTimer > 0.36 && state.orders.length < 4) {
      state.orderTimer = 0;
      const order = generateOrder(state);
      state.orders.push(order);
      addLog(state, order.client + "送来《" + order.title + "》。");
    }

    updatePainters(dt);
    updateTasks(dt, dayDelta);
    updateNpcDirector(dt);
    updateOrderDeadlines(dayDelta);
  }

  function updatePainters(dt) {
    for (const painter of state.painters) {
      if (painter.isPlayer && updateManualMovement(painter, dt)) {
        continue;
      }

      const dx = painter.targetX - painter.x;
      const dy = painter.targetY - painter.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        const speed = painter.id === "me" ? 148 : 122;
        const stepSize = Math.min(dist, speed * dt);
        painter.x += (dx / dist) * stepSize;
        painter.y += (dy / dist) * stepSize;
      }
      syncPainterAction(state, painter);

      if (painter.action === "resting") {
        painter.fatigue = Math.max(0, painter.fatigue - 2.3 * dt);
        painter.mood = Math.min(100, painter.mood + 0.7 * dt);
      } else if (painter.action === "mixing") {
        painter.fatigue = Math.min(100, painter.fatigue + 0.34 * dt);
        painter.skill = Math.min(100, painter.skill + 0.045 * dt);
        state.paint = Math.min(state.paintMax, state.paint + (0.7 + painter.skill / 150) * dt);
      } else if (painter.action === "studying") {
        painter.fatigue = Math.min(100, painter.fatigue + 0.2 * dt);
        painter.skill = Math.min(100, painter.skill + 0.08 * dt);
      } else if (painter.action === "receiving" || painter.action === "curating") {
        painter.fatigue = Math.min(100, painter.fatigue + 0.16 * dt);
        state.prestige = Math.min(99, state.prestige + 0.006 * dt);
      } else if (painter.action === "sorting") {
        painter.fatigue = Math.min(100, painter.fatigue + 0.12 * dt);
        state.paintMax = Math.max(state.paintMax, 90);
      }

      if (painter.fatigue > 85 && painter.action !== "resting") {
        painter.mood = Math.max(15, painter.mood - 0.18 * dt);
      }
    }
  }

  function updateManualMovement(painter, dt) {
    const left = movementKeys.has("KeyA");
    const right = movementKeys.has("KeyD");
    const up = movementKeys.has("KeyW");
    const down = movementKeys.has("KeyS");
    const xAxis = Number(right) - Number(left);
    const yAxis = Number(down) - Number(up);
    if (!xAxis && !yAxis) return false;

    const magnitude = Math.hypot(xAxis, yAxis) || 1;
    const speed = 190;
    painter.stationId = "";
    painter.targetStationId = "";
    painter.slotIndex = -1;
    painter.x = clamp(painter.x + (xAxis / magnitude) * speed * dt, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX);
    painter.y = clamp(painter.y + (yAxis / magnitude) * speed * dt, PLAYER_BOUNDS.minY, PLAYER_BOUNDS.maxY);
    painter.targetX = painter.x;
    painter.targetY = painter.y;
    painter.action = "walking";
    return true;
  }

  function updateTasks(dt, dayDelta) {
    for (const task of [...state.tasks]) {
      task.deadline -= dayDelta;
      if (task.deadline <= 0) {
        failTask(task);
        continue;
      }
      const stationPainters = paintersAtStation(state, task.stationId).filter((painter) => {
        return painter.action === "painting" && distance(painter.x, painter.y, painter.targetX, painter.targetY) <= 10;
      });
      if (!stationPainters.length) continue;

      let speed = 0;
      for (const painter of stationPainters) {
        const mode = MODE_DATA[painter.id === "me" ? state.mode : painter.mode] || MODE_DATA.steady;
        const phase = PHASES[task.phaseIndex] || PHASES[0];
        const roleBonus = ROLE_DATA[painter.role]?.phase === phase ? 0.34 : 0;
        const skillBonus = painter.skill / 130;
        speed += (0.56 + skillBonus + roleBonus) * mode.speed;
        task.quality = clamp(task.quality + (mode.quality + painter.skill / 6200 + roleBonus / 260) * dt, 20, 100);
        painter.fatigue = Math.min(100, painter.fatigue + 0.55 * mode.fatigue * dt);
        painter.skill = Math.min(100, painter.skill + 0.018 * dt);
        if (painter.id === "me") task.playerHelped = true;
      }

      task.progress = clamp(task.progress + speed * dt, 0, 100);
      task.phaseIndex = Math.min(PHASES.length - 1, Math.floor(task.progress / 20));
      if (task.progress >= 100) completeTask(task);
    }
  }

  function completeTask(task) {
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    const reward = Math.round(task.pay * (0.86 + task.quality / 170));
    state.coins += reward;
    state.prestige = Math.min(99, state.prestige + (task.rush ? 4 : 2));
    if (task.playerHelped) {
      const wage = Math.round(reward * 0.12);
      state.wage += wage;
      addLog(state, "你参与《" + task.title + "》，拿到 " + wage + " 工钱。");
    }
    state.paintings.unshift({
      id: "art-" + state.artSerial++,
      title: task.title,
      style: task.style,
      quality: Math.round(task.quality)
    });
    state.paintings = state.paintings.slice(0, 6);
    addLog(state, "《" + task.title + "》交付到" + task.place + "，收入 " + reward + " 金币。");
    for (const painter of paintersAtStation(state, task.stationId)) syncPainterAction(state, painter);
  }

  function failTask(task) {
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    state.prestige = Math.max(0, state.prestige - (task.rush ? 4 : 2));
    addLog(state, "《" + task.title + "》错过期限，工会声望下降。");
    for (const painter of paintersAtStation(state, task.stationId)) syncPainterAction(state, painter);
  }

  function updateOrderDeadlines(dayDelta) {
    for (const order of state.orders) {
      order.deadline -= dayDelta;
    }
    for (const order of [...state.orders]) {
      if (order.deadline <= 0) {
        state.orders = state.orders.filter((item) => item.id !== order.id);
        state.prestige = Math.max(0, state.prestige - 1);
        addLog(state, "客户撤回了《" + order.title + "》。");
      }
    }
  }

  function updateNpcDirector(dt) {
    state.directorTimer += dt;
    if (state.directorTimer < 1.15) return;
    state.directorTimer = 0;

    restTiredNpcs();
    keepPaintStocked();
    autoAcceptGuildOrder();
    staffTasks();
    routineNpcWork();
  }

  function npcPainters() {
    return state.painters.filter((painter) => !painter.isPlayer);
  }

  function isBusyOnTask(painter) {
    return stationById(state, painter.stationId)?.type === "easel" && Boolean(taskAtStation(state, painter.stationId));
  }

  function restTiredNpcs() {
    for (const painter of npcPainters().sort((a, b) => b.fatigue - a.fatigue)) {
      if (painter.fatigue < 76 || (isBusyOnTask(painter) && painter.fatigue < 92)) continue;
      assignPainter(state, painter.id, "bed", "管事让" + painter.name + "去床边休息。");
    }
  }

  function keepPaintStocked() {
    if (state.paint > state.paintMax * 0.42 && !state.orders.some((order) => order.paintCost > state.paint)) return;
    const mixer = npcPainters().find((painter) => painter.role === "mixer" && !isBusyOnTask(painter) && painter.fatigue < 76) || bestAvailableNpc();
    if (mixer) assignPainter(state, mixer.id, "mixer", "管事安排" + mixer.name + "研磨颜料。");
  }

  function autoAcceptGuildOrder() {
    if (state.orders.length <= 1) return;
    const free = bestFreeEasel(state, false);
    if (!free || paintersAtStation(state, free.id).some((painter) => painter.id === "me")) return;
    const order = [...state.orders].sort((a, b) => {
      if (a.rush !== b.rush) return a.rush ? -1 : 1;
      return a.deadline - b.deadline;
    })[0];
    if (order && state.paint >= order.paintCost) {
      acceptOrder(state, order.id, free.id);
      addLog(state, "管事接下《" + order.title + "》，留一张订单给你挑。");
    }
  }

  function staffTasks() {
    const tasks = [...state.tasks].sort((a, b) => a.deadline - b.deadline || a.progress - b.progress);
    for (const task of tasks) {
      const station = stationById(state, task.stationId);
      if (!station) continue;
      const target = task.rush || station.slots > 1 ? station.slots : 1;
      while (paintersAtStation(state, station.id).length < target) {
        const helper = bestNpcForTask(task);
        if (!helper) break;
        if (!assignPainter(state, helper.id, station.id, "管事安排" + helper.name + "协助《" + task.title + "》。")) break;
      }
    }
  }

  function routineNpcWork() {
    for (const painter of npcPainters()) {
      if (isBusyOnTask(painter) || painter.fatigue >= 74) continue;
      let target = "";
      if (painter.role === "social") target = "gallery";
      else if (painter.role === "mixer" && state.paint < state.paintMax * 0.82) target = "mixer";
      else if (painter.role === "finisher") target = "apprentice-desk";
      else if (painter.skill < 32) target = "apprentice-desk";
      else target = "door";

      const station = stationById(state, target);
      if (station && freeSlot(state, station, painter.id) >= 0 && painter.stationId !== station.id) {
        assignPainter(state, painter.id, target, "管事安排" + painter.name + actionTextForStation(station) + "。");
      }
    }
  }

  function actionTextForStation(station) {
    return {
      desk: "学习",
      door: "接待客人",
      gallery: "布展",
      mixer: "研磨颜料",
      storage: "整理颜料",
      bed: "休息"
    }[station.type] || "待命";
  }

  function bestAvailableNpc() {
    return npcPainters()
      .filter((painter) => !isBusyOnTask(painter) && painter.fatigue < 76)
      .sort((a, b) => a.fatigue - b.fatigue || b.skill - a.skill)[0];
  }

  function bestNpcForTask(task) {
    const phase = PHASES[task.phaseIndex] || PHASES[0];
    return npcPainters()
      .filter((painter) => !isBusyOnTask(painter) && painter.fatigue < 88)
      .sort((a, b) => {
        const roleDelta = Number(ROLE_DATA[b.role]?.phase === phase) - Number(ROLE_DATA[a.role]?.phase === phase);
        if (roleDelta) return roleDelta;
        if (Math.abs(a.fatigue - b.fatigue) > 10) return a.fatigue - b.fatigue;
        return b.skill - a.skill;
      })[0];
  }

  function draw(time) {
    ctx.clearRect(0, 0, WORLD.width, WORLD.height);
    drawRoom();
    for (const station of state.stations) {
      drawStation(station, time);
    }
    const sortedPainters = [...state.painters].sort((a, b) => a.y - b.y);
    for (const painter of sortedPainters) {
      drawPainter(painter, time);
    }
    drawHover();
  }

  function drawRoom() {
    ctx.fillStyle = "#233146";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = "#40536b";
    ctx.fillRect(34, 42, 1032, 266);
    ctx.fillStyle = "#294057";
    ctx.fillRect(34, 308, 1032, 36);
    ctx.fillStyle = "#9b6845";
    ctx.fillRect(34, 344, 1032, 278);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    for (let x = 54; x < 1040; x += 42) {
      ctx.fillRect(x, 344, 2, 278);
    }
    for (let y = 365; y < 620; y += 36) {
      ctx.fillRect(34, y, 1032, 2);
    }
    ctx.fillStyle = "#1d2738";
    for (let x = 34; x <= 1066; x += 172) {
      ctx.fillRect(x, 42, 5, 580);
    }
    ctx.fillStyle = "#5b3929";
    ctx.fillRect(34, 616, 1032, 20);
    ctx.fillRect(34, 42, 1032, 10);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(52, 62, 996, 42);
    ctx.fillStyle = "rgba(218,174,105,0.13)";
    ctx.fillRect(52, 318, 996, 12);
  }

  function drawStation(station, time) {
    const task = station.type === "easel" ? taskAtStation(state, station.id) : null;
    drawStationLabel(station, task);
    if (station.type === "door") drawDoor(station);
    if (station.type === "easel") drawEasel(station, task, time);
    if (station.type === "desk") drawDesk(station);
    if (station.type === "mixer") drawMixer(station, time);
    if (station.type === "bed") drawBed(station);
    if (station.type === "gallery") drawGallery(station);
    if (station.type === "storage") drawStorage(station);
    drawStationShadow(station);
  }

  function drawStationLabel(station, task) {
    const title = task ? station.label + "  " + compactDeadline(task.deadline) : station.label;
    const sub = task ? "《" + task.title + "》" : stationIdleText(station);
    const x = station.x + 6;
    const y = station.y - 35;
    ctx.fillStyle = "rgba(29, 19, 13, 0.82)";
    roundRect(ctx, x, y, Math.min(station.w + 10, 164), 42, 6, true);
    ctx.fillStyle = "#f7efe1";
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.fillText(title, x + 10, y + 17);
    ctx.fillStyle = "#c7b9a3";
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.fillText(sub.slice(0, 12), x + 10, y + 34);
  }

  function stationIdleText(station) {
    return {
      door: "接待客户",
      easel: "等待订单",
      desk: station.id === "apprentice-desk" ? "提升技艺" : "整理账本",
      mixer: "研磨颜料",
      bed: "恢复疲劳",
      gallery: "展示作品",
      storage: "颜料库存"
    }[station.type] || "";
  }

  function drawStationShadow(station) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(station.x + station.w / 2, station.y + station.h - 6, station.w * 0.42, 15, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDoor(station) {
    ctx.fillStyle = "#2f2019";
    ctx.fillRect(station.x + 36, station.y + 9, 50, 92);
    ctx.fillStyle = "#8a5536";
    ctx.fillRect(station.x + 42, station.y + 16, 38, 82);
    ctx.fillStyle = "#d9aa4c";
    ctx.fillRect(station.x + 69, station.y + 57, 6, 6);
    ctx.fillStyle = "#d9aa4c";
    ctx.fillRect(station.x + 22, station.y + 96, 78, 12);
  }

  function drawEasel(station, task, time) {
    const cx = station.x + station.w / 2;
    const top = station.y + 16;
    const canvasW = station.size === "large" ? 142 : 98;
    const canvasH = station.size === "large" ? 108 : 82;
    ctx.strokeStyle = "#5b3929";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - canvasW / 2 + 10, top + canvasH + 8);
    ctx.lineTo(cx - canvasW / 2 - 18, station.y + station.h - 10);
    ctx.moveTo(cx + canvasW / 2 - 10, top + canvasH + 8);
    ctx.lineTo(cx + canvasW / 2 + 18, station.y + station.h - 10);
    ctx.moveTo(cx, top + canvasH);
    ctx.lineTo(cx, station.y + station.h - 6);
    ctx.stroke();
    ctx.lineWidth = 1;
    drawPaintingCanvas(cx - canvasW / 2, top, canvasW, canvasH, task, time);
  }

  function drawPaintingCanvas(x, y, w, h, task, time) {
    ctx.fillStyle = "#f4deb0";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#6c442c";
    ctx.lineWidth = 8;
    ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 1;
    if (!task) {
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      ctx.fillRect(x + 14, y + 14, w - 28, h - 28);
      return;
    }
    const p = task.progress / 100;
    const palette = STYLES[task.style].colors;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 8, y + 8, w - 16, h - 16);
    ctx.clip();
    ctx.globalAlpha = clamp((p - 0.04) / 0.18, 0, 1);
    ctx.strokeStyle = "#6b5745";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 24);
    ctx.lineTo(x + w - 24, y + h - 28);
    ctx.moveTo(x + 20, y + h - 22);
    ctx.lineTo(x + w - 18, y + 30);
    ctx.moveTo(x + 30, y + 16);
    ctx.lineTo(x + w - 34, y + 20 + Math.sin(time * 2) * 3);
    ctx.stroke();
    ctx.globalAlpha = clamp((p - 0.18) / 0.3, 0, 1);
    ctx.fillStyle = palette[0];
    ctx.fillRect(x + 10, y + 10, w * 0.42, h - 18);
    ctx.fillStyle = palette[1];
    ctx.fillRect(x + w * 0.42, y + 10, w * 0.34, h - 18);
    ctx.fillStyle = palette[2];
    ctx.fillRect(x + w * 0.68, y + 10, w * 0.28, h - 18);
    ctx.globalAlpha = clamp((p - 0.5) / 0.28, 0, 1);
    ctx.fillStyle = "rgba(255,255,255,0.44)";
    ctx.fillRect(x + 18, y + 18, w - 36, 5);
    ctx.fillStyle = "rgba(45,37,48,0.45)";
    ctx.fillRect(x + 22, y + h - 28, w - 48, 5);
    ctx.globalAlpha = clamp((p - 0.78) / 0.18, 0, 1);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 14);
    ctx.lineTo(x + 34, y + 30);
    ctx.moveTo(x + w - 26, y + h - 34);
    ctx.lineTo(x + w - 12, y + h - 20);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    if (paintersAtStation(state, task.stationId).some((painter) => painter.action === "painting")) {
      ctx.fillStyle = palette[1];
      const bx = x + 12 + ((time * 38) % Math.max(12, w - 30));
      ctx.fillRect(bx, y + h - 14, 18, 4);
    }
  }

  function drawDesk(station) {
    ctx.fillStyle = "#754529";
    ctx.fillRect(station.x + 25, station.y + 70, station.w - 50, 30);
    ctx.fillStyle = "#b8794b";
    ctx.fillRect(station.x + 18, station.y + 48, station.w - 36, 32);
    ctx.fillStyle = "#f2dbad";
    ctx.fillRect(station.x + 42, station.y + 37, 42, 28);
    ctx.fillStyle = "#5f92c8";
    ctx.fillRect(station.x + 92, station.y + 42, 18, 24);
  }

  function drawMixer(station, time) {
    ctx.fillStyle = "#6b432b";
    ctx.fillRect(station.x + 24, station.y + 65, station.w - 48, 34);
    ctx.fillStyle = "#d4c7ae";
    ctx.fillRect(station.x + 42, station.y + 40, 52, 34);
    ctx.fillStyle = "#2aa198";
    ctx.fillRect(station.x + 50, station.y + 52, 12, 12);
    ctx.fillStyle = "#c7644b";
    ctx.fillRect(station.x + 68, station.y + 49 + Math.sin(time * 6) * 2, 12, 14);
    ctx.fillStyle = "#d9aa4c";
    ctx.fillRect(station.x + 84, station.y + 54, 12, 10);
  }

  function drawBed(station) {
    ctx.fillStyle = "#5b3929";
    ctx.fillRect(station.x + 18, station.y + 52, station.w - 32, 48);
    ctx.fillStyle = "#c7644b";
    ctx.fillRect(station.x + 26, station.y + 58, station.w - 50, 34);
    ctx.fillStyle = "#f4deb0";
    ctx.fillRect(station.x + station.w - 58, station.y + 57, 34, 18);
  }

  function drawGallery(station) {
    const works = state.paintings.slice(0, 3);
    ctx.fillStyle = "#634029";
    ctx.fillRect(station.x + 20, station.y + 26, station.w - 40, 66);
    for (let i = 0; i < 3; i += 1) {
      const x = station.x + 32 + i * 38;
      const y = station.y + 38 + (i % 2) * 12;
      const style = works[i] ? STYLES[works[i].style] : STYLES.poster;
      ctx.fillStyle = "#f0d9aa";
      ctx.fillRect(x, y, 28, 24);
      ctx.fillStyle = style.colors[i % 3];
      ctx.fillRect(x + 4, y + 4, 20, 16);
    }
  }

  function drawStorage(station) {
    ctx.fillStyle = "#7a5435";
    ctx.fillRect(station.x + 38, station.y + 32, 68, 78);
    ctx.fillStyle = "#5b3929";
    ctx.fillRect(station.x + 42, station.y + 52, 60, 5);
    ctx.fillRect(station.x + 42, station.y + 78, 60, 5);
    ctx.fillStyle = "#2aa198";
    ctx.fillRect(station.x + 50, station.y + 60, 12, 16);
    ctx.fillStyle = "#c7644b";
    ctx.fillRect(station.x + 68, station.y + 60, 12, 16);
    ctx.fillStyle = "#d9aa4c";
    ctx.fillRect(station.x + 86, station.y + 60, 12, 16);
  }

  function drawPainter(painter, time) {
    const x = Math.round(painter.x);
    const y = Math.round(painter.y);
    const walkBob = painter.action === "walking" ? Math.sin(time * 14 + painter.x * 0.02) * 2 : 0;
    const paintSwing = painter.action === "painting" ? Math.sin(time * 12 + painter.slotIndex) : 0;
    ctx.fillStyle = "rgba(0,0,0,0.26)";
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    if (painter.id === "me") {
      ctx.strokeStyle = "rgba(217,170,76,0.92)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, y + 5, 27, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    const top = y - 48 + walkBob;
    ctx.fillStyle = "#2a1d19";
    ctx.fillRect(x - 12, top + 40, 8, 16);
    ctx.fillRect(x + 4, top + 40, 8, 16);
    ctx.fillStyle = painter.shirt;
    ctx.fillRect(x - 15, top + 24, 30, 24);
    ctx.fillStyle = "#efb97a";
    ctx.fillRect(x - 12, top + 12, 24, 20);
    ctx.fillStyle = painter.hair;
    ctx.fillRect(x - 15, top + 6, 30, 12);
    ctx.fillRect(x - 15, top + 14, 6, 12);
    ctx.fillRect(x + 9, top + 14, 6, 12);
    ctx.fillStyle = "#2a1d19";
    ctx.fillRect(x - 6, top + 21, 3, 3);
    ctx.fillRect(x + 4, top + 21, 3, 3);

    ctx.fillStyle = "#efb97a";
    if (painter.action === "painting") {
      ctx.fillRect(x - 23, top + 29, 12, 6);
      ctx.fillRect(x + 10, top + 28 + paintSwing * 3, 20, 6);
      ctx.fillStyle = "#5b3929";
      ctx.fillRect(x + 27, top + 28 + paintSwing * 3, 13, 4);
      ctx.fillStyle = "#d9aa4c";
      ctx.fillRect(x + 39, top + 27 + paintSwing * 3, 5, 6);
    } else if (painter.action === "mixing") {
      ctx.fillRect(x - 22, top + 28, 12, 6);
      ctx.fillRect(x + 10, top + 28, 12, 6);
      ctx.fillStyle = "#5b3929";
      ctx.fillRect(x + 20, top + 24 + Math.sin(time * 10) * 3, 4, 18);
    } else {
      ctx.fillRect(x - 22, top + 28, 12, 6);
      ctx.fillRect(x + 10, top + 28, 12, 6);
    }

    drawMiniBars(painter, x - 25, top + 4);
    drawNameTag(painter, x, top - 16);
  }

  function drawMiniBars(painter, x, y) {
    const values = [
      ["#2aa198", painter.skill],
      ["#c7644b", painter.fatigue],
      ["#74a35a", painter.mood]
    ];
    for (let i = 0; i < values.length; i += 1) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x, y + i * 12, 5, 28);
      ctx.fillStyle = values[i][0];
      const h = Math.round((values[i][1] / 100) * 26);
      ctx.fillRect(x + 1, y + i * 12 + 27 - h, 3, h);
    }
  }

  function drawNameTag(painter, x, y) {
    const text = painter.name + " · " + actionLabel(painter);
    ctx.font = "800 12px system-ui, sans-serif";
    const width = Math.min(96, ctx.measureText(text).width + 14);
    ctx.fillStyle = "rgba(28,18,12,0.86)";
    roundRect(ctx, x - width / 2, y, width, 24, 5, true);
    ctx.fillStyle = "#f7efe1";
    ctx.fillText(text.slice(0, 8), x - width / 2 + 7, y + 16);
  }

  function actionLabel(painter) {
    return {
      walking: "走动",
      painting: painter.id === "me" ? MODE_DATA[state.mode].label : MODE_DATA[painter.mode].label,
      waiting: "待画",
      mixing: "调色",
      resting: "休息",
      studying: "学习",
      receiving: "接待",
      curating: "布展",
      sorting: "整理",
      idle: "待命"
    }[painter.action] || "待命";
  }

  function drawHover() {
    const station = stationById(state, hoveredStationId) || nearestStationToPlayer(INTERACT_DISTANCE);
    if (!station) return;
    ctx.strokeStyle = "rgba(217,170,76,0.9)";
    ctx.lineWidth = 3;
    ctx.strokeRect(station.x - 6, station.y - 6, station.w + 12, station.h + 12);
    ctx.lineWidth = 1;
  }

  function roundRect(context, x, y, width, height, radius, fill) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    if (fill) context.fill();
    else context.stroke();
  }

  function renderUi() {
    els.day.textContent = "第 " + state.day + " 天";
    els.clock.textContent = formatClock(state.minute);
    els.coins.textContent = String(Math.round(state.coins));
    els.wage.textContent = String(Math.round(state.wage));
    els.paint.textContent = Math.round(state.paint) + "/" + state.paintMax;
    els.prestige.textContent = String(Math.round(state.prestige));
    const me = painterById(state, "me");
    els.selected.textContent = "我 · " + ROLE_DATA[me.role].label + " · " + actionLabel(me);

    renderOrders();
    renderPainters();
    renderArt();
    els.log.innerHTML = state.log.map((item) => `<div class="log-line">${escapeHtml(item)}</div>`).join("");
    els.modeButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.mode === state.mode);
    });
  }

  function renderOrders() {
    if (!state.orders.length) {
      els.orders.innerHTML = `<div class="order-card"><div class="order-title">暂无订单</div></div>`;
      return;
    }
    els.orders.innerHTML = state.orders
      .map((order) => {
        const rush = order.rush || order.deadline < 30;
        return `
          <article class="order-card ${rush ? "is-rush" : ""}">
            <div class="order-top">
              <div>
                <div class="order-title">${escapeHtml(order.title)}</div>
                <div class="order-meta">
                  <span>${escapeHtml(order.client)}</span>
                  <span>${compactDeadline(order.deadline)}</span>
                  <span>${order.pay} 金币</span>
                  <span>${order.paintCost} 颜料</span>
                </div>
              </div>
              <div class="order-style">${rush ? "加急 · " : ""}${STYLES[order.style].label}</div>
            </div>
            <div class="order-actions">
              <button type="button" data-accept-order="${order.id}">领活</button>
              <button type="button" data-reject-order="${order.id}">跳过</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function renderPainters() {
    els.painters.innerHTML = state.painters
      .map((painter) => {
        return `
          <article class="painter-card ${painter.isPlayer ? "is-player" : ""}">
            <span class="painter-avatar" style="--avatar-shirt:${painter.shirt};--avatar-hair:${painter.hair}" aria-hidden="true"></span>
            <div>
              <div class="painter-top">
                <div>
                  <div class="painter-name">${escapeHtml(painter.name)}</div>
                  <div class="painter-meta">${ROLE_DATA[painter.role].label} · ${actionLabel(painter)}</div>
                </div>
              </div>
              <div class="meter-stack">
                ${meterRow("技艺", painter.skill, "")}
                ${meterRow("疲劳", painter.fatigue, "is-fatigue")}
                ${meterRow("心情", painter.mood, "is-mood")}
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  function meterRow(label, value, className) {
    return `<div class="meter-row"><span>${label}</span><span class="meter ${className}"><span style="width:${clamp(value, 0, 100)}%"></span></span></div>`;
  }

  function renderArt() {
    els.artCount.textContent = String(state.paintings.length);
    if (!state.paintings.length) {
      els.art.innerHTML = `<div class="art-card"><small>等待第一幅作品</small></div>`;
      return;
    }
    els.art.innerHTML = state.paintings
      .map((art) => {
        const colors = STYLES[art.style].colors;
        return `
          <article class="art-card">
            <div class="mini-art" style="--art-a:${colors[0]};--art-b:${colors[1]};--art-c:${colors[2]}"></div>
            <small>${escapeHtml(art.title)} · ${art.quality}</small>
          </article>
        `;
      })
      .join("");
  }

  function formatClock(minute) {
    const safe = ((Math.floor(minute) % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function compactDeadline(days) {
    if (days >= 60) return (days / 30).toFixed(1) + "个月";
    return Math.max(1, Math.ceil(days)) + "天";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function stationFromPoint(x, y) {
    return [...state.stations]
      .reverse()
      .find((station) => x >= station.x - 12 && x <= station.x + station.w + 12 && y >= station.y - 48 && y <= station.y + station.h + 22);
  }

  function stationActionPoint(station) {
    if (station.type === "easel") {
      return { x: station.x + station.w / 2, y: station.y + station.h + 8 };
    }
    if (station.type === "door") return { x: station.x + station.w / 2 + 10, y: station.y + station.h - 18 };
    if (station.type === "gallery") return { x: station.x + station.w / 2 + 34, y: station.y + station.h - 18 };
    if (station.type === "storage") return { x: station.x + station.w / 2 - 28, y: station.y + station.h - 18 };
    return { x: station.x + station.w / 2, y: station.y + station.h - 18 };
  }

  function distanceToStation(station) {
    const me = painterById(state, "me");
    const point = stationActionPoint(station);
    return distance(me.x, me.y, point.x, point.y);
  }

  function nearestStationToPlayer(maxDistance = Infinity) {
    return [...state.stations]
      .map((station) => ({ station, distance: distanceToStation(station) }))
      .filter((item) => item.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)[0]?.station || null;
  }

  function bestPlayerOrder() {
    return [...state.orders].sort((a, b) => {
      if (a.rush !== b.rush) return a.rush ? -1 : 1;
      return a.deadline - b.deadline;
    })[0] || null;
  }

  function interactWithStation(station, options = {}) {
    if (!station) {
      addLog(state, "附近没有可操作的工位。");
      return false;
    }

    if (!options.allowDistant && distanceToStation(station) > INTERACT_DISTANCE) {
      addLog(state, "靠近" + station.label + "再操作。");
      return false;
    }

    if (freeSlot(state, station, "me") < 0) {
      addLog(state, station.label + "已经满了。");
      return false;
    }

    if (station.type === "easel" && !taskAtStation(state, station.id)) {
      const order = bestPlayerOrder();
      if (!order) {
        addLog(state, station.label + "还没有可挂的订单。");
        return assignPainter(state, "me", station.id, "你站到" + station.label + "前等待订单。");
      }
      const stationId = acceptOrder(state, order.id, station.id);
      if (!stationId) return false;
    }

    if (station.type === "door" && state.orders.length < 4) {
      const order = generateOrder(state);
      state.orders.push(order);
      addLog(state, "你接待了" + order.client + "，收到《" + order.title + "》。");
    }

    return assignPainter(state, "me", station.id, "你操作" + station.label + "。");
  }

  function canvasPoint(event) {
    const rect = els.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WORLD.width,
      y: ((event.clientY - rect.top) / rect.height) * WORLD.height
    };
  }

  els.canvas.addEventListener("mousemove", (event) => {
    const point = canvasPoint(event);
    hoveredStationId = stationFromPoint(point.x, point.y)?.id || "";
  });

  els.canvas.addEventListener("mouseleave", () => {
    hoveredStationId = "";
  });

  els.canvas.addEventListener("click", (event) => {
    els.canvas.focus();
    const point = canvasPoint(event);
    const station = stationFromPoint(point.x, point.y);
    if (!station) return;
    if (freeSlot(state, station, "me") < 0) {
      addLog(state, station.label + "已经满了。");
      return;
    }
    if (assignPainter(state, "me", station.id, "你前往" + station.label + "。")) {
      const task = station.type === "easel" ? taskAtStation(state, station.id) : null;
      if (station.type === "easel" && !task) addLog(state, station.label + "还没有挂订单。");
    }
  });

  els.canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    els.canvas.focus();
    const point = canvasPoint(event);
    const pointedStation = stationFromPoint(point.x, point.y);
    const station = pointedStation || nearestStationToPlayer(INTERACT_DISTANCE);
    interactWithStation(station, { allowDistant: Boolean(pointedStation) });
    renderUi();
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
      movementKeys.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === "KeyX" && !event.repeat) {
      const station = hoveredStationId ? stationById(state, hoveredStationId) : nearestStationToPlayer(INTERACT_DISTANCE);
      interactWithStation(station, { allowDistant: false });
      renderUi();
      event.preventDefault();
    }
  });

  window.addEventListener("keyup", (event) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
      movementKeys.delete(event.code);
      event.preventDefault();
    }
  });

  window.addEventListener("blur", () => {
    movementKeys.clear();
  });

  els.orders.addEventListener("click", (event) => {
    const accept = event.target.closest("[data-accept-order]");
    const reject = event.target.closest("[data-reject-order]");
    if (accept) {
      const stationId = acceptOrder(state, accept.dataset.acceptOrder, "", "me");
      if (stationId) {
        const station = stationById(state, stationId);
        assignPainter(state, "me", stationId, "你接下订单，站到" + station.label + "前作画。");
      }
    }
    if (reject) rejectOrder(state, reject.dataset.rejectOrder);
    renderUi();
  });

  els.modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      addLog(state, "你改用" + MODE_DATA[state.mode].label + "。");
      renderUi();
    });
  });

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => {
      const command = button.dataset.command;
      if (command === "rest") assignPainter(state, "me", "bed", "你去床边休息。");
      if (command === "study") assignPainter(state, "me", "apprentice-desk", "你回到学徒桌学习。");
      if (command === "mix") assignPainter(state, "me", "mixer", "你去调色台帮忙。");
      renderUi();
    });
  });

  els.newOrder.addEventListener("click", () => {
    const order = generateOrder(state, Math.random() < 0.34);
    state.orders.push(order);
    addLog(state, order.client + "送来《" + order.title + "》。");
    renderUi();
  });

  els.pause.addEventListener("click", () => {
    state.paused = !state.paused;
    els.pause.title = state.paused ? "继续" : "暂停";
  });

  els.speed.addEventListener("click", () => {
    state.speed = state.speed === 1 ? 1.8 : state.speed === 1.8 ? 3 : 1;
    addLog(state, "工会节奏 x" + state.speed + "。");
    renderUi();
  });

  els.reset.addEventListener("click", () => {
    movementKeys.clear();
    state = createState();
    renderUi();
  });

  function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;
    if (!state.paused) step(dt);
    draw(now / 1000);
    uiTimer += dt;
    if (uiTimer > 0.22) {
      uiTimer = 0;
      renderUi();
    }
    window.__paintersGuildState = state;
    requestAnimationFrame(loop);
  }

  renderUi();
  requestAnimationFrame(loop);
})();
