import { v } from 'convex/values';
import { Id } from '../_generated/dataModel';
import { ActionCtx, internalQuery } from '../_generated/server';
import { LLMMessage, chatCompletion } from '../util/llm';
import * as memory from './memory';
import { api, internal } from '../_generated/api';
import * as embeddingsCache from './embeddingsCache';
import { GameId, conversationId, playerId } from '../aiTown/ids';
import { NUM_MEMORIES_TO_SEARCH } from '../constants';

const selfInternal = internal.agent.conversation;
const RESPONSE_STYLE_PROMPT = [
  '请始终使用自然、简洁的简体中文回复，台词里不要夹英文。',
  '即使上下文里出现英文词，也要翻译成中文后再表达，例如 town 说成“镇上”，damage report 说成“损坏报告”。',
  '保持角色设定，不要跳出角色，不要解释你是 AI。',
  '回复 1 到 3 句话，不要使用 Markdown、舞台说明或姓名前缀。',
  '如果相关记忆适合当前语境，可以自然提及；不要生硬复述记忆列表。',
].join('\n');
const CHINESE_DIALOGUE_REWRITE_PROMPT = [
  '把下面这句角色台词改写成自然的简体中文。',
  '要求：保留原意和说话语气；所有英文词都翻译成中文；不要添加解释；不要使用 Markdown、引号、姓名前缀。',
  '只输出改写后的台词。',
].join('\n');
const LATIN_LETTER_REGEX = /[A-Za-z]/;

export async function startConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { player, otherPlayer, agent, otherAgent, lastConversation } = await ctx.runQuery(
    selfInternal.queryPromptData,
    {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    },
  );
  const embedding = await embeddingsCache.fetch(
    ctx,
    `${player.name} 正在和 ${otherPlayer.name} 说话`,
  );

  const memories = await memory.searchMemories(
    ctx,
    player.id as GameId<'players'>,
    embedding,
    Number(process.env.NUM_MEMORIES_TO_SEARCH) || NUM_MEMORIES_TO_SEARCH,
  );

  const memoryWithOtherPlayer = memories.find(
    (m) => m.data.type === 'conversation' && m.data.playerIds.includes(otherPlayerId),
  );
  const prompt = [
    RESPONSE_STYLE_PROMPT,
    `你是 ${player.name}，你刚刚和 ${otherPlayer.name} 开始了一段对话。`,
  ];
  prompt.push(...agentPrompts(otherPlayer, agent, otherAgent ?? null));
  prompt.push(...silentHumanListenerPrompt(otherPlayer, otherAgent ?? null));
  prompt.push(...previousConversationPrompt(otherPlayer, lastConversation));
  prompt.push(...relatedMemoriesPrompt(memories));
  if (memoryWithOtherPlayer) {
    prompt.push(`开场时请自然带到你们之前聊过的一处具体细节，或者问一个和旧对话有关的问题。`);
  }
  const lastPrompt = `请直接用 ${player.name} 的口吻回复 ${otherPlayer.name}：`;
  prompt.push(lastPrompt);

  const { content } = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: prompt.join('\n'),
      },
    ],
    max_tokens: 300,
    stop: stopWords(otherPlayer.name, player.name),
  });
  return await finalizeDialogueContent(content, lastPrompt, player.name, otherPlayer.name);
}

function trimContentPrefix(content: string, prompt: string) {
  if (content.startsWith(prompt)) {
    return content.slice(prompt.length).trim();
  }
  return content;
}

function stripSpeakerPrefix(content: string, playerName: string, otherPlayerName: string) {
  const speakerPrefixes = [
    `${playerName}：`,
    `${playerName}:`,
    `${playerName}说：`,
    `${playerName}说:`,
    `${playerName} 对 ${otherPlayerName} 说：`,
    `${playerName} 对 ${otherPlayerName} 说:`,
    `${playerName} to ${otherPlayerName}:`,
  ];
  let stripped = content.trim();
  for (const prefix of speakerPrefixes) {
    if (stripped.startsWith(prefix)) {
      stripped = stripped.slice(prefix.length).trim();
    }
  }
  return stripped;
}

function normalizeDialogueText(content: string) {
  return content
    .replace(/damage report/gi, '损坏报告')
    .replace(/research question/gi, '研究问题')
    .replace(/small town agent experiment/gi, '小镇智能体实验')
    .replace(/\bAI\b/g, '人工智能')
    .replace(/\bML\b/g, '机器学习')
    .replace(/\bagents?\b/gi, '智能体')
    .replace(/\btown\b/gi, '镇上')
    .replace(/\breport\b/gi, '报告')
    .replace(/\brepair\b/gi, '修理')
    .replace(/\bmodel\b/gi, '模型')
    .replace(/\bdata\b/gi, '数据')
    .replace(/\bmessage\b/gi, '消息')
    .replace(/\binformation\b/gi, '信息')
    .replace(/\bconversation\b/gi, '对话')
    .replace(/\brelationship\b/gi, '关系')
    .replace(/\bproject\b/gi, '项目')
    .replace(/([\u4e00-\u9fff])\s+([\u4e00-\u9fff])/g, '$1$2')
    .trim();
}

async function finalizeDialogueContent(
  content: string,
  prompt: string,
  playerName: string,
  otherPlayerName: string,
) {
  const normalized = normalizeDialogueText(
    stripSpeakerPrefix(trimContentPrefix(content, prompt), playerName, otherPlayerName),
  );
  if (!LATIN_LETTER_REGEX.test(normalized)) {
    return normalized;
  }
  const { content: rewritten } = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: CHINESE_DIALOGUE_REWRITE_PROMPT,
      },
      {
        role: 'user',
        content: normalized,
      },
    ],
    max_tokens: 300,
    temperature: 0.2,
  });
  return normalizeDialogueText(stripSpeakerPrefix(rewritten, playerName, otherPlayerName));
}

export async function continueConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { player, otherPlayer, conversation, agent, otherAgent } = await ctx.runQuery(
    selfInternal.queryPromptData,
    {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    },
  );
  const now = Date.now();
  const started = new Date(conversation.created);
  const embedding = await embeddingsCache.fetch(ctx, `你怎么看待 ${otherPlayer.name}？`);
  const memories = await memory.searchMemories(ctx, player.id as GameId<'players'>, embedding, 3);
  const prompt = [
    RESPONSE_STYLE_PROMPT,
    `你是 ${player.name}，你正在和 ${otherPlayer.name} 对话。`,
    `这段对话开始于 ${started.toLocaleString()}。现在是 ${now.toLocaleString()}。`,
  ];
  prompt.push(...agentPrompts(otherPlayer, agent, otherAgent ?? null));
  prompt.push(...silentHumanListenerPrompt(otherPlayer, otherAgent ?? null));
  prompt.push(...relatedMemoriesPrompt(memories));
  prompt.push(
    `下面是你和 ${otherPlayer.name} 当前的聊天记录。`,
    `不要重新打招呼。不要频繁使用“嘿”“嗨”。回复应简短，控制在 200 个中文字符以内。`,
  );

  const llmMessages: LLMMessage[] = [
    {
      role: 'system',
      content: prompt.join('\n'),
    },
    ...(await previousMessages(
      ctx,
      worldId,
      player,
      otherPlayer,
      conversation.id as GameId<'conversations'>,
    )),
  ];
  const lastPrompt = `请直接用 ${player.name} 的口吻回复 ${otherPlayer.name}：`;
  llmMessages.push({ role: 'user', content: lastPrompt });

  const { content } = await chatCompletion({
    messages: llmMessages,
    max_tokens: 300,
    stop: stopWords(otherPlayer.name, player.name),
  });
  return await finalizeDialogueContent(content, lastPrompt, player.name, otherPlayer.name);
}

export async function leaveConversationMessage(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  conversationId: GameId<'conversations'>,
  playerId: GameId<'players'>,
  otherPlayerId: GameId<'players'>,
): Promise<string> {
  const { player, otherPlayer, conversation, agent, otherAgent } = await ctx.runQuery(
    selfInternal.queryPromptData,
    {
      worldId,
      playerId,
      otherPlayerId,
      conversationId,
    },
  );
  const prompt = [
    RESPONSE_STYLE_PROMPT,
    `你是 ${player.name}，你正在和 ${otherPlayer.name} 对话。`,
    `你决定结束这段对话，并想礼貌地告诉对方你要离开。`,
  ];
  prompt.push(...agentPrompts(otherPlayer, agent, otherAgent ?? null));
  prompt.push(
    `下面是你和 ${otherPlayer.name} 当前的聊天记录。`,
    `你会怎么告诉对方你要离开？回复应简短，控制在 200 个中文字符以内。`,
  );
  const llmMessages: LLMMessage[] = [
    {
      role: 'system',
      content: prompt.join('\n'),
    },
    ...(await previousMessages(
      ctx,
      worldId,
      player,
      otherPlayer,
      conversation.id as GameId<'conversations'>,
    )),
  ];
  const lastPrompt = `请直接用 ${player.name} 的口吻回复 ${otherPlayer.name}：`;
  llmMessages.push({ role: 'user', content: lastPrompt });

  const { content } = await chatCompletion({
    messages: llmMessages,
    max_tokens: 300,
    stop: stopWords(otherPlayer.name, player.name),
  });
  return await finalizeDialogueContent(content, lastPrompt, player.name, otherPlayer.name);
}

function agentPrompts(
  otherPlayer: { name: string },
  agent: { identity: string; plan: string } | null,
  otherAgent: { identity: string; plan: string } | null,
): string[] {
  const prompt = [];
  if (agent) {
    prompt.push(`关于你：${agent.identity}`);
    prompt.push(`你的当前对话目标：${agent.plan}`);
  }
  if (otherAgent) {
    prompt.push(`关于 ${otherPlayer.name}：${otherAgent.identity}`);
  }
  return prompt;
}

function silentHumanListenerPrompt(
  otherPlayer: { name: string; human?: string },
  otherAgent: { identity: string; plan: string } | null,
): string[] {
  if (otherAgent || !otherPlayer.human) {
    return [];
  }
  return [
    `${otherPlayer.name} 正在安静听你说，不会主动发言。不要替 ${otherPlayer.name} 说话，也不要要求对方输入。`,
  ];
}

function previousConversationPrompt(
  otherPlayer: { name: string },
  conversation: { created: number } | null,
): string[] {
  const prompt = [];
  if (conversation) {
    const prev = new Date(conversation.created);
    const now = new Date();
    prompt.push(
      `你上次和 ${otherPlayer.name} 聊天是在 ${prev.toLocaleString()}。现在是 ${now.toLocaleString()}。`,
    );
  }
  return prompt;
}

function relatedMemoriesPrompt(memories: memory.Memory[]): string[] {
  const prompt = [];
  if (memories.length > 0) {
    prompt.push(`以下是按相关性排序的记忆：`);
    for (const memory of memories) {
      prompt.push(' - ' + normalizeDialogueText(memory.description));
    }
  }
  return prompt;
}

async function previousMessages(
  ctx: ActionCtx,
  worldId: Id<'worlds'>,
  player: { id: string; name: string },
  otherPlayer: { id: string; name: string },
  conversationId: GameId<'conversations'>,
) {
  const llmMessages: LLMMessage[] = [];
  const prevMessages = await ctx.runQuery(api.messages.listMessages, { worldId, conversationId });
  for (const message of prevMessages) {
    const author = message.author === player.id ? player : otherPlayer;
    const recipient = message.author === player.id ? otherPlayer : player;
    llmMessages.push({
      role: 'user',
      content: `${author.name} 对 ${recipient.name} 说：${normalizeDialogueText(message.text)}`,
    });
  }
  return llmMessages;
}

export const queryPromptData = internalQuery({
  args: {
    worldId: v.id('worlds'),
    playerId,
    otherPlayerId: playerId,
    conversationId,
  },
  handler: async (ctx, args) => {
    const world = await ctx.db.get(args.worldId);
    if (!world) {
      throw new Error(`World ${args.worldId} not found`);
    }
    const player = world.players.find((p) => p.id === args.playerId);
    if (!player) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const playerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.playerId))
      .first();
    if (!playerDescription) {
      throw new Error(`Player description for ${args.playerId} not found`);
    }
    const otherPlayer = world.players.find((p) => p.id === args.otherPlayerId);
    if (!otherPlayer) {
      throw new Error(`Player ${args.otherPlayerId} not found`);
    }
    const otherPlayerDescription = await ctx.db
      .query('playerDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('playerId', args.otherPlayerId))
      .first();
    if (!otherPlayerDescription) {
      throw new Error(`Player description for ${args.otherPlayerId} not found`);
    }
    const conversation = world.conversations.find((c) => c.id === args.conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${args.conversationId} not found`);
    }
    const agent = world.agents.find((a) => a.playerId === args.playerId);
    if (!agent) {
      throw new Error(`Player ${args.playerId} not found`);
    }
    const agentDescription = await ctx.db
      .query('agentDescriptions')
      .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', agent.id))
      .first();
    if (!agentDescription) {
      throw new Error(`Agent description for ${agent.id} not found`);
    }
    const otherAgent = world.agents.find((a) => a.playerId === args.otherPlayerId);
    let otherAgentWithDescription:
      | ({ identity: string; plan: string } & NonNullable<typeof otherAgent>)
      | undefined;
    if (otherAgent) {
      const otherAgentDescription = await ctx.db
        .query('agentDescriptions')
        .withIndex('worldId', (q) => q.eq('worldId', args.worldId).eq('agentId', otherAgent.id))
        .first();
      if (!otherAgentDescription) {
        throw new Error(`Agent description for ${otherAgent.id} not found`);
      }
      otherAgentWithDescription = {
        identity: otherAgentDescription.identity,
        plan: otherAgentDescription.plan,
        ...otherAgent,
      };
    }
    const lastTogether = await ctx.db
      .query('participatedTogether')
      .withIndex('edge', (q) =>
        q
          .eq('worldId', args.worldId)
          .eq('player1', args.playerId)
          .eq('player2', args.otherPlayerId),
      )
      // Order by conversation end time descending.
      .order('desc')
      .first();

    let lastConversation = null;
    if (lastTogether) {
      lastConversation = await ctx.db
        .query('archivedConversations')
        .withIndex('worldId', (q) =>
          q.eq('worldId', args.worldId).eq('id', lastTogether.conversationId),
        )
        .first();
      if (!lastConversation) {
        throw new Error(`Conversation ${lastTogether.conversationId} not found`);
      }
    }
    return {
      player: { name: playerDescription.name, ...player },
      otherPlayer: { name: otherPlayerDescription.name, ...otherPlayer },
      conversation,
      agent: { identity: agentDescription.identity, plan: agentDescription.plan, ...agent },
      otherAgent: otherAgentWithDescription,
      lastConversation,
    };
  },
});

function stopWords(otherPlayer: string, player: string) {
  // These are the words we ask the LLM to stop on. OpenAI only supports 4.
  const variants = [`${otherPlayer} to ${player}`];
  return variants.flatMap((stop) => [stop + ':', stop.toLowerCase() + ':']);
}
