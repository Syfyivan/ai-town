export type ProfessionId =
  | 'blacksmith'
  | 'carpenter'
  | 'farmer'
  | 'fisher'
  | 'artist'
  | 'mage'
  | 'rancher'
  | 'tavernKeeper'
  | 'seedSeller'
  | 'mayor'
  | 'scientist'
  | 'doctor';

export type ProfessionBuilding = {
  profession: ProfessionId;
  label: string;
  skillName: string;
  buildingName: string;
  ownerName: string;
  interiorNotice: string;
  deskTitle: string;
  paperTitle: string;
  jobTitle: string;
  jobDescription: string;
  payCoins: number;
  xpGain: number;
  currentUnlock: string;
  nextUnlock: string;
  nextLevelXp: number;
  accent: number;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  portalRegion: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export const PROFESSION_BUILDINGS: ProfessionBuilding[] = [
  {
    profession: 'carpenter',
    label: '木匠学徒',
    skillName: '木工等级',
    buildingName: '木作坊',
    ownerName: '木匠闻桐',
    interiorNotice: '桌上的白纸写着今日木工学徒报名表。',
    deskTitle: '接待木桌',
    paperTitle: '木工报名纸',
    jobTitle: '裁木板和修门窗',
    jobDescription: '跟木匠做基础木工，之后可以做家具和扩建。',
    payCoins: 15,
    xpGain: 14,
    currentUnlock: '木板和简易修补',
    nextUnlock: '木箱和储物柜',
    nextLevelXp: 50,
    accent: 0x8f563b,
    region: { x: 7, y: 14, width: 9, height: 8 },
    portalRegion: { x: 10, y: 21, width: 2, height: 1 },
  },
  {
    profession: 'blacksmith',
    label: '铁匠学徒',
    skillName: '锻打等级',
    buildingName: '溪山铁铺',
    ownerName: '铁匠宋砧',
    interiorNotice: '报名纸旁压着一枚铜钉，今天招临时锻打学徒。',
    deskTitle: '铁铺柜台',
    paperTitle: '锻打报名纸',
    jobTitle: '整理矿石和打磨工具',
    jobDescription: '帮铁匠分拣矿石、磨刀和修农具。',
    payCoins: 16,
    xpGain: 14,
    currentUnlock: '铜钉和基础修理',
    nextUnlock: '简易矿镐',
    nextLevelXp: 50,
    accent: 0x5a6988,
    region: { x: 47, y: 13, width: 9, height: 8 },
    portalRegion: { x: 50, y: 20, width: 2, height: 1 },
  },
  {
    profession: 'mage',
    label: '魔法学徒',
    skillName: '魔法等级',
    buildingName: '星井小塔',
    ownerName: '法师岚珀',
    interiorNotice: '白纸泛着微光，写着今日符文学徒名单。',
    deskTitle: '星尘书桌',
    paperTitle: '魔法报名纸',
    jobTitle: '抄写符文和照看星尘',
    jobDescription: '学习基础符文、药粉和小镇异常事件处理。',
    payCoins: 17,
    xpGain: 15,
    currentUnlock: '符文抄写',
    nextUnlock: '星尘瓶',
    nextLevelXp: 50,
    accent: 0x6e2146,
    region: { x: 6, y: 35, width: 9, height: 8 },
    portalRegion: { x: 9, y: 42, width: 2, height: 1 },
  },
  {
    profession: 'tavernKeeper',
    label: '酒馆学徒',
    skillName: '烹饪等级',
    buildingName: '溪山酒馆',
    ownerName: '酒馆老板罗麦',
    interiorNotice: '柜台白纸写着跑堂、备菜和学徒餐安排。',
    deskTitle: '酒馆柜台',
    paperTitle: '酒馆报名纸',
    jobTitle: '备菜和招待客人',
    jobDescription: '在酒馆跑堂、备菜和听镇上消息。',
    payCoins: 18,
    xpGain: 14,
    currentUnlock: '洗菜和摆盘',
    nextUnlock: '热汤',
    nextLevelXp: 50,
    accent: 0xb86f50,
    region: { x: 45, y: 4, width: 11, height: 8 },
    portalRegion: { x: 49, y: 11, width: 2, height: 1 },
  },
];

export function getProfessionBuilding(profession: ProfessionId) {
  return (
    PROFESSION_BUILDINGS.find((building) => building.profession === profession) ??
    PROFESSION_BUILDINGS[0]
  );
}
