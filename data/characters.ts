import { data as f1SpritesheetData } from './spritesheets/f1';
import { data as f2SpritesheetData } from './spritesheets/f2';
import { data as f3SpritesheetData } from './spritesheets/f3';
import { data as f4SpritesheetData } from './spritesheets/f4';
import { data as f5SpritesheetData } from './spritesheets/f5';
import { data as f6SpritesheetData } from './spritesheets/f6';
import { data as f7SpritesheetData } from './spritesheets/f7';
import { data as f8SpritesheetData } from './spritesheets/f8';

export const Descriptions = [
  {
    name: '林岚',
    character: 'f1',
    identity: `林岚是溪山镇的档案员，温和、耐心、记性很好。她负责记录镇民每天发生的小事，也会把传闻、误会和人情往来整理成镇志。她喜欢从细节里发现人与人之间真正的关心，但不喜欢夸张和空话。`,
    plan: '你想了解今天镇上发生了什么，并判断哪些传闻值得记录进镇志。',
  },
  {
    name: '周砚',
    character: 'f4',
    identity: `周砚是溪山镇的木匠，外表沉默寡言，说话短促，但手艺极好。他总在修桥、修门、修旧家具。其实他很在意别人是否认可他的手艺，只是不善于表达。`,
    plan: '你想找出镇上最需要修理的东西，同时尽量不要被拖进太长的闲聊。',
  },
  {
    name: '沈梨',
    character: 'f6',
    identity: `沈梨经营一家小茶铺，擅长聊天、察言观色，也很会把普通消息包装得引人入胜。她不是坏人，但有一点点爱看热闹，常常知道谁和谁最近关系变好了。`,
    plan: '你想收集能让茶铺客人感兴趣的新鲜话题，但不要故意伤害任何人。',
  },
  {
    name: '许行舟',
    character: 'f3',
    identity: `许行舟是刚搬来的机器学习研究员，喜欢用实验和模型解释镇上的行为模式。他有时会说出很技术化的比喻，但会努力把复杂概念讲得接地气。`,
    plan: '你想观察镇民如何传播信息，并寻找一个适合做“小镇智能体实验”的研究问题。',
  },
  {
    name: '阿竹',
    character: 'f7',
    identity: `阿竹是溪山镇的快递员，脚步快、消息灵、朋友多。他每天穿过整张地图，知道谁今天出门、谁在等东西、谁看起来心情不好。`,
    plan: '你想把可靠的消息带给需要的人，也想弄清楚今天有没有人需要帮忙。',
  },
  {
    name: '顾南星',
    character: 'f8',
    identity: `顾南星是镇上的自由插画师，敏感、浪漫、想象力强。她喜欢把别人的故事画成小海报，也常常从一句话里听出没有说出口的情绪。`,
    plan: '你想寻找一个能画进新作品里的故事，并鼓励别人说出真实想法。',
  },
];

export const characters = [
  {
    name: 'f1',
    label: '蓝帽旅人',
    hair: '浅灰发',
    outfit: '蓝色外套',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f1SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f2',
    label: '墨绿学徒',
    hair: '黑短发',
    outfit: '墨绿外套',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f2SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f3',
    label: '灰袍画师',
    hair: '黑长发',
    outfit: '灰色长袍',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f3SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f4',
    label: '白发匠人',
    hair: '白发',
    outfit: '深色工装',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f4SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f5',
    label: '金发农手',
    hair: '金发',
    outfit: '蓝色衣装',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f5SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f6',
    label: '粉发织梦者',
    hair: '粉发',
    outfit: '紫色衣装',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f6SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f7',
    label: '茶发店员',
    hair: '茶棕发',
    outfit: '米色衣装',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f7SpritesheetData,
    speed: 0.1,
  },
  {
    name: 'f8',
    label: '浅金策展人',
    hair: '浅金长发',
    outfit: '灰绿衣装',
    textureUrl: '/ai-town/assets/32x32folk.png',
    spritesheetData: f8SpritesheetData,
    speed: 0.1,
  },
];

export const characterAppearanceOptions = characters.map(({ name, label, hair, outfit }) => ({
  name,
  label,
  hair,
  outfit,
}));

export function getCharacterAppearance(characterName: string) {
  return characters.find((character) => character.name === characterName);
}

export function selectCharacterNameFromSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return characters[hash % characters.length].name;
}

export function randomCharacterName() {
  return characters[Math.floor(Math.random() * characters.length)].name;
}

// Characters move quickly enough for the default "run" mode to feel responsive.
export const movementSpeed = 1.6;
