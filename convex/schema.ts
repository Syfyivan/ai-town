import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { agentTables } from './agent/schema';
import { aiTownTables } from './aiTown/schema';
import { conversationId, playerId } from './aiTown/ids';
import { engineTables } from './engine/schema';
import { point, vector } from './util/types';

export default defineSchema({
  music: defineTable({
    storageId: v.string(),
    type: v.union(v.literal('background'), v.literal('player')),
  }),

  messages: defineTable({
    conversationId,
    messageUuid: v.string(),
    author: playerId,
    text: v.string(),
    worldId: v.optional(v.id('worlds')),
  })
    .index('conversationId', ['worldId', 'conversationId'])
    .index('messageUuid', ['conversationId', 'messageUuid']),

  visualNodes: defineTable({
    sessionId: v.string(),
    nodeId: v.string(),
    parentNodeId: v.optional(v.string()),
    title: v.string(),
    prompt: v.string(),
    depth: v.number(),
    styleAnchor: v.string(),
    imageStorageId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
    hotspots: v.array(
      v.object({
        id: v.string(),
        label: v.string(),
        kind: v.string(),
        rect: v.object({
          x: v.number(),
          y: v.number(),
          w: v.number(),
          h: v.number(),
        }),
        nextPrompt: v.string(),
      }),
    ),
  })
    .index('sessionId', ['sessionId', 'createdAt'])
    .index('nodeId', ['sessionId', 'nodeId']),

  artStudioWorkers: defineTable({
    worldId: v.id('worlds'),
    playerId,
    painterName: v.string(),
    florins: v.number(),
    paintingSkill: v.number(),
    creativity: v.number(),
    reputation: v.number(),
    shiftsCompleted: v.number(),
    lastWorkedAt: v.optional(v.number()),
    activeShift: v.optional(
      v.object({
        focus: v.union(v.literal('sketch'), v.literal('color'), v.literal('detail')),
        title: v.string(),
        description: v.string(),
        startedAt: v.number(),
        endsAt: v.number(),
        basePay: v.number(),
        skillGain: v.number(),
        creativityGain: v.number(),
        reputationGain: v.number(),
      }),
    ),
  })
    .index('worldId', ['worldId'])
    .index('worldPlayer', ['worldId', 'playerId']),

  gardeners: defineTable({
    worldId: v.id('worlds'),
    playerId,
    gardenerName: v.string(),
    coins: v.number(),
    vegetables: v.number(),
    gardeningSkill: v.number(),
    harvestsCompleted: v.number(),
    energy: v.optional(v.number()),
    food: v.optional(v.number()),
    seedReplicator: v.optional(v.boolean()),
    seeds: v.optional(
      v.object({
        radish: v.number(),
        greens: v.number(),
        carrot: v.number(),
      }),
    ),
    lastTendedAt: v.optional(v.number()),
    plots: v.array(
      v.object({
        slot: v.number(),
        crop: v.optional(v.union(v.literal('radish'), v.literal('greens'), v.literal('carrot'))),
        plantedAt: v.optional(v.number()),
        wateredAt: v.optional(v.number()),
        readyAt: v.optional(v.number()),
      }),
    ),
  })
    .index('worldId', ['worldId'])
    .index('worldPlayer', ['worldId', 'playerId']),

  residentProfiles: defineTable({
    worldId: v.id('worlds'),
    tokenIdentifier: v.string(),
    sessionId: v.string(),
    name: v.string(),
    character: v.string(),
    savedPosition: v.optional(point),
    savedFacing: v.optional(vector),
    lastSavedAt: v.optional(v.number()),
    daysSlept: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('worldId', ['worldId'])
    .index('worldToken', ['worldId', 'tokenIdentifier']),

  ...agentTables,
  ...aiTownTables,
  ...engineTables,
});
