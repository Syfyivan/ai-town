import {
  ART_STUDIO_SHIFT_DURATION_MS,
  GARDEN_MAX_ENERGY,
  GARDEN_PLOT_COUNT,
  GARDEN_STARTER_FOOD,
  NPC_IDENTITY_MAX_LENGTH,
  NPC_NAME_MAX_LENGTH,
  NPC_PLAN_MAX_LENGTH,
  PLAYER_NAME_MAX_LENGTH,
  SEED_REPLICATOR_SUCCESS_RATE,
  SEED_SAVE_SUCCESS_RATE,
  buildSessionToken,
  createArtStudioShift,
  createGardenPlots,
  getGardenPlotPhase,
  getStudioShiftProgress,
  getTownCalendar,
  harvestGardenPlot,
  plantGardenPlot,
  previewArtStudioJobs,
  resolveSeedSaving,
  sanitizeNpcProfile,
  sanitizePlayerCharacter,
  sanitizePlayerName,
  selectSessionCharacter,
  settleArtStudioShift,
  summarizeResidentAssets,
  waterGardenPlot,
} from './world';

describe('sanitizeNpcProfile', () => {
  test('trims a valid NPC profile', () => {
    expect(
      sanitizeNpcProfile({
        name: '  陆青  ',
        character: ' f2 ',
        identity: '  陆青是溪山镇新来的种子商人。  ',
        plan: '  想认识镇上的居民。  ',
      }),
    ).toEqual({
      name: '陆青',
      character: 'f2',
      identity: '陆青是溪山镇新来的种子商人。',
      plan: '想认识镇上的居民。',
    });
  });

  test('rejects empty required fields', () => {
    expect(() =>
      sanitizeNpcProfile({
        name: '',
        character: 'f1',
        identity: '有人设',
        plan: '有目标',
      }),
    ).toThrow('NPC name is required');
  });

  test('rejects unknown character sprites', () => {
    expect(() =>
      sanitizeNpcProfile({
        name: '陆青',
        character: 'f99',
        identity: '有人设',
        plan: '有目标',
      }),
    ).toThrow('Unknown NPC character sprite: f99');
  });

  test('rejects overlong fields', () => {
    expect(() =>
      sanitizeNpcProfile({
        name: 'x'.repeat(NPC_NAME_MAX_LENGTH + 1),
        character: 'f1',
        identity: '有人设',
        plan: '有目标',
      }),
    ).toThrow(`NPC name cannot exceed ${NPC_NAME_MAX_LENGTH} characters`);
    expect(() =>
      sanitizeNpcProfile({
        name: '陆青',
        character: 'f1',
        identity: 'x'.repeat(NPC_IDENTITY_MAX_LENGTH + 1),
        plan: '有目标',
      }),
    ).toThrow(`NPC identity cannot exceed ${NPC_IDENTITY_MAX_LENGTH} characters`);
    expect(() =>
      sanitizeNpcProfile({
        name: '陆青',
        character: 'f1',
        identity: '有人设',
        plan: 'x'.repeat(NPC_PLAN_MAX_LENGTH + 1),
      }),
    ).toThrow(`NPC goal cannot exceed ${NPC_PLAN_MAX_LENGTH} characters`);
  });
});

describe('session player identity helpers', () => {
  test('builds a stable token from a browser session id', () => {
    expect(buildSessionToken(' abc-123_你好 ')).toBe('local:abc-123_');
  });

  test('rejects an unusable session id', () => {
    expect(() => buildSessionToken('  !!!  ')).toThrow('Invalid player session.');
  });

  test('sanitizes player display names', () => {
    expect(sanitizePlayerName('  阿澈  ')).toBe('阿澈');
    expect(sanitizePlayerName('')).toBe('访客');
    expect(sanitizePlayerName('x'.repeat(PLAYER_NAME_MAX_LENGTH + 4))).toHaveLength(
      PLAYER_NAME_MAX_LENGTH,
    );
  });

  test('selects a deterministic character per session', () => {
    expect(selectSessionCharacter('friend-a')).toBe(selectSessionCharacter('friend-a'));
  });

  test('sanitizes player character choices with a deterministic fallback', () => {
    expect(sanitizePlayerCharacter(' f6 ', 'friend-a')).toBe('f6');
    expect(sanitizePlayerCharacter('f99', 'friend-a')).toBe(selectSessionCharacter('friend-a'));
    expect(sanitizePlayerCharacter(undefined, 'friend-a')).toBe(selectSessionCharacter('friend-a'));
  });
});

describe('art studio shift helpers', () => {
  const worker = {
    florins: 12,
    paintingSkill: 3,
    creativity: 2,
    reputation: 1,
    shiftsCompleted: 2,
  };

  test('clamps shift progress to the active window', () => {
    const shift = createArtStudioShift('sketch', worker, 1_000);
    expect(getStudioShiftProgress(500, shift)).toBe(0);
    expect(getStudioShiftProgress(1_000 + ART_STUDIO_SHIFT_DURATION_MS / 2, shift)).toBe(0.5);
    expect(getStudioShiftProgress(1_000 + ART_STUDIO_SHIFT_DURATION_MS + 1, shift)).toBe(1);
  });

  test('creates deterministic shift rewards from worker stats', () => {
    const shift = createArtStudioShift('detail', worker, 2_000);
    expect(shift).toMatchObject({
      focus: 'detail',
      title: '精修装裱',
      startedAt: 2_000,
      endsAt: 2_000 + ART_STUDIO_SHIFT_DURATION_MS,
      basePay: 26,
      skillGain: 0.9,
      creativityGain: 0.5,
    });
  });

  test('settles pay and growth exactly once per finished shift', () => {
    const shift = createArtStudioShift('color', worker, 3_000);
    expect(settleArtStudioShift(worker, shift)).toEqual({
      florins: 34,
      paintingSkill: 3.5,
      creativity: 2.8,
      reputation: 2,
      shiftsCompleted: 3,
    });
  });

  test('previews the three MVP studio jobs', () => {
    expect(previewArtStudioJobs(worker).map((job) => job.focus)).toEqual([
      'sketch',
      'color',
      'detail',
    ]);
  });
});

describe('garden plot helpers', () => {
  const gardener = {
    coins: 5,
    vegetables: 1,
    gardeningSkill: 1,
    harvestsCompleted: 0,
  };

  test('creates a fixed MVP plot grid', () => {
    expect(createGardenPlots()).toEqual([{ slot: 0 }, { slot: 1 }, { slot: 2 }, { slot: 3 }]);
    expect(createGardenPlots()).toHaveLength(GARDEN_PLOT_COUNT);
  });

  test('plants and waters one crop', () => {
    const planted = plantGardenPlot(createGardenPlots(), 0, 'radish', 1_000);
    expect(planted[0]).toEqual({ slot: 0, crop: 'radish', plantedAt: 1_000 });
    expect(getGardenPlotPhase(1_000, planted[0])).toBe('planted');

    const watered = waterGardenPlot(planted, 0, 2_000);
    expect(watered[0].wateredAt).toBe(2_000);
    expect(watered[0].readyAt).toBe(47_000);
    expect(getGardenPlotPhase(2_001, watered[0])).toBe('watered');
  });

  test('rejects invalid garden actions', () => {
    const planted = plantGardenPlot(createGardenPlots(), 1, 'greens', 1_000);
    expect(() => plantGardenPlot(planted, 1, 'carrot', 2_000)).toThrow('这块地已经种了作物。');
    expect(() => waterGardenPlot(createGardenPlots(), 2, 2_000)).toThrow('这块地还没有播种。');
    expect(() => harvestGardenPlot(gardener, planted, 1, 2_000)).toThrow('这块地还没成熟。');
  });

  test('harvests a ready crop and clears the plot', () => {
    const planted = plantGardenPlot(createGardenPlots(), 2, 'carrot', 1_000);
    const watered = waterGardenPlot(planted, 2, 2_000);
    const outcome = harvestGardenPlot(gardener, watered, 2, 77_000);
    expect(outcome.harvest).toEqual({
      crop: 'carrot',
      cropName: '胡萝卜',
      coinReward: 14,
      vegetables: 2,
      skillGain: 0.7,
    });
    expect(outcome.stats).toEqual({
      coins: 19,
      vegetables: 3,
      gardeningSkill: 1.7,
      harvestsCompleted: 1,
    });
    expect(outcome.plots[2]).toEqual({ slot: 2 });
  });
});

describe('town calendar and seed saving helpers', () => {
  test('marks the monthly market day from sleep progress', () => {
    const calendar = getTownCalendar(new Date('2026-06-06T09:30:00+08:00').getTime(), 14);
    expect(calendar).toMatchObject({
      dayNumber: 15,
      month: 1,
      dayOfMonth: 15,
      isMarketDay: true,
      daysUntilMarket: 0,
    });

    const nextDay = getTownCalendar(new Date('2026-06-06T09:30:00+08:00').getTime(), 15);
    expect(nextDay).toMatchObject({
      dayNumber: 16,
      isMarketDay: false,
      daysUntilMarket: 29,
    });
  });

  test('uses the configured seed saving rates', () => {
    const ordinary = resolveSeedSaving('seed-save-check', false);
    const replicated = resolveSeedSaving('seed-save-check', true);

    expect(ordinary.successRate).toBe(SEED_SAVE_SUCCESS_RATE);
    expect(replicated.successRate).toBe(SEED_REPLICATOR_SUCCESS_RATE);
    expect(ordinary.seedCount).toBeGreaterThanOrEqual(0);
    expect(ordinary.seedCount).toBeLessThanOrEqual(5);
    expect(replicated.seedCount).toBeGreaterThanOrEqual(0);
    expect(replicated.seedCount).toBeLessThanOrEqual(5);
    if (ordinary.success) {
      expect(ordinary.seedCount).toBeGreaterThanOrEqual(1);
    }
    if (replicated.success) {
      expect(replicated.seedCount).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('resident asset summary', () => {
  test('uses MVP defaults before a resident has worked', () => {
    expect(summarizeResidentAssets()).toEqual({
      florins: 0,
      coins: 0,
      vegetables: 0,
      energy: GARDEN_MAX_ENERGY,
      maxEnergy: GARDEN_MAX_ENERGY,
      food: GARDEN_STARTER_FOOD,
      seeds: {
        radish: 4,
        greens: 3,
        carrot: 2,
      },
      totalSeeds: 9,
      seedReplicator: false,
      paintingSkill: 1,
      creativity: 1,
      reputation: 0,
      gardeningSkill: 1,
      shiftsCompleted: 0,
      harvestsCompleted: 0,
    });
  });

  test('combines studio and garden progress', () => {
    expect(
      summarizeResidentAssets(
        {
          florins: 22,
          paintingSkill: 2.5,
          creativity: 3,
          reputation: 1,
          shiftsCompleted: 1,
        },
        {
          coins: 14,
          vegetables: 2,
          energy: 72,
          food: 3,
          seeds: {
            radish: 1,
            greens: 0,
            carrot: 4,
          },
          seedReplicator: true,
          gardeningSkill: 1.7,
          harvestsCompleted: 1,
        },
      ),
    ).toMatchObject({
      florins: 22,
      coins: 14,
      vegetables: 2,
      energy: 72,
      food: 3,
      totalSeeds: 5,
      seedReplicator: true,
      paintingSkill: 2.5,
      gardeningSkill: 1.7,
      shiftsCompleted: 1,
      harvestsCompleted: 1,
    });
  });
});
