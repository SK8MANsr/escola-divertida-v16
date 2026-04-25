import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ElementType, ReactNode } from 'react';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Lock,
  Menu,
  PauseCircle,
  Play,
  PlusCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Volume2,
  WandSparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from './utils/cn';
import { cloudSyncEnabled, fetchCloudSave, pushCloudSave } from './lib/cloudSync';
import { dynamicContentEnabled, fetchAdminDynamicCatalog, fetchDynamicCatalog, publishDynamicCatalog } from './lib/dynamicContent';
import { fetchInfrastructureHealth } from './lib/infraHealth';
import { getOrCreateDeviceId, safeReadStorage, writeStorage } from './lib/storage';
import { playSound } from './lib/sound';
import {
  ageTracks,
  alphabetPools,
  colorBuckets,
  colorItems,
  methodologyCards,
  phaseMap,
  profileAccentPalette,
  rewardMilestones,
  safetyItems,
  shapeLibrary,
  testimonials,
  worldPhaseOrder,
  worlds,
  faqData,
  memoryThemePools,
  contentPacks as fallbackContentPacks,
  avatarOptions,
  buddyOptions,
  mascotThemeOptions,
  seasonalEvents as fallbackSeasonalEvents,
  parentWeeklyTracks as fallbackParentWeeklyTracks,
  dynamicContentBlueprint,
} from './data/gameContent';
import type {
  AlphabetPhase,
  ChildProfile,
  CloudSavePayload,
  ColorBucketId,
  ColorsPhase,
  DailyUsage,
  DailyMissionKind,
  DailyMissionState,
  GameKey,
  GamePhase,
  MazePhase,
  MemoryPhase,
  ParentSettings,
  PhaseProgress,
  ProfileProgress,
  PuzzlePhase,
  ShapeId,
  ShapePhase,
  SingleGameProgress,
  MathPhase,
  SessionHistory,
  SeasonalEvent,
  ContentPack,
  ParentWeeklyTrack,
} from './data/gameContent';
import type { InfrastructureHealthPayload } from './lib/infraHealth';

type FeatureCardProps = {
  icon: ElementType;
  title: string;
  desc: string;
  color: string;
};

type FAQItemProps = { q: string; a: string };

type TestimonialProps = { name: string; role: string; text: string };

type GameRuntimeProps = {
  disabledReason: string | null;
  soundEnabled: boolean;
  onStart: () => void;
  onComplete: (stars: number, score: number) => void;
};

type PhaseAwareProps<TPhase extends GamePhase> = GameRuntimeProps & {
  phase: TPhase;
};

type MemoryCard = {
  id: number;
  symbol: string;
  matched: boolean;
};

type MathQuestion = {
  prompt: string;
  visual: string;
  correct: number;
  options: number[];
};

type SyncStatus = 'idle' | 'loading' | 'success' | 'error';
type CatalogSource = 'local' | 'remote' | 'draft';

type CelebrationState = {
  title: string;
  stars: number;
  score: number;
  reward: string;
  nextPhaseId: string | null;
  unlockedCount: number;
  unlockedNow: boolean;
};

type ToastState = {
  id: number;
  tone: 'success' | 'info' | 'warning' | 'error';
  title: string;
  text: string;
};

type ParentGateState = {
  title: string;
  description: string;
  accent: 'rose' | 'indigo' | 'emerald';
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
};

type SeasonClaimMap = Record<string, string[]>;

const LOCAL_KEYS = {
  profiles: 'escola-v6-profiles',
  activeProfileId: 'escola-v6-active-profile',
  progress: 'escola-v6-progress',
  parentSettings: 'escola-v6-parent-settings',
  dailyUsage: 'escola-v6-daily-usage',
  selectedPhase: 'escola-v6-selected-phase',
  deviceId: 'escola-v6-device-id',
  sessionHistory: 'escola-v9-session-history',
  dailyMissions: 'escola-v11-daily-missions',
  onboardingSeen: 'escola-v11-onboarding-seen',
  seasonClaims: 'escola-v12-season-claims',
  varietyBonusClaims: 'escola-v14-variety-bonus',
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const shuffle = <T,>(list: T[]) => {
  const clone = [...list];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
};

const sample = <T,>(list: T[], total: number) => shuffle(list).slice(0, total);

const createEmptyPhaseProgress = (unlocked: boolean): PhaseProgress => ({
  plays: 0,
  completions: 0,
  bestStars: 0,
  bestScore: 0,
  unlocked,
});

const createEmptyGameProgress = (game: GameKey): SingleGameProgress => ({
  plays: 0,
  completions: 0,
  bestStars: 0,
  lastStars: 0,
  bestScore: 0,
  phases: Object.fromEntries(worldPhaseOrder[game].map((phaseId, index) => [phaseId, createEmptyPhaseProgress(index === 0)])),
});

const createEmptyProfileProgress = (): ProfileProgress => ({
  totalStars: 0,
  totalCompletions: 0,
  totalPlayTimeSeconds: 0,
  bonusStars: 0,
  unlockedRewards: [],
  games: {
    memory: createEmptyGameProgress('memory'),
    alphabet: createEmptyGameProgress('alphabet'),
    math: createEmptyGameProgress('math'),
    shape: createEmptyGameProgress('shape'),
    colors: createEmptyGameProgress('colors'),
    maze: createEmptyGameProgress('maze'),
    puzzle: createEmptyGameProgress('puzzle'),
  },
});

const defaultParentSettings: ParentSettings = {
  dailyLimitMinutes: 25,
  breakReminderMinutes: 10,
  audioEnabled: true,
  narrationEnabled: true,
};

const normalizeUsage = (usage: DailyUsage): DailyUsage => (usage.date === getTodayKey() ? usage : { date: getTodayKey(), usageByProfile: {} });

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}min ${String(remainingSeconds).padStart(2, '0')}s`;
};

const clampAge = (age: number) => Math.min(7, Math.max(4, Math.round(age || 4)));

const getDefaultAvatar = (index = 0) => avatarOptions[index % avatarOptions.length]?.emoji ?? '🦊';
const getDefaultBuddy = (index = 0) => buddyOptions[index % buddyOptions.length]?.emoji ?? '⭐';
const getDefaultMascotTheme = (index = 0) => mascotThemeOptions[index % mascotThemeOptions.length]?.id ?? 'classic';

const normalizeProfiles = (items: ChildProfile[]) => items.map((profile, index) => ({
  ...profile,
  age: clampAge(profile.age),
  accent: profile.accent ?? profileAccentPalette[index % profileAccentPalette.length],
  avatar: profile.avatar ?? getDefaultAvatar(index),
  buddy: profile.buddy ?? getDefaultBuddy(index),
  mascotTheme: profile.mascotTheme ?? getDefaultMascotTheme(index),
}));

const stopSpeaking = () => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
};

const speakText = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  const preferredVoice = voices.find((voice) => voice.lang.toLowerCase().includes('pt-br')) ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('pt'));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
    utterance.lang = preferredVoice.lang;
  } else {
    utterance.lang = 'pt-BR';
  }
  utterance.rate = 0.95;
  utterance.pitch = 1.08;
  synth.speak(utterance);
  return true;
};

const getRewardLabels = (phaseRewards: string[], totalStars: number) => {
  const milestoneRewards = rewardMilestones.filter((item) => totalStars >= item.threshold).map((item) => item.label);
  return Array.from(new Set([...phaseRewards, ...milestoneRewards]));
};

const recalculateProfileProgress = (progress: ProfileProgress): ProfileProgress => {
  let totalStars = 0;
  let bestStarsTotal = 0;
  const phaseRewards: string[] = [];

  const nextGames = Object.fromEntries(
    (Object.keys(progress.games) as GameKey[]).map((game) => {
      const gameProgress = progress.games[game];
      let gameBestStars = 0;
      const nextPhases = { ...gameProgress.phases };
      worldPhaseOrder[game].forEach((phaseId, index) => {
        const phaseState = nextPhases[phaseId] ?? createEmptyPhaseProgress(index === 0);
        nextPhases[phaseId] = phaseState;
        gameBestStars += phaseState.bestStars;
        totalStars += phaseState.bestStars;
        if (phaseState.completions > 0) {
          phaseRewards.push(phaseMap[phaseId].reward);
        }
      });
      bestStarsTotal += gameBestStars;
      return [
        game,
        {
          ...gameProgress,
          bestStars: gameBestStars,
          phases: nextPhases,
        },
      ];
    })
  ) as ProfileProgress['games'];

  const combinedStars = totalStars + (progress.bonusStars ?? 0);

  return {
    ...progress,
    games: nextGames,
    totalStars: combinedStars,
    unlockedRewards: getRewardLabels(phaseRewards, combinedStars),
  };
};

const worldByGame = Object.fromEntries(worlds.map((world) => [world.game, world])) as Record<GameKey, (typeof worlds)[number]>;

const normalizeStoredProgress = (progress?: Partial<ProfileProgress> | null): ProfileProgress => {
  const nextGames = Object.fromEntries(
    (Object.keys(createEmptyProfileProgress().games) as GameKey[]).map((game) => {
      const storedGame = progress?.games?.[game];
      const phases = Object.fromEntries(
        worldPhaseOrder[game].map((phaseId, index) => {
          const storedPhase = storedGame?.phases?.[phaseId];
          return [phaseId, {
            plays: storedPhase?.plays ?? 0,
            completions: storedPhase?.completions ?? 0,
            bestStars: storedPhase?.bestStars ?? 0,
            bestScore: storedPhase?.bestScore ?? 0,
            unlocked: storedPhase?.unlocked ?? index === 0,
          }];
        })
      );
      return [game, {
        plays: storedGame?.plays ?? 0,
        completions: storedGame?.completions ?? 0,
        bestStars: storedGame?.bestStars ?? 0,
        lastStars: storedGame?.lastStars ?? 0,
        bestScore: storedGame?.bestScore ?? 0,
        phases,
      }];
    })
  ) as ProfileProgress['games'];

  return recalculateProfileProgress({
    totalStars: progress?.totalStars ?? 0,
    totalCompletions: progress?.totalCompletions ?? 0,
    totalPlayTimeSeconds: progress?.totalPlayTimeSeconds ?? 0,
    bonusStars: progress?.bonusStars ?? 0,
    unlockedRewards: progress?.unlockedRewards ?? [],
    games: nextGames,
  });
};


const getNextPhaseId = (game: GameKey, phaseId: string) => {
  const order = worldPhaseOrder[game];
  const currentIndex = order.indexOf(phaseId);
  return currentIndex >= 0 ? order[currentIndex + 1] ?? null : null;
};

const getRecommendedPhaseId = (progress: ProfileProgress | null): string => {
  if (!progress) return worldPhaseOrder.memory[0];
  for (const world of worlds) {
    const order = worldPhaseOrder[world.game];
    for (const phaseId of order) {
      const state = progress.games[world.game].phases[phaseId];
      if (state.unlocked && state.completions === 0) return phaseId;
    }
  }
  const memoryFallback = worldPhaseOrder.memory.at(-1);
  return memoryFallback ?? worldPhaseOrder.memory[0];
};

const getGameForPhase = (phaseId: string) => phaseMap[phaseId].game;

const getRecommendedPackIdForAge = (age: number, packs: ContentPack[]) => packs.find((pack) => pack.recommendedAges.includes(clampAge(age)))?.id ?? packs[0]?.id ?? '';

const getPackWorlds = (phaseIds: string[]) => Array.from(new Set(phaseIds.map((phaseId) => getGameForPhase(phaseId))));

const getPackProgressSummary = (phaseIds: string[], progress: ProfileProgress | null) => {
  return phaseIds.reduce(
    (summary, phaseId) => {
      const game = getGameForPhase(phaseId);
      const state = getPhaseStatus(progress, game, phaseId);
      return {
        completed: summary.completed + (state.completions > 0 ? 1 : 0),
        unlocked: summary.unlocked + (state.unlocked ? 1 : 0),
        stars: summary.stars + state.bestStars,
      };
    },
    { completed: 0, unlocked: 0, stars: 0 }
  );
};

const getMascotThemeLabel = (themeId?: string) => mascotThemeOptions.find((item) => item.id === themeId)?.label ?? 'Clássica brilhante';

const getMascotMessage = (profile: ChildProfile | null, phaseId: string) => {
  const phase = phaseMap[phaseId];
  const age = clampAge(profile?.age ?? 5);
  const ageText = ageTracks.find((item) => item.age.startsWith(String(age)))?.content ?? 'descoberta e brincadeira';
  const world = worldByGame[phase.game];
  const buddyLabel = buddyOptions.find((item) => item.emoji === profile?.buddy)?.label ?? 'companheiro de aventura';
  const childName = profile?.name ? ` ${profile.name}` : '';
  const themeLabel = getMascotThemeLabel(profile?.mascotTheme).toLowerCase();
  return `Oi${childName}! Eu sou a Estelinha no estilo ${themeLabel} e hoje o seu ${buddyLabel} vai brincar com você em ${world.title}. A fase ${phase.title} foi pensada para ${age} anos, com foco em ${ageText.toLowerCase()}. ${phase.description}`;
};

const getPhaseStatus = (progress: ProfileProgress | null, game: GameKey, phaseId: string) => progress?.games[game].phases[phaseId] ?? createEmptyPhaseProgress(phaseId === worldPhaseOrder[game][0]);


const getRewardEmoji = (reward: string) => {
  const lowered = reward.toLowerCase();
  if (lowered.includes('estrela') || lowered.includes('brilh')) return '⭐';
  if (lowered.includes('mestre') || lowered.includes('campeão') || lowered.includes('guardião') || lowered.includes('lenda')) return '🏆';
  if (lowered.includes('explor')) return '🧭';
  if (lowered.includes('primeiros')) return '🌱';
  if (lowered.includes('memória')) return '🧠';
  if (lowered.includes('letra') || lowered.includes('palavra')) return '🔤';
  if (lowered.includes('número') || lowered.includes('conta')) return '🔢';
  if (lowered.includes('cor')) return '🎨';
  if (lowered.includes('forma') || lowered.includes('encaixe')) return '🧩';
  return '🎁';
};

const getProfileRank = (totalStars: number) => {
  if (totalStars >= 168) return 'Lenda Brilhante';
  if (totalStars >= 120) return 'Mestre dos Mundos';
  if (totalStars >= 84) return 'Guardião das Estrelas';
  if (totalStars >= 42) return 'Explorador Especial';
  if (totalStars >= 20) return 'Aprendiz Curioso';
  return 'Pequeno Explorador';
};

const normalizeSessionHistory = (history: SessionHistory | undefined | null): SessionHistory => history ?? {};

const normalizeParentSettings = (settings: ParentSettings | null | undefined): ParentSettings => ({
  dailyLimitMinutes: Number.isFinite(settings?.dailyLimitMinutes) ? Math.max(5, Math.round(settings!.dailyLimitMinutes)) : defaultParentSettings.dailyLimitMinutes,
  breakReminderMinutes: Number.isFinite(settings?.breakReminderMinutes) ? Math.max(3, Math.round(settings!.breakReminderMinutes)) : defaultParentSettings.breakReminderMinutes,
  audioEnabled: settings?.audioEnabled ?? defaultParentSettings.audioEnabled,
  narrationEnabled: settings?.narrationEnabled ?? defaultParentSettings.narrationEnabled,
});

const normalizeProgressMap = (map: Record<string, Partial<ProfileProgress>> | null | undefined) =>
  Object.fromEntries(Object.entries(map ?? {}).map(([profileId, progress]) => [profileId, normalizeStoredProgress(progress)]));

const normalizeDailyMissionMap = (map: Record<string, DailyMissionState> | null | undefined, progressMap: Record<string, ProfileProgress>) =>
  Object.fromEntries(Object.entries(map ?? {}).map(([profileId, state]) => [profileId, normalizeDailyMissionState(state, progressMap[profileId] ?? null)]));

const normalizeSeasonClaims = (claims: SeasonClaimMap | null | undefined): SeasonClaimMap =>
  Object.fromEntries(Object.entries(claims ?? {}).map(([profileId, items]) => [profileId, Array.isArray(items) ? items : []]));

const normalizeOnboardingSeen = (items: Record<string, boolean> | null | undefined): Record<string, boolean> =>
  Object.fromEntries(Object.entries(items ?? {}).map(([profileId, seen]) => [profileId, Boolean(seen)]));

const normalizeVarietyBonusClaims = (items: Record<string, string> | null | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(items ?? {}).map(([profileId, claim]) => [profileId, typeof claim === 'string' ? claim : '']));

const normalizeCloudPayload = (payload: CloudSavePayload) => {
  const normalizedProfiles = normalizeProfiles(Array.isArray(payload.profiles) ? payload.profiles : []);
  const normalizedProgressMap = normalizeProgressMap(payload.progressMap);
  normalizedProfiles.forEach((profile) => {
    if (!normalizedProgressMap[profile.id]) normalizedProgressMap[profile.id] = createEmptyProfileProgress();
  });
  return {
    profiles: normalizedProfiles,
    activeProfileId: payload.activeProfileId || normalizedProfiles[0]?.id || '',
    progressMap: normalizedProgressMap,
    parentSettings: normalizeParentSettings(payload.parentSettings),
    dailyUsage: normalizeUsage(payload.dailyUsage ?? { date: getTodayKey(), usageByProfile: {} }),
    sessionHistory: normalizeSessionHistory(payload.sessionHistory),
    dailyMissionMap: normalizeDailyMissionMap(payload.dailyMissionMap, normalizedProgressMap),
    onboardingSeen: normalizeOnboardingSeen(payload.onboardingSeen),
    seasonClaims: normalizeSeasonClaims(payload.seasonClaims),
    varietyBonusClaims: normalizeVarietyBonusClaims(payload.varietyBonusClaims),
    contentManifestVersion: payload.contentManifestVersion ?? dynamicContentBlueprint.version,
  };
};

const markPlayedToday = (history: SessionHistory, profileId: string) => {
  const today = getTodayKey();
  const existing = history[profileId] ?? [];
  if (existing.includes(today)) return history;
  return { ...history, [profileId]: [...existing, today].sort() };
};

const getProfileActiveDays = (history: SessionHistory, profileId: string) => (history[profileId] ?? []).length;

const getProfileStreak = (history: SessionHistory, profileId: string) => {
  const played = new Set(history[profileId] ?? []);
  let streak = 0;
  const cursor = new Date();
  while (played.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

const getRecentDays = (history: SessionHistory, profileId: string, total: number) => {
  const played = new Set(history[profileId] ?? []);
  return Array.from({ length: total }, (_, index) => {
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - (total - 1 - index));
    const key = cursor.toISOString().slice(0, 10);
    return {
      key,
      shortLabel: cursor.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3),
      played: played.has(key),
    };
  });
};

const getFavoriteWorld = (progress: ProfileProgress | null) => {
  if (!progress) return worlds[0];
  const [top] = [...worlds].sort((a, b) => progress.games[b.game].completions - progress.games[a.game].completions);
  return top ?? worlds[0];
};

const getRandomUnlockedPhaseId = (progress: ProfileProgress | null) => {
  const unlocked = worlds.flatMap((world) => worldPhaseOrder[world.game].filter((phaseId) => getPhaseStatus(progress, world.game, phaseId).unlocked));
  return unlocked.length ? unlocked[Math.floor(Math.random() * unlocked.length)] : worldPhaseOrder.memory[0];
};

const buildExperienceSummary = (profile: ChildProfile | null, progress: ProfileProgress | null, history: SessionHistory) => {
  const totalStars = progress?.totalStars ?? 0;
  return {
    rank: getProfileRank(totalStars),
    activeDays: profile ? getProfileActiveDays(history, profile.id) : 0,
    streak: profile ? getProfileStreak(history, profile.id) : 0,
    favoriteWorld: getFavoriteWorld(progress),
  };
};

const getOfflineActivityTip = (world: (typeof worlds)[number]) => {
  const tips: Record<GameKey, string> = {
    memory: 'Brinque de achar pares com objetos da casa ou desenhos em papel para repetir o desafio fora da tela.',
    alphabet: 'Peça para a criança falar palavras que começam com a mesma letra do jogo e apontar objetos ao redor.',
    math: 'Conte brinquedos, passos ou frutas da cozinha para reforçar o raciocínio da fase atual.',
    shape: 'Procurem juntos formas geométricas em portas, pratos, janelas e caixas da casa.',
    colors: 'Separem brinquedos ou roupas por cor em pequenos montinhos para continuar a brincadeira.',
    maze: 'Monte uma rota no chão com almofadas e convide a criança a seguir pistas simples.',
    puzzle: 'Recortem uma figura simples em partes grandes para a criança montar fora da tela.',
  };
  return tips[world.game];
};
const worldStickerEmoji: Record<GameKey, string> = {
  memory: '🧠',
  alphabet: '🔤',
  math: '🔢',
  shape: '🧩',
  colors: '🎨',
  maze: '🗺️',
  puzzle: '🖼️',
};

const getLeastPlayedWorld = (progress: ProfileProgress | null) => {
  const ranked = worlds
    .map((world) => {
      const gameProgress = progress?.games[world.game] ?? createEmptyGameProgress(world.game);
      return {
        world,
        plays: gameProgress.plays,
        completions: gameProgress.completions,
        stars: gameProgress.bestStars,
      };
    })
    .sort((a, b) => a.completions - b.completions || a.plays - b.plays || a.stars - b.stars || a.world.shortTitle.localeCompare(b.world.shortTitle, 'pt-BR'));
  return ranked[0] ?? { world: worlds[0], plays: 0, completions: 0, stars: 0 };
};

const getVarietyInsight = (progress: ProfileProgress | null) => {
  const target = getLeastPlayedWorld(progress);
  const phaseId = getFirstPlayablePhaseForWorld(progress, target.world.game);
  const phase = phaseMap[phaseId];
  return {
    ...target,
    phaseId,
    title: `Hoje vale visitar ${target.world.shortTitle}`,
    text: `${target.world.title} é o mundo menos explorado até agora. Jogar ${phase.title} ajuda a variar estímulos, evita repetição e rende um bônus de rodízio na primeira vitória do dia.`,
  };
};

const buildDailyMissionState = (progress: ProfileProgress | null): DailyMissionState => {
  const favorite = getFavoriteWorld(progress);
  return {
    date: getTodayKey(),
    missions: [
      {
        id: 'play-any',
        kind: 'play',
        title: 'Rodada do dia',
        description: 'Jogue uma fase para acordar a aventura.',
        progress: 0,
        target: 1,
        rewardStars: 1,
        completed: false,
        claimed: false,
      },
      {
        id: 'complete-any',
        kind: 'complete',
        title: 'Vitória brilhante',
        description: 'Conclua uma fase e ganhe estrelas bônus.',
        progress: 0,
        target: 1,
        rewardStars: 2,
        completed: false,
        claimed: false,
      },
      {
        id: `world-${favorite.game}`,
        kind: 'world',
        title: `Passeio em ${favorite.shortTitle}`,
        description: `Brinque uma vez em ${favorite.title}.`,
        progress: 0,
        target: 1,
        rewardStars: 2,
        completed: false,
        claimed: false,
        world: favorite.game,
      },
    ],
  };
};

const normalizeDailyMissionState = (state: DailyMissionState | null | undefined, progress: ProfileProgress | null) => {
  if (state && state.date === getTodayKey()) return state;
  return buildDailyMissionState(progress);
};

const advanceMissionState = (state: DailyMissionState, events: Array<{ kind: DailyMissionKind; world?: GameKey }>) => ({
  ...state,
  missions: state.missions.map((mission) => {
    const shouldAdvance = events.some((event) => {
      if (mission.kind === 'play' && event.kind === 'play') return true;
      if (mission.kind === 'complete' && event.kind === 'complete') return true;
      if (mission.kind === 'world' && event.kind === 'world' && mission.world === event.world) return true;
      return false;
    });
    if (!shouldAdvance || mission.completed) return mission;
    const nextProgress = Math.min(mission.target, mission.progress + 1);
    return {
      ...mission,
      progress: nextProgress,
      completed: nextProgress >= mission.target,
    };
  }),
});

const getFirstPlayablePhaseForWorld = (progress: ProfileProgress | null, game: GameKey) =>
  worldPhaseOrder[game].find((phaseId) => {
    const state = getPhaseStatus(progress, game, phaseId);
    return state.unlocked && state.completions === 0;
  }) ?? worldPhaseOrder[game].find((phaseId) => getPhaseStatus(progress, game, phaseId).unlocked) ?? worldPhaseOrder[game][0];

const buildVaultItems = (progress: ProfileProgress | null, streak: number) => {
  const worldItems = worlds.map((world) => {
    const completed = worldPhaseOrder[world.game].filter((phaseId) => getPhaseStatus(progress, world.game, phaseId).completions > 0).length;
    const needed = Math.max(1, Math.ceil(worldPhaseOrder[world.game].length / 3));
    const unlocked = completed >= needed;
    return {
      id: `seal-${world.game}`,
      emoji: unlocked ? worldStickerEmoji[world.game] : '🔒',
      title: `Selo ${world.shortTitle}`,
      subtitle: unlocked ? 'Guardado no cofre encantado.' : `Conclua ${needed} fases neste mundo.`,
      unlocked,
    };
  });

  const streakItem = {
    id: 'streak-gift',
    emoji: streak >= 3 ? '🔥' : '🔒',
    title: 'Foguinho da rotina',
    subtitle: streak >= 3 ? 'Você já jogou em 3 dias seguidos.' : 'Jogue em 3 dias seguidos para acender este presente.',
    unlocked: streak >= 3,
  };

  return [...worldItems.slice(0, 6), streakItem];
};

const buildMascotCards = (profile: ChildProfile | null, progress: ProfileProgress | null, recommendedPhaseId: string) => {
  const favoriteWorld = getFavoriteWorld(progress);
  const theme = mascotThemeOptions.find((item) => item.id === profile?.mascotTheme) ?? mascotThemeOptions[0];
  return [
    {
      emoji: theme.emoji,
      title: `Estelinha ${theme.label}`,
      text: `${profile?.name ?? 'Amiguinho'}, hoje a melhor porta de entrada é ${phaseMap[recommendedPhaseId].title}.`,
    },
    {
      emoji: '🗺️',
      title: 'Aventura favorita',
      text: `${favoriteWorld.shortTitle} está em destaque. Isso ajuda a manter confiança e vontade de continuar.`,
    },
    {
      emoji: '🏡',
      title: 'Fora da tela',
      text: getOfflineActivityTip(favoriteWorld),
    },
  ];
};


const getCurrentGoals = (progress: ProfileProgress | null, recommendedPhaseId: string, recommendedPackId: string, packs: ContentPack[]) => {
  const nextPhaseState = getPhaseStatus(progress, getGameForPhase(recommendedPhaseId), recommendedPhaseId);
  const nextMilestone = rewardMilestones.find((item) => item.threshold > (progress?.totalStars ?? 0));
  const preferredPack = packs.find((pack) => pack.id === recommendedPackId) ?? packs[0];
  const packSummary = getPackProgressSummary(preferredPack.phaseIds, progress);
  const favoriteWorld = getFavoriteWorld(progress);
  const favoriteWorldPlays = progress?.games[favoriteWorld.game].plays ?? 0;
  const starTarget = nextMilestone?.threshold ?? Math.max(6, progress?.totalStars ?? 0);

  return [
    { key: 'phase', title: 'Concluir a próxima fase', subtitle: phaseMap[recommendedPhaseId].title, progress: nextPhaseState.completions > 0 ? 'Concluída' : 'Ainda em aberto', done: nextPhaseState.completions > 0 },
    { key: 'stars', title: 'Chegar ao próximo marco', subtitle: nextMilestone?.label ?? 'Coleção máxima', progress: `${progress?.totalStars ?? 0} / ${starTarget} estrelas`, done: (progress?.totalStars ?? 0) >= starTarget },
    { key: 'pack', title: 'Explorar a trilha sugerida', subtitle: preferredPack.title, progress: `${packSummary.completed}/${preferredPack.phaseIds.length} fases concluídas · ${favoriteWorld.shortTitle} já teve ${favoriteWorldPlays} partidas`, done: packSummary.completed >= Math.min(3, preferredPack.phaseIds.length) },
  ];
};

const getWorldPassportSummary = (progress: ProfileProgress | null) =>
  worlds.map((world) => {
    const gameProgress = progress?.games[world.game] ?? createEmptyGameProgress(world.game);
    const completed = worldPhaseOrder[world.game].filter((phaseId) => gameProgress.phases[phaseId].completions > 0).length;
    return {
      world,
      completed,
      total: worldPhaseOrder[world.game].length,
      mastered: completed >= Math.ceil(worldPhaseOrder[world.game].length * 0.66),
    };
  });

const getWorldMedal = (progress: ProfileProgress | null, game: GameKey) => {
  const total = worldPhaseOrder[game].length;
  const completed = worldPhaseOrder[game].filter((phaseId) => getPhaseStatus(progress, game, phaseId).completions > 0).length;
  const ratio = total ? completed / total : 0;
  if (ratio >= 1) return { medal: '👑', label: 'Coroa do mundo', color: 'bg-yellow-100 text-yellow-800' };
  if (ratio >= 0.66) return { medal: '🥇', label: 'Ouro', color: 'bg-amber-100 text-amber-800' };
  if (ratio >= 0.33) return { medal: '🥈', label: 'Prata', color: 'bg-slate-100 text-slate-700' };
  if (completed > 0) return { medal: '🥉', label: 'Bronze', color: 'bg-orange-100 text-orange-700' };
  return { medal: '🔒', label: 'Comece este mundo', color: 'bg-indigo-100 text-indigo-700' };
};

const getSeasonProgress = (progress: ProfileProgress | null, event: SeasonalEvent) => worldPhaseOrder[event.world].filter((phaseId) => getPhaseStatus(progress, event.world, phaseId).completions > 0).length;

const buildWeeklyParentTrack = (profile: ChildProfile | null, progress: ProfileProgress | null, tracks: ParentWeeklyTrack[]) => {
  const favoriteWorld = getFavoriteWorld(progress);
  const age = clampAge(profile?.age ?? 5);
  const matchedTrack = tracks.find((track) => age >= track.ageMin && age <= track.ageMax && (!track.world || track.world === favoriteWorld.game))
    ?? tracks.find((track) => age >= track.ageMin && age <= track.ageMax)
    ?? tracks[0];
  if (matchedTrack?.days?.length) return matchedTrack.days;
  const focusByWorld: Record<GameKey, string> = {
    memory: 'memória e atenção',
    alphabet: 'linguagem e consciência fonológica',
    math: 'contagem e lógica inicial',
    shape: 'coordenação fina e percepção visual',
    colors: 'classificação e vocabulário visual',
    maze: 'planejamento e orientação espacial',
    puzzle: 'organização visual e persistência',
  };
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
  return days.map((day, index) => ({
    day,
    title: `${favoriteWorld.shortTitle} com ritmo leve`,
    screen: `Jogar ${index + 1} fase(s) em ${favoriteWorld.shortTitle} por 10 a 15 minutos.`,
    offline: getOfflineActivityTip(favoriteWorld),
    goal: `Reforçar ${focusByWorld[favoriteWorld.game]} em uma proposta adequada para ${age} anos.`,
  }));
};


const ShapeBadge = ({ shape, color, size }: { shape: ShapeId; color: string; size: 'md' | 'lg' }) => {
  const classes = size === 'lg' ? 'h-16 w-16' : 'h-10 w-10';
  if (shape === 'circle') return <div className={cn(classes, 'rounded-full')} style={{ backgroundColor: color }} />;
  if (shape === 'square') return <div className={cn(classes, 'rounded-[0.9rem]')} style={{ backgroundColor: color }} />;
  if (shape === 'triangle') return <div className={cn(classes, 'clip-triangle')} style={{ backgroundColor: color }} />;
  if (shape === 'diamond') return <div className={cn(classes, 'rotate-45 rounded-[0.75rem]')} style={{ backgroundColor: color }} />;
  if (shape === 'heart') {
    return (
      <div className="relative h-12 w-12 scale-110">
        <div className="absolute left-1/2 top-0 h-7 w-7 -translate-x-full rounded-full" style={{ backgroundColor: color }} />
        <div className="absolute right-1/2 top-0 h-7 w-7 translate-x-full rounded-full" style={{ backgroundColor: color }} />
        <div className="absolute left-1/2 top-3 h-7 w-7 -translate-x-1/2 rotate-45 rounded-[0.45rem]" style={{ backgroundColor: color }} />
      </div>
    );
  }
  return <Star className={cn(size === 'lg' ? 'h-16 w-16' : 'h-10 w-10', 'fill-current')} style={{ color }} />;
};

const SectionTitle = ({ badge, title, text }: { badge: string; title: string; text: string }) => (
  <div className="mb-10 max-w-3xl">
    <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-indigo-700 shadow-[0_10px_30px_rgba(79,70,229,0.12)] backdrop-blur-xl">
      <span className="text-pink-500">✦</span>
      {badge}
    </div>
    <h2 className="mt-5 text-3xl font-black leading-[1.02] text-slate-950 md:text-5xl">{title}</h2>
    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-700 md:text-[1.15rem]">{text}</p>
  </div>
);

const ProgressBar = ({ value, max }: { value: number; max: number }) => {
  const width = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-3.5 overflow-hidden rounded-full bg-slate-200/90 shadow-inner shadow-slate-300/40 ring-1 ring-white/70">
      <div className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#f472b6_52%,#6366f1_100%)] shadow-[0_6px_18px_rgba(99,102,241,0.22)] transition-all" style={{ width: `${width}%` }} />
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, desc, color }: FeatureCardProps) => (
  <div className="group relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_24px_70px_rgba(76,81,191,0.12)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_32px_90px_rgba(76,81,191,0.18)]">
    <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#22c55e,#38bdf8,#8b5cf6,#f472b6)] opacity-80" />
    <div className={cn('mb-5 inline-flex rounded-[1.4rem] p-4 text-white shadow-[0_14px_30px_rgba(99,102,241,0.24)]', color)}>
      <Icon className="h-7 w-7" />
    </div>
    <h3 className="text-xl font-black text-slate-950">{title}</h3>
    <p className="mt-3 leading-relaxed text-slate-700">{desc}</p>
  </div>
);

const ToastBanner = ({ toast, onClose }: { toast: ToastState; onClose: () => void }) => {
  const toneClass = {
    success: 'border-emerald-200/90 bg-white/92 text-emerald-950',
    info: 'border-indigo-200/90 bg-white/92 text-indigo-950',
    warning: 'border-amber-200/90 bg-white/92 text-amber-950',
    error: 'border-rose-200/90 bg-white/92 text-rose-950',
  }[toast.tone];

  return (
    <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} className={cn('pointer-events-auto w-full max-w-sm rounded-[1.8rem] border p-4 shadow-[0_30px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl', toneClass)}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-[linear-gradient(135deg,#ffffff_0%,#eef2ff_100%)] text-lg shadow-sm ring-1 ring-white/80">{toast.tone === 'success' ? '✨' : toast.tone === 'warning' ? '🛡️' : toast.tone === 'error' ? '⚠️' : '💡'}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] opacity-60">{toast.title}</div>
          <div className="mt-1 text-sm font-semibold leading-relaxed">{toast.text}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full bg-white/90 p-2 text-current shadow-sm ring-1 ring-slate-100"><X className="h-4 w-4" /></button>
      </div>
    </motion.div>
  );
};

const ParentGateModal = ({ gate, onClose }: { gate: ParentGateState; onClose: () => void }) => {
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const stopHold = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
  };

  const startHold = () => {
    stopHold();
    const startedAt = Date.now();
    intervalRef.current = window.setInterval(() => {
      const next = Math.min(100, ((Date.now() - startedAt) / 1200) * 100);
      setProgress(next);
      if (next >= 100) {
        stopHold();
        Promise.resolve(gate.onConfirm()).finally(onClose);
      }
    }, 16);
  };

  useEffect(() => stopHold, []);

  const accentClass = {
    rose: 'from-rose-500 via-pink-500 to-orange-400',
    indigo: 'from-indigo-500 via-violet-500 to-sky-400',
    emerald: 'from-emerald-500 via-teal-500 to-sky-400',
  }[gate.accent];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/56 p-4 backdrop-blur-md">
      <motion.div initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 14, scale: 0.98 }} className="w-full max-w-lg overflow-hidden rounded-[2.4rem] border border-white/60 bg-white/92 p-6 shadow-[0_40px_120px_rgba(15,23,42,0.30)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#22c55e,#38bdf8,#8b5cf6,#f472b6,#f59e0b)]" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-indigo-500">Área dos pais</div>
            <h3 className="mt-2 text-2xl font-black text-slate-950">{gate.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{gate.description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-600 ring-1 ring-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 rounded-[1.8rem] bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_100%)] p-4 ring-1 ring-white">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Confirmação protegida</div>
          <div className="mt-2 text-sm font-semibold text-slate-800">Segure o botão por 1,2 segundo para confirmar. Isso reduz toques acidentais em ações sensíveis.</div>
          <div className="mt-4 h-3 rounded-full bg-white shadow-inner shadow-slate-200/80">
            <div className={cn('h-3 rounded-full bg-gradient-to-r transition-all', accentClass)} style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onMouseDown={startHold}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            onTouchStart={startHold}
            onTouchEnd={stopHold}
            className={cn('inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r px-5 py-3 text-sm font-black text-white shadow-[0_16px_34px_rgba(99,102,241,0.28)]', accentClass)}
          >
            <ShieldCheck className="h-4 w-4" /> {gate.confirmLabel}
          </button>
          <button type="button" onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-slate-900 ring-1 ring-slate-200">Cancelar</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const MiniGameShell = ({
  title,
  subtitle,
  progress,
  children,
  cta,
  disabledReason,
}: {
  title: string;
  subtitle: string;
  progress: string;
  children: ReactNode;
  cta: ReactNode;
  disabledReason: string | null;
}) => (
  <div className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/88 p-5 shadow-[0_30px_100px_rgba(79,70,229,0.14)] backdrop-blur-xl md:p-7">
    <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#22c55e,#38bdf8,#8b5cf6,#f472b6,#f59e0b)] opacity-90" />
    <div className="absolute right-0 top-0 h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.18),_transparent_70%)]" />
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-indigo-600 ring-1 ring-white">{progress}</div>
        <h3 className="mt-3 text-2xl font-black text-slate-950">{title}</h3>
        <p className="mt-2 text-slate-700">{subtitle}</p>
      </div>
      <div>{cta}</div>
    </div>
    {children}
    {disabledReason && (
      <div className="absolute inset-0 rounded-[2.5rem] bg-slate-950/72 p-6 text-white backdrop-blur-md">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.6rem] bg-white/10 text-yellow-300 ring-1 ring-white/10"><Lock className="h-8 w-8" /></div>
          <div className="mt-4 text-2xl font-black">Sessão pausada</div>
          <p className="mt-3 max-w-lg text-white/80">{disabledReason}</p>
        </div>
      </div>
    )}
  </div>
);


const buildMemoryDeck = (phase: MemoryPhase) => {
  const selectedSymbols = sample(memoryThemePools[phase.theme], phase.pairCount);
  const duplicated = selectedSymbols.flatMap((symbol, index) => [
    { id: index * 2, symbol, matched: false },
    { id: index * 2 + 1, symbol, matched: false },
  ]);
  return shuffle(duplicated);
};

const calculateMemoryStars = (phase: MemoryPhase, moves: number) => {
  if (moves <= phase.movesFor3Stars) return 3;
  if (moves <= phase.movesFor2Stars) return 2;
  return 1;
};

const MemoryGame = ({ phase, disabledReason, soundEnabled, onStart, onComplete }: PhaseAwareProps<MemoryPhase>) => {
  const [deck, setDeck] = useState<MemoryCard[]>(() => buildMemoryDeck(phase));
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [started, setStarted] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setDeck(buildMemoryDeck(phase));
    setFlippedIds([]);
    setMoves(0);
    setStarted(false);
    setReported(false);
  }, [phase.id]);

  const allMatched = deck.every((card) => card.matched);
  const gridCols = phase.pairCount >= 6 ? 'grid-cols-4' : phase.pairCount >= 5 ? 'grid-cols-5' : 'grid-cols-3';

  useEffect(() => {
    if (!allMatched || reported) return;
    const stars = calculateMemoryStars(phase, moves);
    playSound('reward', soundEnabled);
    onComplete(stars, Math.max(1, phase.movesFor2Stars * 10 - moves * 3));
    setReported(true);
  }, [allMatched, moves, onComplete, phase, reported, soundEnabled]);

  const handleFlip = (id: number) => {
    if (disabledReason) return;
    const card = deck.find((item) => item.id === id);
    if (!card || card.matched || flippedIds.includes(id) || flippedIds.length === 2) return;
    if (!started) {
      setStarted(true);
      onStart();
    }
    playSound('tap', soundEnabled);
    const nextFlipped = [...flippedIds, id];
    setFlippedIds(nextFlipped);
    if (nextFlipped.length === 2) {
      setMoves((current) => current + 1);
      const firstCard = deck.find((item) => item.id === nextFlipped[0]);
      const secondCard = deck.find((item) => item.id === nextFlipped[1]);
      const match = firstCard?.symbol === secondCard?.symbol;
      window.setTimeout(() => {
        if (match) {
          playSound('success', soundEnabled);
          setDeck((current) => current.map((item) => (nextFlipped.includes(item.id) ? { ...item, matched: true } : item)));
        } else {
          playSound('error', soundEnabled);
        }
        setFlippedIds([]);
      }, 650);
    }
  };

  return (
    <MiniGameShell
      title={phase.title}
      subtitle={phase.description}
      progress={`Tema ${phase.theme} · ${phase.pairCount} pares · recompensa ${phase.reward}`}
      disabledReason={disabledReason}
      cta={
        <button
          type="button"
          onClick={() => {
            playSound('tap', soundEnabled);
            setDeck(buildMemoryDeck(phase));
            setFlippedIds([]);
            setMoves(0);
            setStarted(false);
            setReported(false);
          }}
          className="rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"
        >
          Embaralhar fase
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.34fr]">
        <div className={cn('grid gap-3', gridCols)}>
          {deck.map((card) => {
            const isVisible = card.matched || flippedIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => handleFlip(card.id)}
                className={cn(
                  'aspect-square rounded-[1.4rem] border-2 text-3xl font-black transition',
                  isVisible ? 'border-indigo-200 bg-white' : 'border-transparent bg-gradient-to-br from-indigo-500 to-pink-500 text-white'
                )}
              >
                {isVisible ? card.symbol : '?'}
              </button>
            );
          })}
        </div>
        <div className="space-y-4 rounded-[1.8rem] bg-indigo-50 p-5">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Fase</div>
            <div className="mt-2 text-3xl font-black text-indigo-950">{moves}</div>
            <div className="text-sm text-indigo-700">jogadas realizadas</div>
          </div>
          <div>
            <div className="text-sm font-bold text-indigo-600">Meta de 3 estrelas</div>
            <div className="mt-1 text-lg font-black text-indigo-950">até {phase.movesFor3Stars} jogadas</div>
          </div>
          <div>
            <div className="text-sm font-bold text-indigo-600">Meta de 2 estrelas</div>
            <div className="mt-1 text-lg font-black text-indigo-950">até {phase.movesFor2Stars} jogadas</div>
          </div>
        </div>
      </div>
    </MiniGameShell>
  );
};

const AlphabetGame = ({ phase, disabledReason, soundEnabled, onStart, onComplete }: PhaseAwareProps<AlphabetPhase>) => {
  const [questions, setQuestions] = useState(() => sample(alphabetPools[phase.poolTag], phase.questionCount));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setQuestions(sample(alphabetPools[phase.poolTag], phase.questionCount));
    setCurrentIndex(0);
    setHits(0);
    setSelectedOption(null);
    setStarted(false);
    setReported(false);
  }, [phase.id, phase.poolTag, phase.questionCount]);

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    if (currentIndex < questions.length || reported) return;
    const stars = hits === questions.length ? 3 : hits >= Math.ceil(questions.length * 0.7) ? 2 : 1;
    playSound('reward', soundEnabled);
    onComplete(stars, hits * 10);
    setReported(true);
  }, [currentIndex, hits, onComplete, questions.length, reported, soundEnabled]);

  const handleAnswer = (option: string) => {
    if (disabledReason || !currentQuestion || selectedOption) return;
    if (!started) {
      setStarted(true);
      onStart();
    }
    setSelectedOption(option);
    const correct = option === currentQuestion.letter;
    if (correct) {
      setHits((value) => value + 1);
      playSound('success', soundEnabled);
    } else {
      playSound('error', soundEnabled);
    }
    window.setTimeout(() => {
      setCurrentIndex((value) => value + 1);
      setSelectedOption(null);
    }, 700);
  };

  return (
    <MiniGameShell
      title={phase.title}
      subtitle={phase.description}
      progress={`${phase.questionCount} perguntas · conjunto ${phase.poolTag} · recompensa ${phase.reward}`}
      disabledReason={disabledReason}
      cta={
        <button
          type="button"
          onClick={() => {
            playSound('tap', soundEnabled);
            setQuestions(sample(alphabetPools[phase.poolTag], phase.questionCount));
            setCurrentIndex(0);
            setHits(0);
            setSelectedOption(null);
            setStarted(false);
            setReported(false);
          }}
          className="rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"
        >
          Nova rodada
        </button>
      }
    >
      {currentQuestion ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.35fr]">
          <div className="rounded-[2rem] bg-indigo-50 p-6">
            <div className="text-center text-7xl">{currentQuestion.emoji}</div>
            <div className="mt-4 text-center text-lg font-black text-indigo-950">Qual é a primeira letra de {currentQuestion.word}?</div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {currentQuestion.options.map((option) => {
                const correct = option === currentQuestion.letter;
                const isSelected = selectedOption === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleAnswer(option)}
                    className={cn(
                      'rounded-[1.6rem] px-4 py-5 text-3xl font-black transition',
                      isSelected && correct && 'bg-emerald-500 text-white',
                      isSelected && !correct && 'bg-rose-500 text-white',
                      !isSelected && 'bg-white text-indigo-950 hover:bg-indigo-100'
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-4 rounded-[1.8rem] bg-indigo-50 p-5">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Progresso</div>
              <div className="mt-2 text-lg font-black text-indigo-950">Pergunta {currentIndex + 1} de {questions.length}</div>
            </div>
            <ProgressBar value={currentIndex} max={questions.length} />
            <div className="rounded-2xl bg-white p-4">
              <div className="text-sm font-bold text-indigo-500">Acertos</div>
              <div className="mt-1 text-3xl font-black text-indigo-950">{hits}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[2rem] bg-indigo-50 p-8 text-center text-indigo-900">Fechando a rodada e calculando estrelas...</div>
      )}
    </MiniGameShell>
  );
};

const buildMathQuestions = (phase: MathPhase): MathQuestion[] => {
  if (phase.mode === 'count') {
    return Array.from({ length: phase.questionCount }, (_, index) => {
      const total = Math.max(1, Math.min(phase.maxValue, 2 + index));
      const emoji = ['⭐', '🍎', '🎈', '🐟'][index % 4];
      const options = shuffle([total, Math.max(1, total - 1), Math.min(phase.maxValue + 1, total + 1)]).slice(0, 3);
      return { prompt: 'Conte os itens', visual: Array.from({ length: total }, () => emoji).join(' '), correct: total, options };
    });
  }

  if (phase.mode === 'add') {
    return Array.from({ length: phase.questionCount }, (_, index) => {
      const a = 1 + index;
      const b = Math.min(3, 1 + (index % 3));
      const correct = a + b;
      const options = shuffle([correct, correct + 1, Math.max(1, correct - 1)]).slice(0, 3);
      return { prompt: `${a} + ${b} = ?`, visual: `${'⭐ '.repeat(a)} + ${'⭐ '.repeat(b)}`.trim(), correct, options };
    });
  }

  if (phase.mode === 'subtract') {
    return Array.from({ length: phase.questionCount }, (_, index) => {
      const total = Math.min(phase.maxValue, 4 + index);
      const subtract = Math.min(3, 1 + (index % 3));
      const correct = total - subtract;
      const options = shuffle([correct, correct + 1, Math.max(0, correct - 1)]).slice(0, 3);
      return { prompt: `${total} - ${subtract} = ?`, visual: `${'🍎 '.repeat(total)}`.trim(), correct, options };
    });
  }

  return Array.from({ length: phase.questionCount }, (_, index) => {
    const start = 1 + index;
    const correct = start + 3;
    const sequence = [start, start + 1, start + 2, '?'];
    const options = shuffle([correct, correct + 1, Math.max(1, correct - 1)]).slice(0, 3);
    return { prompt: 'Qual número vem depois?', visual: sequence.join(' · '), correct, options };
  });
};

const MathGame = ({ phase, disabledReason, soundEnabled, onStart, onComplete }: PhaseAwareProps<MathPhase>) => {
  const [questions, setQuestions] = useState<MathQuestion[]>(() => buildMathQuestions(phase));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setQuestions(buildMathQuestions(phase));
    setCurrentIndex(0);
    setHits(0);
    setSelectedOption(null);
    setStarted(false);
    setReported(false);
  }, [phase.id]);

  const currentQuestion = questions[currentIndex];

  useEffect(() => {
    if (currentIndex < questions.length || reported) return;
    const stars = hits === questions.length ? 3 : hits >= Math.ceil(questions.length * 0.7) ? 2 : 1;
    playSound('reward', soundEnabled);
    onComplete(stars, hits * 10);
    setReported(true);
  }, [currentIndex, hits, onComplete, questions.length, reported, soundEnabled]);

  const handleAnswer = (option: number) => {
    if (disabledReason || !currentQuestion || selectedOption !== null) return;
    if (!started) {
      setStarted(true);
      onStart();
    }
    setSelectedOption(option);
    const correct = option === currentQuestion.correct;
    if (correct) {
      setHits((value) => value + 1);
      playSound('success', soundEnabled);
    } else {
      playSound('error', soundEnabled);
    }
    window.setTimeout(() => {
      setCurrentIndex((value) => value + 1);
      setSelectedOption(null);
    }, 700);
  };

  return (
    <MiniGameShell
      title={phase.title}
      subtitle={phase.description}
      progress={`${phase.mode} · ${phase.questionCount} perguntas · recompensa ${phase.reward}`}
      disabledReason={disabledReason}
      cta={
        <button
          type="button"
          onClick={() => {
            playSound('tap', soundEnabled);
            setQuestions(buildMathQuestions(phase));
            setCurrentIndex(0);
            setHits(0);
            setSelectedOption(null);
            setStarted(false);
            setReported(false);
          }}
          className="rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"
        >
          Refazer fase
        </button>
      }
    >
      {currentQuestion ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_0.35fr]">
          <div className="rounded-[2rem] bg-indigo-50 p-6">
            <div className="text-center text-lg font-black text-indigo-950">{currentQuestion.prompt}</div>
            <div className="mt-5 rounded-[1.6rem] bg-white px-4 py-8 text-center text-4xl font-black text-indigo-950">{currentQuestion.visual}</div>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {currentQuestion.options.map((option) => {
                const correct = option === currentQuestion.correct;
                const isSelected = selectedOption === option;
                return (
                  <button
                    key={`${currentQuestion.prompt}-${option}`}
                    type="button"
                    onClick={() => handleAnswer(option)}
                    className={cn(
                      'rounded-[1.6rem] px-4 py-5 text-3xl font-black transition',
                      isSelected && correct && 'bg-emerald-500 text-white',
                      isSelected && !correct && 'bg-rose-500 text-white',
                      !isSelected && 'bg-white text-indigo-950 hover:bg-indigo-100'
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-4 rounded-[1.8rem] bg-indigo-50 p-5">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Rodada</div>
              <div className="mt-2 text-lg font-black text-indigo-950">{currentIndex + 1} / {questions.length}</div>
            </div>
            <ProgressBar value={currentIndex} max={questions.length} />
            <div className="rounded-2xl bg-white p-4">
              <div className="text-sm font-bold text-indigo-500">Acertos</div>
              <div className="mt-1 text-3xl font-black text-indigo-950">{hits}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-[2rem] bg-indigo-50 p-8 text-center text-indigo-900">Calculando o resultado da fase...</div>
      )}
    </MiniGameShell>
  );
};

const ShapeGame = ({ phase, disabledReason, soundEnabled, onStart, onComplete }: PhaseAwareProps<ShapePhase>) => {
  const [availableShapes, setAvailableShapes] = useState(() => sample(shapeLibrary.filter((item) => phase.shapeSet === 'basic' ? ['circle', 'square', 'triangle', 'star'].includes(item.id) : true), phase.pieceCount));
  const [selectedShape, setSelectedShape] = useState<ShapeId | null>(null);
  const [matchedShapes, setMatchedShapes] = useState<ShapeId[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [started, setStarted] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setAvailableShapes(sample(shapeLibrary.filter((item) => phase.shapeSet === 'basic' ? ['circle', 'square', 'triangle', 'star'].includes(item.id) : true), phase.pieceCount));
    setSelectedShape(null);
    setMatchedShapes([]);
    setMistakes(0);
    setStarted(false);
    setReported(false);
  }, [phase.id, phase.pieceCount, phase.shapeSet]);

  useEffect(() => {
    if (matchedShapes.length !== availableShapes.length || reported) return;
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    playSound('reward', soundEnabled);
    onComplete(stars, Math.max(1, phase.pieceCount * 10 - mistakes * 2));
    setReported(true);
  }, [availableShapes.length, matchedShapes.length, mistakes, onComplete, phase.pieceCount, reported, soundEnabled]);

  const handleSelectPiece = (shapeId: ShapeId) => {
    if (disabledReason || matchedShapes.includes(shapeId)) return;
    if (!started) {
      setStarted(true);
      onStart();
    }
    playSound('tap', soundEnabled);
    setSelectedShape(shapeId);
  };

  const handleSlotClick = (shapeId: ShapeId) => {
    if (disabledReason || !selectedShape || matchedShapes.includes(shapeId)) return;
    if (selectedShape === shapeId) {
      playSound('success', soundEnabled);
      setMatchedShapes((current) => [...current, shapeId]);
      setSelectedShape(null);
    } else {
      playSound('error', soundEnabled);
      setMistakes((current) => current + 1);
    }
  };

  return (
    <MiniGameShell
      title={phase.title}
      subtitle={phase.description}
      progress={`${phase.pieceCount} peças · conjunto ${phase.shapeSet} · recompensa ${phase.reward}`}
      disabledReason={disabledReason}
      cta={
        <button
          type="button"
          onClick={() => {
            playSound('tap', soundEnabled);
            setAvailableShapes(sample(shapeLibrary.filter((item) => phase.shapeSet === 'basic' ? ['circle', 'square', 'triangle', 'star'].includes(item.id) : true), phase.pieceCount));
            setSelectedShape(null);
            setMatchedShapes([]);
            setMistakes(0);
            setStarted(false);
            setReported(false);
          }}
          className="rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"
        >
          Reorganizar peças
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-3 sm:grid-cols-2">
          {availableShapes.map((shape) => {
            const isDone = matchedShapes.includes(shape.id);
            return (
              <button
                key={`${phase.id}-piece-${shape.id}`}
                type="button"
                onClick={() => handleSelectPiece(shape.id)}
                className={cn(
                  'rounded-[1.6rem] border-2 p-4 transition',
                  isDone ? 'border-emerald-400 bg-emerald-50 opacity-70' : selectedShape === shape.id ? 'border-pink-400 bg-pink-50' : 'border-transparent bg-indigo-50'
                )}
              >
                <div className="flex items-center justify-center"><ShapeBadge shape={shape.id} color={shape.color} size="lg" /></div>
                <div className="mt-3 text-center text-base font-black text-indigo-950">{shape.label}</div>
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {availableShapes.map((shape) => {
            const isDone = matchedShapes.includes(shape.id);
            return (
              <button
                key={`${phase.id}-slot-${shape.id}`}
                type="button"
                onClick={() => handleSlotClick(shape.id)}
                className={cn('rounded-[1.6rem] border-2 border-dashed p-4 transition', isDone ? 'border-emerald-400 bg-emerald-50' : 'border-indigo-200 bg-white hover:border-pink-300')}
              >
                <div className="flex h-24 items-center justify-center rounded-[1.2rem] bg-slate-50">
                  {isDone ? <ShapeBadge shape={shape.id} color={shape.color} size="lg" /> : <span className="text-sm font-bold text-indigo-400">Toque aqui</span>}
                </div>
                <div className="mt-3 text-center text-sm font-black text-indigo-950">Silhueta: {shape.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </MiniGameShell>
  );
};

const ColorsGame = ({ phase, disabledReason, soundEnabled, onStart, onComplete }: PhaseAwareProps<ColorsPhase>) => {
  const [selectedItems, setSelectedItems] = useState(() => sample(colorItems.filter((_, index) => index < phase.bucketCount * 2), phase.itemCount));
  const [itemIndex, setItemIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [started, setStarted] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    const allowedBuckets = colorBuckets.slice(0, phase.bucketCount).map((bucket) => bucket.id);
    setSelectedItems(sample(colorItems.filter((item) => allowedBuckets.includes(item.color)), Math.min(phase.itemCount, colorItems.filter((item) => allowedBuckets.includes(item.color)).length)));
    setItemIndex(0);
    setMistakes(0);
    setStarted(false);
    setReported(false);
  }, [phase.bucketCount, phase.id, phase.itemCount]);

  useEffect(() => {
    if (itemIndex < selectedItems.length || reported) return;
    const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
    playSound('reward', soundEnabled);
    onComplete(stars, Math.max(1, selectedItems.length * 8 - mistakes * 2));
    setReported(true);
  }, [itemIndex, mistakes, onComplete, reported, selectedItems.length, soundEnabled]);

  const currentItem = selectedItems[itemIndex] ?? null;
  const availableBuckets = colorBuckets.slice(0, phase.bucketCount);

  const handleBucket = (bucketId: ColorBucketId) => {
    if (disabledReason || !currentItem) return;
    if (!started) {
      setStarted(true);
      onStart();
    }
    if (bucketId === currentItem.color) {
      playSound('success', soundEnabled);
      setItemIndex((value) => value + 1);
    } else {
      playSound('error', soundEnabled);
      setMistakes((value) => value + 1);
    }
  };

  return (
    <MiniGameShell
      title={phase.title}
      subtitle={phase.description}
      progress={`${phase.bucketCount} cestos · ${selectedItems.length} itens · recompensa ${phase.reward}`}
      disabledReason={disabledReason}
      cta={
        <button
          type="button"
          onClick={() => {
            playSound('tap', soundEnabled);
            const allowedBuckets = colorBuckets.slice(0, phase.bucketCount).map((bucket) => bucket.id);
            setSelectedItems(sample(colorItems.filter((item) => allowedBuckets.includes(item.color)), Math.min(phase.itemCount, colorItems.filter((item) => allowedBuckets.includes(item.color)).length)));
            setItemIndex(0);
            setMistakes(0);
            setStarted(false);
            setReported(false);
          }}
          className="rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"
        >
          Trocar rodada
        </button>
      }
    >
      {currentItem ? (
        <div className="grid gap-6 lg:grid-cols-[0.6fr_1.4fr]">
          <div className="rounded-[2rem] bg-indigo-50 p-6 text-center">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Objeto atual</div>
            <div className="mt-4 text-7xl">{currentItem.emoji}</div>
            <div className="mt-3 text-lg font-black text-indigo-950">{currentItem.label}</div>
            <div className="mt-4 text-sm text-indigo-700">Escolha o cesto da mesma cor</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {availableBuckets.map((bucket) => (
              <button
                key={bucket.id}
                type="button"
                onClick={() => handleBucket(bucket.id)}
                className={cn('rounded-[1.8rem] p-6 text-center shadow-sm transition hover:scale-[1.01]', bucket.colorClass)}
              >
                <div className="text-4xl">🧺</div>
                <div className="mt-3 text-xl font-black">{bucket.label}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-[2rem] bg-indigo-50 p-8 text-center text-indigo-900">Fechando a rodada e liberando estrelas...</div>
      )}
    </MiniGameShell>
  );
};

const parseMaze = (grid: string[]) => {
  let start = { row: 0, col: 0 };
  let goal = { row: 0, col: 0 };
  const cells = grid.map((row, rowIndex) => row.split('').map((cell, colIndex) => {
    if (cell === 'S') start = { row: rowIndex, col: colIndex };
    if (cell === 'T') goal = { row: rowIndex, col: colIndex };
    return cell;
  }));
  return { cells, start, goal };
};

const MazeGame = ({ phase, disabledReason, soundEnabled, onStart, onComplete }: PhaseAwareProps<MazePhase>) => {
  const parsed = useMemo(() => parseMaze(phase.grid), [phase.grid]);
  const [position, setPosition] = useState(parsed.start);
  const [steps, setSteps] = useState(0);
  const [bumps, setBumps] = useState(0);
  const [started, setStarted] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setPosition(parsed.start);
    setSteps(0);
    setBumps(0);
    setStarted(false);
    setReported(false);
  }, [parsed.start, phase.id]);

  useEffect(() => {
    if (reported) return;
    if (position.row === parsed.goal.row && position.col === parsed.goal.col) {
      const stars = bumps === 0 && steps <= phase.idealSteps + 1 ? 3 : bumps <= 2 && steps <= phase.idealSteps + 4 ? 2 : 1;
      playSound('reward', soundEnabled);
      onComplete(stars, Math.max(1, phase.idealSteps * 10 - steps * 2 - bumps * 3));
      setReported(true);
    }
  }, [bumps, onComplete, parsed.goal.col, parsed.goal.row, phase.idealSteps, position.col, position.row, reported, soundEnabled, steps]);

  const move = (nextRow: number, nextCol: number) => {
    if (disabledReason) return;
    if (!started) {
      setStarted(true);
      onStart();
    }
    const cell = parsed.cells[nextRow]?.[nextCol];
    if (!cell || cell === '#') {
      playSound('error', soundEnabled);
      setBumps((value) => value + 1);
      return;
    }
    playSound('tap', soundEnabled);
    setPosition({ row: nextRow, col: nextCol });
    setSteps((value) => value + 1);
  };

  const controls = [
    { label: '↑', onClick: () => move(position.row - 1, position.col) },
    { label: '←', onClick: () => move(position.row, position.col - 1) },
    { label: '↓', onClick: () => move(position.row + 1, position.col) },
    { label: '→', onClick: () => move(position.row, position.col + 1) },
  ];

  return (
    <MiniGameShell
      title={phase.title}
      subtitle={phase.description}
      progress={`Labirinto · ideal ${phase.idealSteps} passos · recompensa ${phase.reward}`}
      disabledReason={disabledReason}
      cta={
        <button
          type="button"
          onClick={() => {
            playSound('tap', soundEnabled);
            setPosition(parsed.start);
            setSteps(0);
            setBumps(0);
            setStarted(false);
            setReported(false);
          }}
          className="rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"
        >
          Reiniciar fase
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.38fr]">
        <div className="grid gap-2 rounded-[2rem] bg-indigo-50 p-5" style={{ gridTemplateColumns: `repeat(${phase.grid[0].length}, minmax(0, 1fr))` }}>
          {parsed.cells.flatMap((row, rowIndex) => row.map((cell, colIndex) => {
            const isPlayer = position.row === rowIndex && position.col === colIndex;
            const isGoal = parsed.goal.row === rowIndex && parsed.goal.col === colIndex;
            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={cn(
                  'flex aspect-square items-center justify-center rounded-xl text-xl font-black',
                  cell === '#' && 'bg-indigo-950 text-transparent',
                  cell !== '#' && 'bg-white text-indigo-950',
                  isGoal && 'bg-yellow-100 text-yellow-600'
                )}
              >
                {isPlayer ? '😀' : isGoal ? '🎁' : cell === '#' ? '■' : ''}
              </div>
            );
          }))}
        </div>
        <div className="space-y-4 rounded-[1.8rem] bg-indigo-50 p-5">
          <div className="rounded-2xl bg-white p-4">
            <div className="text-sm font-bold text-indigo-500">Passos</div>
            <div className="mt-1 text-3xl font-black text-indigo-950">{steps}</div>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <div className="text-sm font-bold text-indigo-500">Batidas na parede</div>
            <div className="mt-1 text-3xl font-black text-indigo-950">{bumps}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div />
            <button type="button" onClick={controls[0].onClick} className="rounded-2xl bg-white px-4 py-4 text-2xl font-black text-indigo-950">{controls[0].label}</button>
            <div />
            <button type="button" onClick={controls[1].onClick} className="rounded-2xl bg-white px-4 py-4 text-2xl font-black text-indigo-950">{controls[1].label}</button>
            <button type="button" onClick={controls[2].onClick} className="rounded-2xl bg-white px-4 py-4 text-2xl font-black text-indigo-950">{controls[2].label}</button>
            <button type="button" onClick={controls[3].onClick} className="rounded-2xl bg-white px-4 py-4 text-2xl font-black text-indigo-950">{controls[3].label}</button>
          </div>
        </div>
      </div>
    </MiniGameShell>
  );
};

const scrambleTiles = (length: number) => {
  let order = Array.from({ length }, (_, index) => index);
  do {
    order = shuffle(order);
  } while (order.every((item, index) => item === index));
  return order;
};

const PuzzleGame = ({ phase, disabledReason, soundEnabled, onStart, onComplete }: PhaseAwareProps<PuzzlePhase>) => {
  const [tileOrder, setTileOrder] = useState<number[]>(() => scrambleTiles(phase.scene.tiles.length));
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [started, setStarted] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setTileOrder(scrambleTiles(phase.scene.tiles.length));
    setSelectedIndex(null);
    setMoves(0);
    setStarted(false);
    setReported(false);
  }, [phase.id, phase.scene.tiles.length]);

  const solved = tileOrder.every((value, index) => value === index);
  const cols = phase.scene.tiles.length <= 4 ? 2 : 3;
  const starsTarget3 = phase.scene.tiles.length <= 4 ? 4 : 8;
  const starsTarget2 = phase.scene.tiles.length <= 4 ? 7 : 12;

  useEffect(() => {
    if (!solved || reported) return;
    const stars = moves <= starsTarget3 ? 3 : moves <= starsTarget2 ? 2 : 1;
    playSound('reward', soundEnabled);
    onComplete(stars, Math.max(1, phase.scene.tiles.length * 10 - moves * 2));
    setReported(true);
  }, [moves, onComplete, phase.scene.tiles.length, reported, solved, soundEnabled, starsTarget2, starsTarget3]);

  const handleTileClick = (index: number) => {
    if (disabledReason) return;
    if (!started) {
      setStarted(true);
      onStart();
    }
    if (selectedIndex === null) {
      playSound('tap', soundEnabled);
      setSelectedIndex(index);
      return;
    }
    if (selectedIndex === index) {
      setSelectedIndex(null);
      return;
    }
    playSound('tap', soundEnabled);
    setTileOrder((current) => {
      const next = [...current];
      [next[selectedIndex], next[index]] = [next[index], next[selectedIndex]];
      return next;
    });
    setSelectedIndex(null);
    setMoves((value) => value + 1);
  };

  return (
    <MiniGameShell
      title={phase.title}
      subtitle={phase.description}
      progress={`${phase.scene.title} · ${phase.scene.tiles.length} peças · recompensa ${phase.reward}`}
      disabledReason={disabledReason}
      cta={
        <button
          type="button"
          onClick={() => {
            playSound('tap', soundEnabled);
            setTileOrder(scrambleTiles(phase.scene.tiles.length));
            setSelectedIndex(null);
            setMoves(0);
            setStarted(false);
            setReported(false);
          }}
          className="rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"
        >
          Nova montagem
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.34fr]">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {tileOrder.map((tileId, index) => {
            const tile = phase.scene.tiles[tileId];
            return (
              <button
                key={`${phase.id}-tile-${index}`}
                type="button"
                onClick={() => handleTileClick(index)}
                className={cn('aspect-square rounded-[1.5rem] bg-indigo-50 p-4 text-center transition', selectedIndex === index && 'ring-4 ring-pink-300')}
              >
                <div className="mt-2 text-5xl">{tile.emoji}</div>
                <div className="mt-3 text-sm font-black text-indigo-950">{tile.label}</div>
              </button>
            );
          })}
        </div>
        <div className="space-y-4 rounded-[1.8rem] bg-indigo-50 p-5">
          <div className="rounded-2xl bg-white p-4">
            <div className="text-sm font-bold text-indigo-500">Movimentos</div>
            <div className="mt-1 text-3xl font-black text-indigo-950">{moves}</div>
          </div>
          <div className="rounded-2xl bg-white p-4 text-sm text-indigo-800">
            Toque em uma peça, depois toque em outra para trocar de lugar.
          </div>
        </div>
      </div>
    </MiniGameShell>
  );
};

const TopNavbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 16);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#metodo', label: 'Método' },
    { href: '#mapa', label: 'Mapa' },
    { href: '#minijogos', label: 'Jogar' },
    { href: '#seguranca', label: 'Pais' },
  ];

  return (
    <nav className={cn('fixed inset-x-0 top-0 z-50 px-4 py-3 transition-all duration-300', isScrolled ? 'bg-white/78 shadow-[0_20px_50px_rgba(15,23,42,0.10)] backdrop-blur-xl' : 'bg-transparent')}>
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-full border border-white/50 bg-white/70 px-4 py-3 shadow-[0_10px_34px_rgba(99,102,241,0.10)] backdrop-blur-xl">
        <a href="#topo" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-[linear-gradient(135deg,#facc15_0%,#fb7185_45%,#818cf8_100%)] text-white shadow-[0_14px_30px_rgba(244,114,182,0.24)]"><WandSparkles className="h-6 w-6" /></div>
          <div>
            <div className="text-lg font-black text-slate-950">Escola Divertida</div>
            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-500">V16 integração operacional</div>
          </div>
        </a>
        <div className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => <a key={link.href} href={link.href} className="text-sm font-bold text-slate-800 transition hover:text-pink-500">{link.label}</a>)}
          <a href="#minijogos" className="rounded-full bg-[linear-gradient(135deg,#4f46e5_0%,#7c3aed_52%,#ec4899_100%)] px-5 py-3 text-sm font-black text-white shadow-[0_20px_44px_rgba(99,102,241,0.25)]">Abrir app</a>
        </div>
        <button type="button" onClick={() => setMobileMenuOpen((v) => !v)} className="rounded-2xl bg-white/85 p-3 shadow-sm ring-1 ring-white/80 md:hidden">
          {mobileMenuOpen ? <X className="h-5 w-5 text-slate-950" /> : <Menu className="h-5 w-5 text-slate-950" />}
        </button>
      </div>
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mx-auto mt-3 max-w-7xl rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur-xl md:hidden">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => <a key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className="text-base font-bold text-slate-950">{link.label}</a>)}
              <a href="#minijogos" onClick={() => setMobileMenuOpen(false)} className="rounded-full bg-[linear-gradient(135deg,#4f46e5_0%,#7c3aed_52%,#ec4899_100%)] px-5 py-3 text-center text-sm font-black text-white">Abrir app</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => (
  <section id="topo" className="relative overflow-hidden px-4 pb-20 pt-30 md:pt-36">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.96),_rgba(224,242,254,0.84)_28%,_rgba(238,242,255,0.86)_58%,_rgba(253,242,248,0.84)_100%)]" />
    <div className="absolute left-[-120px] top-16 h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.35),_transparent_70%)]" />
    <div className="absolute right-[-80px] top-12 h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,_rgba(129,140,248,0.24),_transparent_72%)]" />
    <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
      <div>
        <div className="mb-5 inline-flex flex-wrap items-center gap-2 rounded-full border border-white/70 bg-white/85 px-4 py-2 text-sm font-bold text-indigo-700 shadow-[0_10px_30px_rgba(79,70,229,0.10)] backdrop-blur-xl">
          <Sparkles className="h-4 w-4 text-pink-500" />
          Redesign visual premium com base no alvo de alta fidelidade
        </div>
        <h1 className="max-w-3xl text-4xl font-black leading-[0.98] text-slate-950 md:text-6xl">
          Uma versão <span className="bg-[linear-gradient(135deg,#4f46e5_0%,#7c3aed_40%,#ec4899_78%,#f59e0b_100%)] bg-clip-text text-transparent">muito mais bonita, encantadora e confiável</span> para crianças e pais.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-700 md:text-xl">
          O front-end foi redesenhado para se aproximar do visual-alvo premium: mapa infantil mais mágico, cards mais ricos, recompensas mais desejáveis e uma linguagem visual mais forte sem perder a funcionalidade real do app.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <a href="#minijogos" className="inline-flex items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#4f46e5_0%,#7c3aed_52%,#ec4899_100%)] px-7 py-4 text-base font-black text-white shadow-[0_22px_54px_rgba(99,102,241,0.28)] transition hover:-translate-y-0.5">
            Abrir versão redesenhada
            <ArrowRight className="h-5 w-5" />
          </a>
          <a href="#mapa" className="inline-flex items-center justify-center gap-3 rounded-full border border-white/70 bg-white/85 px-7 py-4 text-base font-black text-slate-950 shadow-sm backdrop-blur-xl">
            Ver mapa premium
          </a>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {['7 mundos temáticos', '84 fases jogáveis', 'Missões e eventos', 'Pais no controle'].map((stat, index) => (
            <div key={stat} className="rounded-[1.7rem] border border-white/70 bg-white/82 p-4 shadow-[0_14px_34px_rgba(79,70,229,0.10)] backdrop-blur-xl">
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-indigo-500">Destaque {index + 1}</div>
              <div className="mt-2 text-base font-black text-slate-950">{stat}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="relative">
        <div className="absolute -left-4 -top-4 hidden rounded-[1.6rem] bg-white/88 px-4 py-3 text-sm font-black text-indigo-700 shadow-[0_14px_34px_rgba(79,70,229,0.12)] backdrop-blur-xl lg:block">⭐ 1.850 estrelas</div>
        <div className="absolute -right-4 bottom-10 hidden rounded-[1.6rem] bg-white/88 px-4 py-3 text-sm font-black text-pink-600 shadow-[0_14px_34px_rgba(244,114,182,0.18)] backdrop-blur-xl lg:block">🎁 3 recompensas prontas</div>
        <div className="overflow-hidden rounded-[2.8rem] border border-white/80 bg-white/80 p-5 shadow-[0_40px_120px_rgba(79,70,229,0.16)] backdrop-blur-xl">
          <div className="overflow-hidden rounded-[2.2rem] bg-[linear-gradient(180deg,#2563eb_0%,#5b5ff0_26%,#7c3aed_58%,#fb7185_100%)] p-5 text-white">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.24em] text-white/70">Preview premium</div>
                <div className="mt-2 text-2xl font-black">Mapa de Progressão</div>
              </div>
              <div className="rounded-full bg-white/18 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/90">V16</div>
            </div>
            <div className="mt-5 rounded-[2rem] bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1rem] bg-white/20 text-2xl">⭐</div>
                  <div>
                    <div className="text-sm font-black">Estelinha</div>
                    <div className="text-xs font-semibold text-white/75">guia da aventura</div>
                  </div>
                </div>
                <div className="rounded-full bg-white/12 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white/80">Pedro · 6 anos</div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {worlds.slice(0, 4).map((world, index) => {
                  const Icon = world.icon;
                  return (
                    <div key={world.game} className="rounded-[1.5rem] bg-white/14 p-4 backdrop-blur-sm ring-1 ring-white/10">
                      <div className={cn('inline-flex rounded-[1rem] bg-gradient-to-br p-3 text-indigo-950 shadow-lg', world.colorClass)}><Icon className="h-5 w-5" /></div>
                      <div className="mt-3 text-sm font-black">{world.shortTitle}</div>
                      <div className="mt-1 text-xs text-white/75">{index + 1}ª trilha ativa</div>
                      <div className="mt-3 flex gap-1 text-yellow-300">{Array.from({ length: 3 }, (_, starIndex) => <Star key={`${world.game}-hero-${starIndex}`} className={cn('h-3.5 w-3.5', starIndex < (index % 2 === 0 ? 2 : 3) ? 'fill-current' : 'text-white/35')} />)}</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[1.5rem] bg-white/14 p-4 ring-1 ring-white/10">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-white/70">Missões do dia</div>
                  <div className="mt-3 space-y-2 text-sm font-semibold text-white/90">
                    <div className="flex items-center justify-between rounded-full bg-white/10 px-3 py-2"><span>Jogar 2 fases</span><span>20⭐</span></div>
                    <div className="flex items-center justify-between rounded-full bg-white/10 px-3 py-2"><span>Acertar 5 cores</span><span>15⭐</span></div>
                    <div className="flex items-center justify-between rounded-full bg-white/10 px-3 py-2"><span>Completar o labirinto</span><span>25⭐</span></div>
                  </div>
                </div>
                <div className="rounded-[1.5rem] bg-white/14 p-4 ring-1 ring-white/10">
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-white/70">Evento da temporada</div>
                  <div className="mt-3 text-4xl">🍂</div>
                  <div className="mt-2 text-sm font-black">Outono encantado</div>
                  <div className="mt-2 text-xs text-white/75">Colete folhas e abra o cofre especial.</div>
                  <div className="mt-4 rounded-full bg-white/12 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.18em] text-yellow-200">Abrir evento</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const HighlightStrip = () => (
  <section className="overflow-hidden px-4 py-5">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 rounded-[2rem] border border-white/70 bg-white/76 px-4 py-4 shadow-[0_14px_34px_rgba(79,70,229,0.10)] backdrop-blur-xl md:gap-4">
      {['Mapa encantado', 'Missões e cofres', 'Visual premium', 'Pais no controle', 'Minijogos reais', 'Pronto para evoluir'].map((item) => (
        <span key={item} className="rounded-full border border-white/70 bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_100%)] px-4 py-2 text-sm font-black text-slate-800 shadow-sm">{item}</span>
      ))}
    </div>
  </section>
);

const MethodSection = () => (
  <section id="metodo" className="px-4 py-24">
    <div className="mx-auto max-w-7xl rounded-[3rem] border border-white/70 bg-white/68 p-8 shadow-[0_34px_120px_rgba(79,70,229,0.10)] backdrop-blur-xl md:p-10">
      <SectionTitle badge="Método premium" title="Redesenho visual completo com foco em encantamento infantil e confiança dos pais" text="A experiência foi reorquestrada para ficar mais próxima do alvo premium: hierarquia visual melhor, botões mais táteis, cards mais ricos, progressão mais clara e um clima de produto comercial mais forte sem sacrificar a base jogável do app." />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {methodologyCards.map((card, index) => (
          <FeatureCard key={card.title} icon={[Brain, Sparkles, Volume2, Cloud][index]} title={card.title} desc={card.desc} color={['bg-[linear-gradient(135deg,#4f46e5,#7c3aed)]', 'bg-[linear-gradient(135deg,#ec4899,#fb7185)]', 'bg-[linear-gradient(135deg,#f59e0b,#fbbf24)]', 'bg-[linear-gradient(135deg,#10b981,#22d3ee)]'][index]} />
        ))}
      </div>
    </div>
  </section>
);

const WorldsCatalog = () => (
  <section id="mapa" className="px-4 py-24">
    <div className="mx-auto max-w-7xl">
      <SectionTitle badge="Mapa premium" title="Sete mundos com cara de aventura real, progresso visível e identidade própria" text="Cada trilha foi reposicionada como um mundo mais desejável visualmente. O objetivo deste redesign é que a criança queira explorar e que os pais percebam rapidamente ordem, progressão e valor pedagógico." />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {worlds.map((world, index) => {
          const Icon = world.icon;
          const phaseCount = worldPhaseOrder[world.game].length;
          return (
            <div key={world.game} className="group relative overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/86 p-6 shadow-[0_22px_60px_rgba(79,70,229,0.10)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(79,70,229,0.14)]">
              <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[radial-gradient(circle_at_center,_rgba(251,191,36,0.22),_transparent_70%)]" />
              <div className={cn('inline-flex rounded-[1.25rem] bg-gradient-to-br p-4 text-indigo-950 shadow-[0_16px_34px_rgba(99,102,241,0.16)]', world.colorClass)}><Icon className="h-7 w-7" /></div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-950">{world.title}</h3>
                  <div className="mt-1 text-sm font-semibold text-indigo-500">Trilha {index + 1}</div>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-700 ring-1 ring-white">{world.age}</span>
              </div>
              <p className="mt-3 text-slate-700">{world.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {worldPhaseOrder[world.game].slice(0, 6).map((phaseId, phaseIndex) => (
                  <span key={phaseId} className={cn('rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.14em]', phaseIndex < 3 ? 'bg-amber-100 text-amber-900' : 'bg-indigo-50 text-indigo-900')}>
                    Fase {phaseIndex + 1}
                  </span>
                ))}
                {phaseCount > 6 && <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-slate-700">+{phaseCount - 6} fases</span>}
              </div>
              <div className="mt-5 flex items-center justify-between gap-3 rounded-[1.4rem] bg-[linear-gradient(135deg,#eef2ff_0%,#ffffff_100%)] p-4 ring-1 ring-white/80">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Conteúdo disponível</div>
                  <div className="mt-1 text-lg font-black text-slate-950">{phaseCount} fases prontas</div>
                </div>
                <div className="flex gap-1 text-yellow-400">{Array.from({ length: 3 }, (_, starIndex) => <Star key={`${world.game}-catalog-${starIndex}`} className={cn('h-4 w-4', starIndex < (index % 3) + 1 ? 'fill-current' : 'text-slate-200')} />)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

const MiniGamesSection = () => {
  const [profiles, setProfiles] = useState<ChildProfile[]>(() => normalizeProfiles(safeReadStorage<ChildProfile[]>(LOCAL_KEYS.profiles, [])));
  const [activeProfileId, setActiveProfileId] = useState<string>(() => safeReadStorage<string>(LOCAL_KEYS.activeProfileId, ''));
  const [progressMap, setProgressMap] = useState<Record<string, ProfileProgress>>(() => {
    const stored = safeReadStorage<Record<string, Partial<ProfileProgress>>>(LOCAL_KEYS.progress, {});
    return Object.fromEntries(Object.entries(stored).map(([profileId, progress]) => [profileId, normalizeStoredProgress(progress)]));
  });
  const [parentSettings, setParentSettings] = useState<ParentSettings>(() => safeReadStorage<ParentSettings>(LOCAL_KEYS.parentSettings, defaultParentSettings));
  const [dailyUsage, setDailyUsage] = useState<DailyUsage>(() => normalizeUsage(safeReadStorage<DailyUsage>(LOCAL_KEYS.dailyUsage, { date: getTodayKey(), usageByProfile: {} })));
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState(5);
  const [newChildAvatar, setNewChildAvatar] = useState(getDefaultAvatar(0));
  const [newChildBuddy, setNewChildBuddy] = useState(getDefaultBuddy(0));
  const [newChildMascotTheme, setNewChildMascotTheme] = useState(getDefaultMascotTheme(0));
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>(() => safeReadStorage<string>(LOCAL_KEYS.selectedPhase, worldPhaseOrder.memory[0]));
  const [selectedPackId, setSelectedPackId] = useState<string>(fallbackContentPacks[0]?.id ?? '');
  const [sessionLive, setSessionLive] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionHistory>(() => normalizeSessionHistory(safeReadStorage<SessionHistory>(LOCAL_KEYS.sessionHistory, {})));
  const [dailyMissionMap, setDailyMissionMap] = useState<Record<string, DailyMissionState>>(() => safeReadStorage<Record<string, DailyMissionState>>(LOCAL_KEYS.dailyMissions, {}));
  const [onboardingSeen, setOnboardingSeen] = useState<Record<string, boolean>>(() => safeReadStorage<Record<string, boolean>>(LOCAL_KEYS.onboardingSeen, {}));
  const [seasonClaims, setSeasonClaims] = useState<SeasonClaimMap>(() => safeReadStorage<SeasonClaimMap>(LOCAL_KEYS.seasonClaims, {}));
  const [varietyBonusClaims, setVarietyBonusClaims] = useState<Record<string, string>>(() => normalizeVarietyBonusClaims(safeReadStorage<Record<string, string>>(LOCAL_KEYS.varietyBonusClaims, {})));
  const [celebration, setCelebration] = useState<CelebrationState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [parentGate, setParentGate] = useState<ParentGateState | null>(null);
  const [pauseCardDismissed, setPauseCardDismissed] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<SyncStatus>('idle');
  const [cloudMessage, setCloudMessage] = useState('Modo local ativo');
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<SyncStatus>('idle');
  const [catalogMessage, setCatalogMessage] = useState('Catálogo local ativo');
  const [catalogUpdatedAt, setCatalogUpdatedAt] = useState<string | null>(null);
  const [catalogSource, setCatalogSource] = useState<CatalogSource>('local');
  const [lastPublicationSummary, setLastPublicationSummary] = useState<{ publishedAt: string | null; manifestVersion: number | null; counts: { packs: number; events: number; tracks: number } | null } | null>(null);
  const [catalogManifestVersion, setCatalogManifestVersion] = useState<number>(dynamicContentBlueprint.version);
  const [dynamicPacks, setDynamicPacks] = useState<ContentPack[]>(fallbackContentPacks);
  const [dynamicEvents, setDynamicEvents] = useState<SeasonalEvent[]>(fallbackSeasonalEvents);
  const [dynamicWeeklyTracks, setDynamicWeeklyTracks] = useState<ParentWeeklyTrack[]>(fallbackParentWeeklyTracks);
  const [contentStudioOpen, setContentStudioOpen] = useState(false);
  const [catalogDraft, setCatalogDraft] = useState({ packs: '', events: '', tracks: '' });
  const [adminToken, setAdminToken] = useState('');
  const [adminStatus, setAdminStatus] = useState<SyncStatus>('idle');
  const [adminMessage, setAdminMessage] = useState('Painel local pronto');
  const [infraStatus, setInfraStatus] = useState<SyncStatus>('idle');
  const [infraMessage, setInfraMessage] = useState('Infraestrutura ainda não verificada');
  const [infraSnapshot, setInfraSnapshot] = useState<InfrastructureHealthPayload | null>(null);
  const deviceId = useMemo(() => getOrCreateDeviceId(LOCAL_KEYS.deviceId), []);
  const initialCloudHandled = useRef(false);
  const catalogImportRef = useRef<HTMLInputElement | null>(null);

  const resolvedPacks = dynamicPacks.length ? dynamicPacks : fallbackContentPacks;
  const resolvedEvents = dynamicEvents.length ? dynamicEvents : fallbackSeasonalEvents;
  const resolvedWeeklyTracks = dynamicWeeklyTracks.length ? dynamicWeeklyTracks : fallbackParentWeeklyTracks;

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? null;
  const activeProgress = activeProfile ? progressMap[activeProfile.id] ?? createEmptyProfileProgress() : null;
  const usageTodaySeconds = activeProfile ? normalizeUsage(dailyUsage).usageByProfile[activeProfile.id] ?? 0 : 0;
  const limitReached = activeProfile ? usageTodaySeconds >= parentSettings.dailyLimitMinutes * 60 : false;
  const audioEnabled = parentSettings.audioEnabled;
  const narrationEnabled = parentSettings.narrationEnabled;
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const selectedPhase = phaseMap[selectedPhaseId] ?? phaseMap[worldPhaseOrder.memory[0]];
  const selectedGame = selectedPhase.game;
  const mascotMessage = getMascotMessage(activeProfile, selectedPhaseId);
  const recommendedPhaseId = getRecommendedPhaseId(activeProgress);
  const recommendedPackId = getRecommendedPackIdForAge(activeProfile?.age ?? 5, resolvedPacks);
  const selectedPack = resolvedPacks.find((pack) => pack.id === selectedPackId) ?? resolvedPacks[0];
  const selectedPackSummary = getPackProgressSummary(selectedPack.phaseIds, activeProgress);
  const selectedPackWorlds = getPackWorlds(selectedPack.phaseIds);
  const varietyInsight = getVarietyInsight(activeProgress);
  const varietyBonusKey = `${getTodayKey()}:${varietyInsight.world.game}`;
  const varietyBonusReady = Boolean(activeProfile && varietyBonusClaims[activeProfile.id] !== varietyBonusKey);
  const experienceSummary = buildExperienceSummary(activeProfile, activeProgress, sessionHistory);
  const recentDays = activeProfile ? getRecentDays(sessionHistory, activeProfile.id, 7) : [];
  const activeDailyMissionState = activeProfile ? normalizeDailyMissionState(dailyMissionMap[activeProfile.id], activeProgress) : buildDailyMissionState(activeProgress);
  const dailyMissions = activeDailyMissionState.missions;
  const missionsClaimed = dailyMissions.filter((mission) => mission.claimed).length;
  const readyMissionRewards = dailyMissions.filter((mission) => mission.completed && !mission.claimed).reduce((total, mission) => total + mission.rewardStars, 0);
  const onboardingOpen = Boolean(activeProfile && !onboardingSeen[activeProfile.id]);
  const vaultItems = buildVaultItems(activeProgress, experienceSummary.streak);
  const mascotCards = buildMascotCards(activeProfile, activeProgress, recommendedPhaseId);
  const activeWeeklyTrack = buildWeeklyParentTrack(activeProfile, activeProgress, resolvedWeeklyTracks);
  const worldMedals = worlds.map((world) => ({ world, ...getWorldMedal(activeProgress, world.game), progress: getPackProgressSummary(worldPhaseOrder[world.game], activeProgress) }));
  const profileSeasonClaims = activeProfile ? (seasonClaims[activeProfile.id] ?? []) : [];
  const nextRewardMilestone = rewardMilestones.find((item) => item.threshold > (activeProgress?.totalStars ?? 0)) ?? null;
  const breakReminderReached = Boolean(activeProfile && parentSettings.breakReminderMinutes > 0 && usageTodaySeconds > 0 && usageTodaySeconds % (parentSettings.breakReminderMinutes * 60) === 0);
  const nextGoals = getCurrentGoals(activeProgress, recommendedPhaseId, recommendedPackId, resolvedPacks);
  const worldPassport = getWorldPassportSummary(activeProgress);
  const nextPackPhaseId = selectedPack.phaseIds.find((phaseId) => {
    const state = getPhaseStatus(activeProgress, getGameForPhase(phaseId), phaseId);
    return state.unlocked && state.completions === 0;
  }) ?? selectedPack.phaseIds.find((phaseId) => getPhaseStatus(activeProgress, getGameForPhase(phaseId), phaseId).unlocked) ?? selectedPack.phaseIds[0];

  useEffect(() => { writeStorage(LOCAL_KEYS.profiles, profiles); }, [profiles]);
  useEffect(() => { writeStorage(LOCAL_KEYS.activeProfileId, activeProfileId); }, [activeProfileId]);
  useEffect(() => { writeStorage(LOCAL_KEYS.progress, progressMap); }, [progressMap]);
  useEffect(() => { writeStorage(LOCAL_KEYS.parentSettings, parentSettings); }, [parentSettings]);
  useEffect(() => { writeStorage(LOCAL_KEYS.dailyUsage, dailyUsage); }, [dailyUsage]);
  useEffect(() => { writeStorage(LOCAL_KEYS.selectedPhase, selectedPhaseId); }, [selectedPhaseId]);
  useEffect(() => { writeStorage(LOCAL_KEYS.sessionHistory, sessionHistory); }, [sessionHistory]);
  useEffect(() => { writeStorage(LOCAL_KEYS.dailyMissions, dailyMissionMap); }, [dailyMissionMap]);
  useEffect(() => { writeStorage(LOCAL_KEYS.onboardingSeen, onboardingSeen); }, [onboardingSeen]);
  useEffect(() => { writeStorage(LOCAL_KEYS.seasonClaims, seasonClaims); }, [seasonClaims]);
  useEffect(() => { writeStorage(LOCAL_KEYS.varietyBonusClaims, varietyBonusClaims); }, [varietyBonusClaims]);

  useEffect(() => {
    if (!profiles.length) {
      setActiveProfileId('');
      return;
    }
    if (!profiles.some((profile) => profile.id === activeProfileId)) {
      setActiveProfileId(profiles[0].id);
    }
  }, [activeProfileId, profiles]);

  useEffect(() => {
    if (!resolvedPacks.length) return;
    if (!resolvedPacks.some((pack) => pack.id === selectedPackId)) {
      setSelectedPackId(resolvedPacks[0].id);
    }
  }, [resolvedPacks, selectedPackId]);

  useEffect(() => {
    if (!activeProfile) return;
    setDailyMissionMap((current) => {
      const existing = current[activeProfile.id];
      if (existing && existing.date === getTodayKey()) return current;
      return { ...current, [activeProfile.id]: buildDailyMissionState(activeProgress) };
    });
  }, [activeProfile, activeProgress]);

  useEffect(() => {
    if (!activeProfile || limitReached || !sessionLive) return undefined;
    const intervalId = window.setInterval(() => {
      setDailyUsage((current) => {
        const normalized = normalizeUsage(current);
        return {
          date: normalized.date,
          usageByProfile: {
            ...normalized.usageByProfile,
            [activeProfile.id]: (normalized.usageByProfile[activeProfile.id] ?? 0) + 1,
          },
        };
      });
      setProgressMap((current) => {
        const existing = current[activeProfile.id] ?? createEmptyProfileProgress();
        return {
          ...current,
          [activeProfile.id]: {
            ...existing,
            totalPlayTimeSeconds: existing.totalPlayTimeSeconds + 1,
          },
        };
      });
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [activeProfile, limitReached, sessionLive]);

  useEffect(() => { if (limitReached) setSessionLive(false); }, [limitReached]);
  useEffect(() => { if (!breakReminderReached) setPauseCardDismissed(false); }, [breakReminderReached]);
  useEffect(() => () => stopSpeaking(), []);

  useEffect(() => {
    if (!activeProfile || !audioEnabled || !narrationEnabled || !speechSupported || limitReached) return;
    const timeoutId = window.setTimeout(() => speakText(mascotMessage), 260);
    return () => window.clearTimeout(timeoutId);
  }, [activeProfile, audioEnabled, narrationEnabled, speechSupported, mascotMessage, limitReached, selectedPhaseId]);

  useEffect(() => {
    if (!cloudSyncEnabled() || initialCloudHandled.current) return;
    let cancelled = false;
    const loadCloud = async () => {
      setCloudStatus('loading');
      setCloudMessage('Buscando progresso na nuvem...');
      try {
        const result = await fetchCloudSave<CloudSavePayload>(deviceId);
        if (cancelled) return;
        if (result.ok && result.payload) {
          const normalized = normalizeCloudPayload(result.payload);
          if (!profiles.length && normalized.profiles.length) {
            setProfiles(normalized.profiles);
            setActiveProfileId(normalized.activeProfileId);
            setProgressMap(normalized.progressMap);
            setParentSettings(normalized.parentSettings);
            setDailyUsage(normalized.dailyUsage);
            setSessionHistory(normalized.sessionHistory);
            setDailyMissionMap(normalized.dailyMissionMap);
            setOnboardingSeen(normalized.onboardingSeen);
            setSeasonClaims(normalized.seasonClaims);
            setCatalogManifestVersion(normalized.contentManifestVersion);
          }
          setCloudStatus('success');
          setCloudMessage('Cloud save conectado');
          setLastCloudSync(result.updatedAt ?? null);
        } else {
          setCloudStatus('success');
          setCloudMessage('Cloud save ativo, sem dados remotos ainda');
        }
      } catch {
        if (cancelled) return;
        setCloudStatus('error');
        setCloudMessage('Falha ao carregar a nuvem');
      } finally {
        initialCloudHandled.current = true;
      }
    };
    loadCloud();
    return () => { cancelled = true; };
  }, [deviceId, profiles.length]);

  useEffect(() => {
    if (!dynamicContentEnabled()) return;
    let cancelled = false;
    const loadCatalog = async () => {
      setCatalogStatus('loading');
      setCatalogMessage('Buscando catálogo dinâmico...');
      try {
        const result = await fetchDynamicCatalog();
        if (cancelled) return;
        if (result.ok && result.payload) {
          setDynamicPacks(result.payload.contentPacks?.length ? result.payload.contentPacks : fallbackContentPacks);
          setDynamicEvents(result.payload.seasonalEvents?.length ? result.payload.seasonalEvents : fallbackSeasonalEvents);
          setDynamicWeeklyTracks(result.payload.parentWeeklyTracks?.length ? result.payload.parentWeeklyTracks : fallbackParentWeeklyTracks);
          setCatalogManifestVersion(result.payload.manifestVersion || dynamicContentBlueprint.version);
          setCatalogStatus('success');
          setCatalogMessage('Catálogo Supabase ativo');
          setCatalogUpdatedAt(result.updatedAt ?? null);
          setCatalogSource('remote');
        } else {
          setCatalogStatus('error');
          setCatalogMessage(result.error ?? 'Falha ao carregar catálogo dinâmico.');
        }
      } catch {
        if (cancelled) return;
        setCatalogStatus('error');
        setCatalogMessage('Falha ao carregar catálogo dinâmico.');
      }
    };
    loadCatalog();
    return () => { cancelled = true; };
  }, []);

  const buildPayload = (): CloudSavePayload => ({
    version: 16,
    profiles,
    activeProfileId,
    progressMap,
    parentSettings,
    dailyUsage,
    sessionHistory,
    dailyMissionMap,
    onboardingSeen,
    seasonClaims,
    varietyBonusClaims,
    contentManifestVersion: catalogManifestVersion,
  });

  useEffect(() => {
    if (!cloudSyncEnabled() || !initialCloudHandled.current) return;
    const timeoutId = window.setTimeout(async () => {
      try {
        setCloudStatus('loading');
        const response = await pushCloudSave(deviceId, buildPayload());
        if (response.ok) {
          setCloudStatus('success');
          setCloudMessage('Cloud save sincronizado');
          setLastCloudSync(response.updatedAt ?? new Date().toISOString());
        } else {
          setCloudStatus('error');
          setCloudMessage(response.error ?? 'Falha ao sincronizar');
        }
      } catch {
        setCloudStatus('error');
        setCloudMessage('Falha ao sincronizar');
      }
    }, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [profiles, activeProfileId, progressMap, parentSettings, dailyUsage, sessionHistory, dailyMissionMap, onboardingSeen, seasonClaims, deviceId]);

  const ensureProfileProgress = (profileId: string) => {
    setProgressMap((current) => {
      if (current[profileId]) return current;
      return { ...current, [profileId]: createEmptyProfileProgress() };
    });
  };

  const handleCreateChild = () => {
    const trimmedName = newChildName.trim();
    if (!trimmedName) return;
    const nextProfile: ChildProfile = {
      id: `child-${Date.now()}`,
      name: trimmedName,
      age: newChildAge,
      accent: profileAccentPalette[profiles.length % profileAccentPalette.length],
      avatar: newChildAvatar,
      buddy: newChildBuddy,
      mascotTheme: newChildMascotTheme,
      createdAt: new Date().toISOString(),
    };
    setProfiles((current) => [...current, nextProfile]);
    setActiveProfileId(nextProfile.id);
    setProgressMap((current) => ({ ...current, [nextProfile.id]: createEmptyProfileProgress() }));
    setNewChildName('');
    setNewChildAge(5);
    setNewChildAvatar(getDefaultAvatar(profiles.length + 1));
    setNewChildBuddy(getDefaultBuddy(profiles.length + 1));
    setNewChildMascotTheme(getDefaultMascotTheme(profiles.length + 1));
    setSelectedPhaseId(worldPhaseOrder.memory[0]);
    playSound('unlock', audioEnabled);
    showToast({ tone: 'success', title: 'Perfil criado', text: `${nextProfile.name} já pode começar a aventura com avatar, mascote e progresso próprio.` });
  };

  const handlePhaseSelect = (phaseId: string) => {
    const game = getGameForPhase(phaseId);
    const phaseState = getPhaseStatus(activeProgress, game, phaseId);
    if (phaseState.unlocked) {
      setSelectedPhaseId(phaseId);
      playSound('tap', audioEnabled);
      return;
    }
    playSound('error', audioEnabled);
    showToast({ tone: 'warning', title: 'Fase bloqueada', text: 'Conclua a fase anterior ou use a recomendação da Estelinha para continuar sem travar a jornada.' });
  };

  const updateActiveProfileLook = (field: 'avatar' | 'buddy', value: string) => {
    if (!activeProfile) return;
    setProfiles((current) => current.map((profile) => (profile.id === activeProfile.id ? { ...profile, [field]: value } : profile)));
    playSound('tap', audioEnabled);
  };

  const updateActiveMascotTheme = (themeId: string) => {
    if (!activeProfile) return;
    setProfiles((current) => current.map((profile) => (profile.id === activeProfile.id ? { ...profile, mascotTheme: themeId } : profile)));
    playSound('tap', audioEnabled);
  };

  const claimSeasonEvent = (eventId: string) => {
    if (!activeProfile) return;
    const event = resolvedEvents.find((item) => item.id === eventId);
    if (!event) return;
    const alreadyClaimed = (seasonClaims[activeProfile.id] ?? []).includes(eventId);
    const progressCount = getSeasonProgress(activeProgress, event);
    if (alreadyClaimed || progressCount < event.targetCompletions) return;

    setSeasonClaims((current) => ({ ...current, [activeProfile.id]: [...(current[activeProfile.id] ?? []), eventId] }));
    setProgressMap((current) => {
      const existing = current[activeProfile.id] ?? createEmptyProfileProgress();
      return {
        ...current,
        [activeProfile.id]: recalculateProfileProgress({
          ...existing,
          bonusStars: (existing.bonusStars ?? 0) + event.rewardStars,
        }),
      };
    });
    setCelebration({
      title: event.title,
      stars: event.rewardStars,
      score: event.rewardStars * 12,
      reward: event.rewardLabel,
      nextPhaseId: getFirstPlayablePhaseForWorld(activeProgress, event.world),
      unlockedCount: 1,
      unlockedNow: true,
    });
    playSound('reward', audioEnabled);
    showToast({ tone: 'success', title: 'Evento resgatado', text: `${event.rewardStars} estrela(s) bônus e o selo ${event.rewardLabel} foram adicionados ao perfil ativo.` });
  };

  const handlePackSelect = (packId: string) => {
    const pack = resolvedPacks.find((item) => item.id === packId);
    if (!pack) return;
    setSelectedPackId(packId);
    const targetPhaseId = pack.phaseIds.find((phaseId) => getPhaseStatus(activeProgress, getGameForPhase(phaseId), phaseId).unlocked) ?? pack.phaseIds[0];
    if (targetPhaseId) setSelectedPhaseId(targetPhaseId);
    playSound('tap', audioEnabled);
  };

  const openSelectedPackNextPhase = () => {
    if (!nextPackPhaseId) return;
    handlePhaseSelect(nextPackPhaseId);
  };

  const handleRecommendedPack = () => {
    if (!recommendedPackId) return;
    handlePackSelect(recommendedPackId);
  };

  const seedCatalogDraft = () => {
    setCatalogDraft({
      packs: JSON.stringify(resolvedPacks, null, 2),
      events: JSON.stringify(resolvedEvents, null, 2),
      tracks: JSON.stringify(resolvedWeeklyTracks, null, 2),
    });
  };

  const parseCatalogDraft = () => {
    const packs = JSON.parse(catalogDraft.packs || '[]') as ContentPack[];
    const events = JSON.parse(catalogDraft.events || '[]') as SeasonalEvent[];
    const tracks = JSON.parse(catalogDraft.tracks || '[]') as ParentWeeklyTrack[];
    return {
      packs: Array.isArray(packs) ? packs : [],
      events: Array.isArray(events) ? events : [],
      tracks: Array.isArray(tracks) ? tracks : [],
    };
  };

  const validateCatalogDraft = () => {
    try {
      const { packs, events, tracks } = parseCatalogDraft();
      const errors: string[] = [];
      if (packs.some((pack) => !pack.id || !pack.title || !Array.isArray(pack.phaseIds))) errors.push('Cada pack precisa de id, title e phaseIds.');
      if (events.some((item) => !item.id || !item.title || !item.world)) errors.push('Cada evento precisa de id, title e world.');
      if (tracks.some((item) => !item.id || !item.title || !Array.isArray(item.days))) errors.push('Cada trilha semanal precisa de id, title e days.');
      const duplicatePackIds = new Set<string>();
      const duplicateEventIds = new Set<string>();
      const duplicateTrackIds = new Set<string>();
      const seenPackIds = new Set<string>();
      const seenEventIds = new Set<string>();
      const seenTrackIds = new Set<string>();
      packs.forEach((item) => { if (seenPackIds.has(item.id)) duplicatePackIds.add(item.id); seenPackIds.add(item.id); });
      events.forEach((item) => { if (seenEventIds.has(item.id)) duplicateEventIds.add(item.id); seenEventIds.add(item.id); });
      tracks.forEach((item) => { if (seenTrackIds.has(item.id)) duplicateTrackIds.add(item.id); seenTrackIds.add(item.id); });
      if (duplicatePackIds.size) errors.push(`Packs com id repetido: ${Array.from(duplicatePackIds).join(', ')}`);
      if (duplicateEventIds.size) errors.push(`Eventos com id repetido: ${Array.from(duplicateEventIds).join(', ')}`);
      if (duplicateTrackIds.size) errors.push(`Trilhas com id repetido: ${Array.from(duplicateTrackIds).join(', ')}`);
      return { ok: errors.length === 0, errors, counts: { packs: packs.length, events: events.length, tracks: tracks.length } };
    } catch {
      return { ok: false, errors: ['JSON inválido no estúdio de conteúdo.'], counts: { packs: 0, events: 0, tracks: 0 } };
    }
  };

  const exportCatalogBundle = () => {
    try {
      const draft = parseCatalogDraft();
      const payload = {
        manifestVersion: catalogManifestVersion,
        exportedAt: new Date().toISOString(),
        contentPacks: draft.packs,
        seasonalEvents: draft.events,
        parentWeeklyTracks: draft.tracks,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `escola-divertida-catalogo-v${catalogManifestVersion}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast({ tone: 'success', title: 'Pacote exportado', text: 'O catálogo consolidado foi baixado em um único JSON.' });
    } catch {
      showToast({ tone: 'error', title: 'Exportação interrompida', text: 'Corrija o JSON antes de exportar o pacote do catálogo.' });
    }
  };

  const openCatalogImport = () => {
    catalogImportRef.current?.click();
  };

  const handleCatalogImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as {
        manifestVersion?: number;
        contentPacks?: ContentPack[];
        seasonalEvents?: SeasonalEvent[];
        parentWeeklyTracks?: ParentWeeklyTrack[];
      };
      setCatalogDraft({
        packs: JSON.stringify(Array.isArray(parsed.contentPacks) ? parsed.contentPacks : [], null, 2),
        events: JSON.stringify(Array.isArray(parsed.seasonalEvents) ? parsed.seasonalEvents : [], null, 2),
        tracks: JSON.stringify(Array.isArray(parsed.parentWeeklyTracks) ? parsed.parentWeeklyTracks : [], null, 2),
      });
      if (parsed.manifestVersion) setCatalogManifestVersion(parsed.manifestVersion);
      setAdminStatus('success');
      setAdminMessage('Pacote JSON carregado no estúdio.');
      showToast({ tone: 'success', title: 'Pacote importado', text: 'O catálogo foi carregado no editor e já pode ser pré-visualizado.' });
    } catch {
      setAdminStatus('error');
      setAdminMessage('Falha ao importar o pacote JSON.');
      showToast({ tone: 'error', title: 'Importação falhou', text: 'O arquivo não está no formato esperado de catálogo dinâmico.' });
    } finally {
      event.currentTarget.value = '';
    }
  };

  const checkInfrastructureNow = async () => {
    setInfraStatus('loading');
    setInfraMessage('Verificando Netlify + Supabase...');
    try {
      const result = await fetchInfrastructureHealth();
      if (result.ok && result.payload) {
        setInfraSnapshot(result.payload);
        const warnings = result.payload.warnings.length;
        setInfraStatus(warnings ? 'error' : 'success');
        setInfraMessage(warnings ? `${warnings} alerta(s) encontrados` : 'Infraestrutura pronta para ativação');
        showToast({ tone: warnings ? 'warning' : 'success', title: warnings ? 'Infraestrutura com alertas' : 'Infraestrutura validada', text: warnings ? result.payload.warnings[0] : 'Netlify Functions e Supabase responderam como esperado.' });
      } else {
        setInfraStatus('error');
        setInfraMessage(result.error ?? 'Falha ao verificar a infraestrutura.');
        showToast({ tone: 'error', title: 'Falha de infraestrutura', text: result.error ?? 'Não foi possível verificar o ambiente agora.' });
      }
    } catch {
      setInfraStatus('error');
      setInfraMessage('Falha ao verificar a infraestrutura.');
    }
  };

  const refreshDynamicCatalog = async () => {
    if (!dynamicContentEnabled()) {
      setCatalogStatus('idle');
      setCatalogMessage('Ative VITE_ENABLE_DYNAMIC_CONTENT para buscar o catálogo remoto.');
      return;
    }
    setCatalogStatus('loading');
    setCatalogMessage('Atualizando catálogo remoto...');
    try {
      const result = await fetchDynamicCatalog();
      if (result.ok && result.payload) {
        setDynamicPacks(result.payload.contentPacks?.length ? result.payload.contentPacks : fallbackContentPacks);
        setDynamicEvents(result.payload.seasonalEvents?.length ? result.payload.seasonalEvents : fallbackSeasonalEvents);
        setDynamicWeeklyTracks(result.payload.parentWeeklyTracks?.length ? result.payload.parentWeeklyTracks : fallbackParentWeeklyTracks);
        setCatalogManifestVersion(result.payload.manifestVersion || dynamicContentBlueprint.version);
        setCatalogStatus('success');
        setCatalogMessage('Catálogo remoto carregado');
        setCatalogUpdatedAt(result.updatedAt ?? null);
        setCatalogSource('remote');
        showToast({ tone: 'success', title: 'Catálogo atualizado', text: 'O conteúdo remoto foi carregado sem interromper o fallback local.' });
      } else {
        setCatalogStatus('error');
        setCatalogMessage(result.error ?? 'Falha ao atualizar catálogo remoto.');
        showToast({ tone: 'error', title: 'Falha no catálogo', text: result.error ?? 'Não foi possível atualizar o catálogo remoto agora.' });
      }
    } catch {
      setCatalogStatus('error');
      setCatalogMessage('Falha ao atualizar catálogo remoto.');
    }
  };

  const previewCatalogDraft = () => {
    const validation = validateCatalogDraft();
    if (!validation.ok) {
      setAdminStatus('error');
      setAdminMessage(validation.errors[0] ?? 'JSON inválido no estúdio de conteúdo.');
      showToast({ tone: 'error', title: 'JSON inválido', text: validation.errors.join(' · ') || 'Revise o conteúdo do estúdio antes de pré-visualizar ou publicar.' });
      return;
    }

    const { packs, events, tracks } = parseCatalogDraft();
    setDynamicPacks(packs.length ? packs : fallbackContentPacks);
    setDynamicEvents(events.length ? events : fallbackSeasonalEvents);
    setDynamicWeeklyTracks(tracks.length ? tracks : fallbackParentWeeklyTracks);
    setCatalogStatus('success');
    setCatalogMessage('Pré-visualização local aplicada');
    setCatalogManifestVersion(dynamicContentBlueprint.version);
    setCatalogSource('draft');
    setAdminStatus('success');
    setAdminMessage(`Rascunho validado: ${validation.counts.packs} packs, ${validation.counts.events} eventos, ${validation.counts.tracks} trilhas.`);
    playSound('tap', audioEnabled);
    showToast({ tone: 'info', title: 'Pré-visualização pronta', text: 'O estúdio aplicou o catálogo localmente para teste rápido, sem publicar nada ainda.' });
  };

  const publishCatalogDraftToCloud = async () => {
    if (!adminToken.trim()) {
      setAdminStatus('error');
      setAdminMessage('Informe o token administrativo para publicar.');
      return;
    }
    const validation = validateCatalogDraft();
    if (!validation.ok) {
      setAdminStatus('error');
      setAdminMessage(validation.errors[0] ?? 'JSON inválido ou incompleto.');
      showToast({ tone: 'error', title: 'Publicação interrompida', text: validation.errors.join(' · ') || 'Corrija o JSON antes de publicar.' });
      return;
    }
    try {
      const parsed = parseCatalogDraft();
      const payload = {
        manifestVersion: dynamicContentBlueprint.version,
        contentPacks: parsed.packs,
        seasonalEvents: parsed.events,
        parentWeeklyTracks: parsed.tracks,
      };
      setAdminStatus('loading');
      setAdminMessage('Publicando catálogo no Supabase...');
      const result = await publishDynamicCatalog(adminToken.trim(), payload);
      if (result.ok && result.payload) {
        setDynamicPacks(result.payload.contentPacks?.length ? result.payload.contentPacks : fallbackContentPacks);
        setDynamicEvents(result.payload.seasonalEvents?.length ? result.payload.seasonalEvents : fallbackSeasonalEvents);
        setDynamicWeeklyTracks(result.payload.parentWeeklyTracks?.length ? result.payload.parentWeeklyTracks : fallbackParentWeeklyTracks);
        setCatalogManifestVersion(result.payload.manifestVersion || dynamicContentBlueprint.version);
        setCatalogStatus('success');
        setCatalogMessage('Catálogo publicado no Supabase');
        setCatalogUpdatedAt(result.updatedAt ?? new Date().toISOString());
        setCatalogSource('remote');
        setLastPublicationSummary(result.publication ?? null);
        setAdminStatus('success');
        setAdminMessage(`Publicação concluída com ${validation.counts.packs} packs, ${validation.counts.events} eventos e ${validation.counts.tracks} trilhas.`);
        playSound('unlock', audioEnabled);
        showToast({ tone: 'success', title: 'Catálogo publicado', text: 'O conteúdo dinâmico foi enviado para o Supabase com fallback local preservado.' });
      } else {
        setAdminStatus('error');
        setAdminMessage(result.error ?? 'Falha ao publicar o catálogo.');
        showToast({ tone: 'error', title: 'Falha ao publicar', text: result.error ?? 'O catálogo não foi publicado. O modo local continua ativo.' });
      }
    } catch {
      setAdminStatus('error');
      setAdminMessage('JSON inválido ou falha ao publicar o catálogo.');
      showToast({ tone: 'error', title: 'Publicação interrompida', text: 'Corrija o JSON ou tente novamente quando a rede estiver estável.' });
    }
  };


  const loadRemoteCatalogIntoStudio = async () => {
    if (!adminToken.trim()) {
      setAdminStatus('error');
      setAdminMessage('Informe o token administrativo para carregar o catálogo remoto no estúdio.');
      return;
    }
    setAdminStatus('loading');
    setAdminMessage('Carregando catálogo remoto no estúdio...');
    try {
      const result = await fetchAdminDynamicCatalog(adminToken.trim());
      if (result.ok && result.payload) {
        setCatalogDraft({
          packs: JSON.stringify(result.payload.contentPacks || [], null, 2),
          events: JSON.stringify(result.payload.seasonalEvents || [], null, 2),
          tracks: JSON.stringify(result.payload.parentWeeklyTracks || [], null, 2),
        });
        setCatalogManifestVersion(result.payload.manifestVersion || dynamicContentBlueprint.version);
        setCatalogUpdatedAt(result.updatedAt ?? null);
        setCatalogSource('remote');
        setLastPublicationSummary(result.publication ?? null);
        setAdminStatus('success');
        setAdminMessage('Catálogo remoto carregado no editor.');
        showToast({ tone: 'success', title: 'Estúdio sincronizado', text: 'O catálogo remoto foi carregado no editor administrativo.' });
      } else {
        setAdminStatus('error');
        setAdminMessage(result.error ?? 'Falha ao carregar o catálogo remoto no editor.');
        showToast({ tone: 'error', title: 'Falha no estúdio', text: result.error ?? 'Não foi possível carregar o catálogo remoto agora.' });
      }
    } catch {
      setAdminStatus('error');
      setAdminMessage('Falha ao carregar o catálogo remoto no editor.');
    }
  };

  const studioValidation = validateCatalogDraft();

  useEffect(() => {
    if (!contentStudioOpen) return;
    if (!catalogDraft.packs && !catalogDraft.events && !catalogDraft.tracks) {
      seedCatalogDraft();
    }
    if (!infraSnapshot && infraStatus === 'idle') {
      void checkInfrastructureNow();
    }
  }, [contentStudioOpen, catalogDraft.packs, catalogDraft.events, catalogDraft.tracks, infraSnapshot, infraStatus]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeoutId = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const showToast = (nextToast: Omit<ToastState, 'id'>) => {
    setToast({ id: Date.now(), ...nextToast });
  };

  const requestProtectedAction = (gate: ParentGateState) => setParentGate(gate);

  const handleSurprisePhase = () => {
    const phaseId = getRandomUnlockedPhaseId(activeProgress);
    setSelectedPhaseId(phaseId);
    playSound('tap', audioEnabled);
  };

  const dismissOnboarding = () => {
    if (!activeProfile) return;
    setOnboardingSeen((current) => ({ ...current, [activeProfile.id]: true }));
    playSound('tap', audioEnabled);
  };

  const handleClaimMissionReward = (missionId: string) => {
    if (!activeProfile) return;
    const mission = activeDailyMissionState.missions.find((item) => item.id === missionId);
    if (!mission || !mission.completed || mission.claimed) return;

    setDailyMissionMap((current) => {
      const state = normalizeDailyMissionState(current[activeProfile.id], activeProgress);
      return {
        ...current,
        [activeProfile.id]: {
          ...state,
          missions: state.missions.map((item) => (item.id === missionId ? { ...item, claimed: true } : item)),
        },
      };
    });

    setProgressMap((current) => {
      const existing = current[activeProfile.id] ?? createEmptyProfileProgress();
      return {
        ...current,
        [activeProfile.id]: recalculateProfileProgress({
          ...existing,
          bonusStars: (existing.bonusStars ?? 0) + mission.rewardStars,
        }),
      };
    });

    setCelebration({
      title: mission.title,
      stars: mission.rewardStars,
      score: mission.rewardStars * 10,
      reward: `${mission.rewardStars} estrela(s) bônus`,
      nextPhaseId: recommendedPhaseId,
      unlockedCount: 0,
      unlockedNow: false,
    });
    playSound('reward', audioEnabled);
    showToast({ tone: 'success', title: 'Missão resgatada', text: `${mission.rewardStars} estrela(s) bônus foram adicionadas ao perfil ativo.` });
  };

  const handleSessionStart = (game: GameKey, phaseId: string) => {
    if (!activeProfile) return;
    setSessionLive(true);
    ensureProfileProgress(activeProfile.id);
    setSessionHistory((current) => markPlayedToday(normalizeSessionHistory(current), activeProfile.id));
    setProgressMap((current) => {
      const existing = current[activeProfile.id] ?? createEmptyProfileProgress();
      const gameProgress = existing.games[game];
      const phaseState = gameProgress.phases[phaseId] ?? createEmptyPhaseProgress(phaseId === worldPhaseOrder[game][0]);
      return {
        ...current,
        [activeProfile.id]: {
          ...existing,
          games: {
            ...existing.games,
            [game]: {
              ...gameProgress,
              plays: gameProgress.plays + 1,
              phases: {
                ...gameProgress.phases,
                [phaseId]: { ...phaseState, plays: phaseState.plays + 1 },
              },
            },
          },
        },
      };
    });
    setDailyMissionMap((current) => {
      const state = normalizeDailyMissionState(current[activeProfile.id], activeProgress);
      return { ...current, [activeProfile.id]: advanceMissionState(state, [{ kind: 'play' }, { kind: 'world', world: game }]) };
    });
  };

  const handlePhaseComplete = (game: GameKey, phaseId: string, stars: number, score: number) => {
    if (!activeProfile) return;
    const shouldApplyVarietyBonus = game === varietyInsight.world.game && varietyBonusClaims[activeProfile.id] !== `${getTodayKey()}:${game}`;
    let celebrationPayload: CelebrationState | null = null;
    setProgressMap((current) => {
      const existing = current[activeProfile.id] ?? createEmptyProfileProgress();
      const gameProgress = existing.games[game];
      const phaseState = gameProgress.phases[phaseId] ?? createEmptyPhaseProgress(phaseId === worldPhaseOrder[game][0]);
      const nextPhaseId = getNextPhaseId(game, phaseId);
      const nextPhases = {
        ...gameProgress.phases,
        [phaseId]: {
          ...phaseState,
          completions: phaseState.completions + 1,
          bestStars: Math.max(phaseState.bestStars, stars),
          bestScore: Math.max(phaseState.bestScore, score),
          unlocked: true,
        },
      };
      let unlockedNow = false;
      if (nextPhaseId) {
        const nextState = nextPhases[nextPhaseId] ?? createEmptyPhaseProgress(false);
        if (!nextState.unlocked) {
          playSound('unlock', audioEnabled);
          unlockedNow = true;
        }
        nextPhases[nextPhaseId] = { ...nextState, unlocked: true };
      }
      const updated = recalculateProfileProgress({
        ...existing,
        totalCompletions: existing.totalCompletions + 1,
        bonusStars: (existing.bonusStars ?? 0) + (shouldApplyVarietyBonus ? 1 : 0),
        games: {
          ...existing.games,
          [game]: {
            ...gameProgress,
            completions: gameProgress.completions + 1,
            lastStars: stars,
            bestScore: Math.max(gameProgress.bestScore, score),
            phases: nextPhases,
          },
        },
      });
      const newlyUnlockedRewards = updated.unlockedRewards.filter((reward) => !existing.unlockedRewards.includes(reward));
      celebrationPayload = {
        title: phaseMap[phaseId].title,
        stars,
        score,
        reward: shouldApplyVarietyBonus ? `${phaseMap[phaseId].reward} + Estrela bônus do rodízio` : phaseMap[phaseId].reward,
        nextPhaseId,
        unlockedCount: newlyUnlockedRewards.length,
        unlockedNow,
      };
      return { ...current, [activeProfile.id]: updated };
    });
    if (shouldApplyVarietyBonus) {
      setVarietyBonusClaims((current) => ({ ...current, [activeProfile.id]: `${getTodayKey()}:${game}` }));
    }
    setDailyMissionMap((current) => {
      const state = normalizeDailyMissionState(current[activeProfile.id], activeProgress);
      return { ...current, [activeProfile.id]: advanceMissionState(state, [{ kind: 'complete' }]) };
    });
    if (celebrationPayload) {
      setCelebration(celebrationPayload);
      playSound(stars >= 3 ? 'reward' : 'success', audioEnabled);
      if (shouldApplyVarietyBonus) {
        showToast({ tone: 'success', title: 'Bônus de variedade', text: `Primeira vitória do dia em ${varietyInsight.world.shortTitle}: +1 estrela bônus para incentivar rodízio inteligente.` });
      }
    }
  };

  const performResetActiveProfile = () => {
    if (!activeProfile) return;
    setProgressMap((current) => ({ ...current, [activeProfile.id]: createEmptyProfileProgress() }));
    setDailyUsage((current) => ({ ...current, usageByProfile: { ...current.usageByProfile, [activeProfile.id]: 0 } }));
    setDailyMissionMap((current) => ({ ...current, [activeProfile.id]: buildDailyMissionState(createEmptyProfileProgress()) }));
    setOnboardingSeen((current) => ({ ...current, [activeProfile.id]: false }));
    setSelectedPhaseId(worldPhaseOrder.memory[0]);
    setSessionLive(false);
    stopSpeaking();
    showToast({ tone: 'warning', title: 'Perfil reiniciado', text: 'O perfil ativo voltou ao começo da jornada e o onboarding foi reaberto.' });
  };

  const requestResetActiveProfile = () => requestProtectedAction({
    title: 'Reiniciar perfil ativo',
    description: 'Isso apaga fases, recompensas, missões do dia e tempo salvo do perfil selecionado. O restante do app continua intacto.',
    accent: 'rose',
    confirmLabel: 'Segurar para reiniciar',
    onConfirm: performResetActiveProfile,
  });

  const uploadNow = async () => {
    if (!cloudSyncEnabled()) return;
    try {
      setCloudStatus('loading');
      const response = await pushCloudSave(deviceId, buildPayload());
      if (response.ok) {
        setCloudStatus('success');
        setCloudMessage('Envio manual concluído');
        setLastCloudSync(response.updatedAt ?? new Date().toISOString());
        showToast({ tone: 'success', title: 'Nuvem sincronizada', text: 'O progresso local foi enviado com sucesso para a nuvem.' });
      } else {
        setCloudStatus('error');
        setCloudMessage(response.error ?? 'Falha no envio manual');
        showToast({ tone: 'error', title: 'Falha no envio', text: response.error ?? 'Não foi possível sincronizar na nuvem agora.' });
      }
    } catch {
      setCloudStatus('error');
      setCloudMessage('Falha no envio manual');
      showToast({ tone: 'error', title: 'Falha no envio', text: 'A rede não respondeu. O modo local continua preservado.' });
    }
  };

  const performDownloadNow = async () => {
    if (!cloudSyncEnabled()) return;
    try {
      setCloudStatus('loading');
      const response = await fetchCloudSave<CloudSavePayload>(deviceId);
      if (response.ok && response.payload) {
        const normalized = normalizeCloudPayload(response.payload);
        setProfiles(normalized.profiles);
        setActiveProfileId(normalized.activeProfileId);
        setProgressMap(normalized.progressMap);
        setParentSettings(normalized.parentSettings);
        setDailyUsage(normalized.dailyUsage);
        setSessionHistory(normalized.sessionHistory);
        setDailyMissionMap(normalized.dailyMissionMap);
        setOnboardingSeen(normalized.onboardingSeen);
        setSeasonClaims(normalized.seasonClaims);
        setVarietyBonusClaims(normalized.varietyBonusClaims);
        setCatalogManifestVersion(normalized.contentManifestVersion);
        setCloudStatus('success');
        setCloudMessage('Download manual concluído');
        setLastCloudSync(response.updatedAt ?? null);
        showToast({ tone: 'success', title: 'Dados restaurados', text: 'Perfis, progresso e catálogo salvo voltaram da nuvem para este dispositivo.' });
      } else {
        setCloudStatus('error');
        setCloudMessage('Nenhum dado encontrado na nuvem');
        showToast({ tone: 'warning', title: 'Nuvem vazia', text: 'Não havia um save remoto para restaurar neste dispositivo.' });
      }
    } catch {
      setCloudStatus('error');
      setCloudMessage('Falha no download manual');
      showToast({ tone: 'error', title: 'Falha no download', text: 'A restauração remota não foi concluída. O progresso local segue intacto.' });
    }
  };

  const requestDownloadNow = () => requestProtectedAction({
    title: 'Restaurar dados da nuvem neste dispositivo',
    description: 'Isso substitui os dados locais atuais pelos dados remotos do mesmo deviceId. Use apenas quando quiser recuperar a versão salva na nuvem.',
    accent: 'indigo',
    confirmLabel: 'Segurar para restaurar',
    onConfirm: performDownloadNow,
  });

  const requestPublishCatalog = () => requestProtectedAction({
    title: 'Publicar catálogo no Supabase',
    description: 'Esta ação envia packs, eventos e trilhas semanais para a camada remota. Ela é sensível porque altera o catálogo dinâmico servido pelo projeto.',
    accent: 'emerald',
    confirmLabel: 'Segurar para publicar',
    onConfirm: publishCatalogDraftToCloud,
  });

  const disabledReason = !activeProfile
    ? 'Crie ou selecione um perfil infantil para salvar fases, recompensas e progresso.'
    : limitReached
      ? 'O limite diário deste perfil foi alcançado. Faça uma pausa ativa e volte depois.'
      : null;

  const currentPhaseState = getPhaseStatus(activeProgress, selectedGame, selectedPhaseId);
  const rewardGallery = [
    ...((activeProgress?.unlockedRewards ?? []).slice(-8).map((label) => ({ label, unlocked: true }))),
    ...rewardMilestones
      .filter((item) => !(activeProgress?.unlockedRewards ?? []).includes(item.label))
      .slice(0, 4)
      .map((item) => ({ label: item.label, unlocked: false })),
  ];
  const pauseTips = ['Respire fundo três vezes', 'Alongue braços e ombros', 'Piscar e olhar para longe por 20 segundos'];

  const renderSelectedGame = () => {
    const commonProps = {
      disabledReason,
      soundEnabled: audioEnabled,
      onStart: () => handleSessionStart(selectedGame, selectedPhaseId),
      onComplete: (stars: number, score: number) => handlePhaseComplete(selectedGame, selectedPhaseId, stars, score),
    };
    if (selectedGame === 'memory') return <MemoryGame phase={selectedPhase as MemoryPhase} {...commonProps} />;
    if (selectedGame === 'alphabet') return <AlphabetGame phase={selectedPhase as AlphabetPhase} {...commonProps} />;
    if (selectedGame === 'math') return <MathGame phase={selectedPhase as MathPhase} {...commonProps} />;
    if (selectedGame === 'shape') return <ShapeGame phase={selectedPhase as ShapePhase} {...commonProps} />;
    if (selectedGame === 'colors') return <ColorsGame phase={selectedPhase as ColorsPhase} {...commonProps} />;
    if (selectedGame === 'maze') return <MazeGame phase={selectedPhase as MazePhase} {...commonProps} />;
    return <PuzzleGame phase={selectedPhase as PuzzlePhase} {...commonProps} />;
  };

  return (
    <section id="minijogos" className="bg-indigo-50 px-4 py-24">
      <div className="mx-auto max-w-7xl">
        <SectionTitle badge="V16 pré-infraestrutura premium" title="Base premium com nuvem operacional, catálogo remoto sincronizável e admin inicial utilizável" text="A base agora mantém a experiência premium e adiciona sincronização operacional para Netlify + Supabase, publicação consistente do catálogo, health check mais profundo e fluxo administrativo melhor para a próxima etapa do produto." />

        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Perfis infantis</div>
                <h3 className="mt-2 text-2xl font-black text-indigo-950">Quem vai jogar agora?</h3>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-800"><Users className="h-4 w-4" /> {profiles.length} perfil{profiles.length === 1 ? '' : 's'}</div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {profiles.map((profile) => {
                const profileProgress = progressMap[profile.id] ?? createEmptyProfileProgress();
                const isActive = activeProfileId === profile.id;
                return (
                  <button key={profile.id} type="button" onClick={() => setActiveProfileId(profile.id)} className={cn('rounded-[1.8rem] p-5 text-left transition', isActive ? 'bg-indigo-950 text-white shadow-xl shadow-indigo-200/80' : 'bg-indigo-50 hover:bg-indigo-100')}>
                    <div className="flex items-center justify-between gap-3">
                      <div className={cn('inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br p-3 text-3xl text-white', profile.accent)}>{profile.avatar}</div>
                      <div className="flex items-center gap-1 text-yellow-300">
                        {Array.from({ length: Math.max(1, Math.min(3, Math.ceil(profileProgress.totalStars / 6))) }, (_, index) => <Star key={`${profile.id}-star-${index}`} className="h-4 w-4 fill-current" />)}
                      </div>
                    </div>
                    <div className={cn('mt-4 text-xl font-black', isActive ? 'text-white' : 'text-indigo-950')}>{profile.name}</div>
                    <div className={cn('mt-1 text-sm font-semibold', isActive ? 'text-white/70' : 'text-indigo-500')}>{profile.age} anos · companheiro {profile.buddy}</div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className={cn('rounded-2xl p-3', isActive ? 'bg-white/10' : 'bg-white')}><div className={cn('text-xs font-bold uppercase tracking-[0.18em]', isActive ? 'text-white/60' : 'text-indigo-400')}>Estrelas</div><div className="mt-1 text-2xl font-black">{profileProgress.totalStars}</div></div>
                      <div className={cn('rounded-2xl p-3', isActive ? 'bg-white/10' : 'bg-white')}><div className={cn('text-xs font-bold uppercase tracking-[0.18em]', isActive ? 'text-white/60' : 'text-indigo-400')}>Recompensas</div><div className="mt-1 text-2xl font-black">{profileProgress.unlockedRewards.length}</div></div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 rounded-[2rem] bg-indigo-50 p-5">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Novo perfil</div>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_150px]">
                <input value={newChildName} onChange={(e) => setNewChildName(e.target.value)} placeholder="Nome da criança" className="rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-indigo-950 outline-none ring-0 placeholder:text-indigo-300" />
                <input type="number" min={4} max={7} value={newChildAge} onChange={(e) => setNewChildAge(clampAge(Number(e.target.value)))} className="rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-indigo-950 outline-none ring-0" />
                <button type="button" onClick={handleCreateChild} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-pink-500 px-5 py-3 text-sm font-black text-white hover:bg-pink-600"><PlusCircle className="h-4 w-4" /> Criar perfil</button>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.6rem] bg-white p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Escolha o avatar</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {avatarOptions.map((option) => (
                      <button key={option.emoji} type="button" onClick={() => setNewChildAvatar(option.emoji)} className={cn('flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition', newChildAvatar === option.emoji ? 'bg-indigo-950 text-white ring-4 ring-indigo-200' : 'bg-indigo-50 hover:bg-indigo-100')}>
                        {option.emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-[1.6rem] bg-white p-4">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Companheiro da aventura</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {buddyOptions.map((option) => (
                      <button key={option.emoji} type="button" onClick={() => setNewChildBuddy(option.emoji)} className={cn('flex h-12 w-12 items-center justify-center rounded-2xl text-2xl transition', newChildBuddy === option.emoji ? 'bg-pink-500 text-white ring-4 ring-pink-200' : 'bg-pink-50 hover:bg-pink-100')}>
                        {option.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-[1.6rem] bg-white p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Estilo da Estelinha</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {mascotThemeOptions.map((option) => (
                    <button key={option.id} type="button" onClick={() => setNewChildMascotTheme(option.id)} className={cn('rounded-[1.3rem] p-4 text-left transition', newChildMascotTheme === option.id ? 'bg-indigo-950 text-white ring-4 ring-indigo-200' : 'bg-indigo-50 hover:bg-indigo-100')}>
                      <div className="text-2xl">{option.emoji}</div>
                      <div className="mt-2 text-sm font-black">{option.label}</div>
                      <div className={cn('mt-2 text-xs leading-relaxed', newChildMascotTheme === option.id ? 'text-white/75' : 'text-indigo-700')}>{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Painel dos pais</div>
                <h3 className="mt-2 text-2xl font-black text-indigo-950">Controle, áudio e nuvem</h3>
              </div>
              <div className={cn('rounded-full px-4 py-2 text-sm font-black', cloudStatus === 'success' ? 'bg-emerald-100 text-emerald-700' : cloudStatus === 'loading' ? 'bg-yellow-100 text-yellow-700' : cloudStatus === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700')}>
                {cloudMessage}
              </div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.8rem] bg-indigo-50 p-4">
                <div className="text-sm font-bold text-indigo-500">Tempo usado hoje</div>
                <div className="mt-2 text-3xl font-black text-indigo-950">{formatDuration(usageTodaySeconds)}</div>
                <div className="mt-3 text-sm text-indigo-700">Limite atual: {parentSettings.dailyLimitMinutes} minutos</div>
                <div className="mt-3"><ProgressBar value={usageTodaySeconds} max={Math.max(60, parentSettings.dailyLimitMinutes * 60)} /></div>
                {breakReminderReached && <div className="mt-3 rounded-2xl bg-yellow-100 px-4 py-3 text-sm font-semibold text-yellow-800">Momento ideal para uma pausa ativa.</div>}
              </div>
              <div className="rounded-[1.8rem] bg-indigo-50 p-4">
                <div className="text-sm font-bold text-indigo-500">Sincronização</div>
                <div className="mt-2 text-sm font-semibold text-indigo-900">Dispositivo: {deviceId.slice(-8)}</div>
                <div className="mt-2 text-sm text-indigo-700">Última nuvem: {lastCloudSync ? new Date(lastCloudSync).toLocaleString('pt-BR') : 'ainda não sincronizado'}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={uploadNow} disabled={!cloudSyncEnabled()} className="rounded-full bg-indigo-950 px-4 py-2 text-sm font-black text-white disabled:opacity-40">Enviar</button>
                  <button type="button" onClick={requestDownloadNow} disabled={!cloudSyncEnabled()} className="rounded-full bg-white px-4 py-2 text-sm font-black text-indigo-950 disabled:opacity-40">Baixar</button>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="rounded-2xl bg-indigo-50 p-4 text-sm font-semibold text-indigo-900">Limite diário (min)
                <input type="number" min={5} max={120} value={parentSettings.dailyLimitMinutes} onChange={(e) => setParentSettings((current) => ({ ...current, dailyLimitMinutes: Math.max(5, Number(e.target.value) || 5) }))} className="mt-3 w-full rounded-xl border border-indigo-100 bg-white px-3 py-2 outline-none" />
              </label>
              <label className="rounded-2xl bg-indigo-50 p-4 text-sm font-semibold text-indigo-900">Lembrete de pausa (min)
                <input type="number" min={0} max={60} value={parentSettings.breakReminderMinutes} onChange={(e) => setParentSettings((current) => ({ ...current, breakReminderMinutes: Math.max(0, Number(e.target.value) || 0) }))} className="mt-3 w-full rounded-xl border border-indigo-100 bg-white px-3 py-2 outline-none" />
              </label>
              <button type="button" onClick={() => setParentSettings((current) => ({ ...current, audioEnabled: !current.audioEnabled }))} className={cn('rounded-2xl p-4 text-left text-sm font-semibold', audioEnabled ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-indigo-950')}>
                <div className="text-xs font-black uppercase tracking-[0.18em]">Sons</div>
                <div className="mt-2 text-lg font-black">{audioEnabled ? 'Ligados' : 'Desligados'}</div>
              </button>
              <button type="button" onClick={() => setParentSettings((current) => ({ ...current, narrationEnabled: !current.narrationEnabled }))} className={cn('rounded-2xl p-4 text-left text-sm font-semibold', narrationEnabled ? 'bg-indigo-950 text-white' : 'bg-slate-100 text-indigo-950')}>
                <div className="text-xs font-black uppercase tracking-[0.18em]">Narração</div>
                <div className="mt-2 text-lg font-black">{narrationEnabled ? 'Automática' : 'Manual'}</div>
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => speakText(mascotMessage)} disabled={!speechSupported} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-indigo-950 disabled:opacity-40"><Volume2 className="h-4 w-4" /> Ouvir guia</button>
              <button type="button" onClick={stopSpeaking} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-indigo-950"><PauseCircle className="h-4 w-4" /> Parar voz</button>
              <button type="button" onClick={requestResetActiveProfile} disabled={!activeProfile} className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-3 text-sm font-black text-white disabled:opacity-40"><RefreshCcw className="h-4 w-4" /> Zerar perfil ativo</button>
            </div>

            {activeProfile && (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[1.8rem] bg-indigo-50 p-4">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Visual da criança</div>
                  <div className="mt-3 flex items-center gap-4">
                    <div className={cn('flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br text-4xl text-white', activeProfile.accent)}>{activeProfile.avatar}</div>
                    <div>
                      <div className="text-xl font-black text-indigo-950">{activeProfile.name}</div>
                      <div className="mt-1 text-sm font-semibold text-indigo-600">Companheiro atual {activeProfile.buddy} · Estilo {getMascotThemeLabel(activeProfile.mascotTheme)}</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Trocar avatar</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {avatarOptions.map((option) => (
                        <button key={`avatar-${option.emoji}`} type="button" onClick={() => updateActiveProfileLook('avatar', option.emoji)} className={cn('flex h-11 w-11 items-center justify-center rounded-2xl text-2xl transition', activeProfile.avatar === option.emoji ? 'bg-indigo-950 text-white ring-4 ring-indigo-200' : 'bg-white hover:bg-indigo-100')}>{option.emoji}</button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Trocar companheiro</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {buddyOptions.map((option) => (
                        <button key={`buddy-${option.emoji}`} type="button" onClick={() => updateActiveProfileLook('buddy', option.emoji)} className={cn('flex h-11 w-11 items-center justify-center rounded-2xl text-2xl transition', activeProfile.buddy === option.emoji ? 'bg-pink-500 text-white ring-4 ring-pink-200' : 'bg-white hover:bg-pink-100')}>{option.emoji}</button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Tema da Estelinha</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {mascotThemeOptions.map((option) => (
                        <button key={option.id} type="button" onClick={() => updateActiveMascotTheme(option.id)} className={cn('rounded-2xl p-3 text-left text-sm font-semibold transition', activeProfile.mascotTheme === option.id ? 'bg-indigo-950 text-white ring-4 ring-indigo-200' : 'bg-white hover:bg-indigo-100 text-indigo-900')}>
                          <div className="text-lg">{option.emoji}</div>
                          <div className="mt-1 font-black">{option.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.8rem] bg-indigo-50 p-4">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Dica para os pais</div>
                  <div className="mt-3 text-xl font-black text-indigo-950">Leve o favorito para fora da tela</div>
                  <p className="mt-2 text-sm leading-relaxed text-indigo-700">{getOfflineActivityTip(experienceSummary.favoriteWorld)}</p>
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-indigo-900">Foco atual mais forte: <span className="font-black">{experienceSummary.favoriteWorld.shortTitle}</span>. Use isso como ponte para conversas, brincadeiras físicas e repetição saudável do conteúdo.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Ritmo da jornada</div>
                <h3 className="mt-2 text-2xl font-black text-indigo-950">Continuidade que a criança sente e os pais conseguem ler rápido</h3>
              </div>
              <div className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-900">{experienceSummary.rank}</div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Sequência atual</div><div className="mt-1 text-3xl font-black text-indigo-950">{experienceSummary.streak}</div><div className="mt-2 text-sm text-indigo-700">dia{experienceSummary.streak === 1 ? '' : 's'} seguidos</div></div>
              <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Dias explorados</div><div className="mt-1 text-3xl font-black text-indigo-950">{experienceSummary.activeDays}</div><div className="mt-2 text-sm text-indigo-700">dias com atividade</div></div>
              <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Mundo favorito</div><div className="mt-1 text-2xl font-black text-indigo-950">{experienceSummary.favoriteWorld.shortTitle}</div><div className="mt-2 text-sm text-indigo-700">mais jogado até agora</div></div>
              <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Próximo grande marco</div><div className="mt-1 text-2xl font-black text-indigo-950">{nextRewardMilestone ? `${nextRewardMilestone.threshold} ⭐` : 'Tudo desbloqueado'}</div><div className="mt-2 text-sm text-indigo-700">{nextRewardMilestone ? nextRewardMilestone.label : 'coleção completa de marcos'}</div></div>
            </div>
            <div className="mt-5 rounded-[1.8rem] bg-indigo-50 p-4">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Últimos 7 dias</div>
              <div className="mt-4 grid grid-cols-7 gap-2">
                {recentDays.map((day) => (
                  <div key={day.key} className={cn('rounded-2xl p-3 text-center text-xs font-black uppercase tracking-[0.14em]', day.played ? 'bg-indigo-950 text-white' : 'bg-white text-indigo-300')}>
                    <div>{day.shortLabel}</div>
                    <div className="mt-2 text-lg">{day.played ? '⭐' : '·'}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 rounded-[1.8rem] bg-indigo-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Pequenas metas</div>
                  <div className="mt-1 text-lg font-black text-indigo-950">Três próximos passos para manter a jornada viva</div>
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">{nextGoals.filter((goal) => goal.done).length}/3 concluídas</div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {nextGoals.map((goal) => (
                  <div key={goal.key} className={cn('rounded-2xl p-4', goal.done ? 'bg-emerald-100 text-emerald-900' : 'bg-white text-indigo-950')}>
                    <div className="text-xs font-black uppercase tracking-[0.18em] opacity-70">{goal.done ? 'Feita' : 'Em andamento'}</div>
                    <div className="mt-2 text-base font-black">{goal.title}</div>
                    <div className="mt-1 text-sm font-semibold opacity-80">{goal.subtitle}</div>
                    <div className="mt-3 text-xs font-bold uppercase tracking-[0.14em] opacity-70">{goal.progress}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-5 rounded-[1.8rem] bg-indigo-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Passaporte dos mundos</div>
                  <div className="mt-1 text-lg font-black text-indigo-950">Carimbos que mostram onde a criança já ganhou ritmo</div>
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">{worldPassport.filter((entry) => entry.mastered).length} domínio{worldPassport.filter((entry) => entry.mastered).length === 1 ? '' : 's'} fortes</div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {worldPassport.map((entry) => (
                  <div key={entry.world.game} className={cn('rounded-2xl p-4', entry.mastered ? 'bg-indigo-950 text-white' : 'bg-white text-indigo-950')}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-black">{entry.world.shortTitle}</div>
                      <div className="text-2xl">{entry.mastered ? '🏅' : '🧭'}</div>
                    </div>
                    <div className={cn('mt-2 text-xs font-bold uppercase tracking-[0.14em]', entry.mastered ? 'text-white/70' : 'text-indigo-400')}>{entry.completed}/{entry.total} fases concluídas</div>
                    <div className="mt-3"><ProgressBar value={entry.completed} max={entry.total} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Rotas encantadoras</div>
                <h3 className="mt-2 text-2xl font-black text-indigo-950">Mais jeitos de descobrir o conteúdo sem ficar repetitivo</h3>
              </div>
              <button type="button" onClick={handleSurprisePhase} className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-5 py-3 text-sm font-black text-white"><Sparkles className="h-4 w-4" /> Modo surpresa</button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.8rem] bg-indigo-50 p-4">
                <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Continue de onde parou</div>
                <div className="mt-2 text-xl font-black text-indigo-950">{phaseMap[recommendedPhaseId].title}</div>
                <p className="mt-2 text-sm leading-relaxed text-indigo-700">A próxima fase ainda não concluída é a melhor forma de sustentar progresso sem repetir sempre a mesma rotina.</p>
                <button type="button" onClick={() => handlePhaseSelect(recommendedPhaseId)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-indigo-950 px-4 py-2 text-sm font-black text-white"><ArrowRight className="h-4 w-4" /> Abrir agora</button>
              </div>
              <div className="rounded-[1.8rem] bg-indigo-50 p-4">
                <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Pack recomendado</div>
                <div className="mt-2 text-xl font-black text-indigo-950">{resolvedPacks.find((pack) => pack.id === recommendedPackId)?.title ?? 'Trilha inicial'}</div>
                <p className="mt-2 text-sm leading-relaxed text-indigo-700">Seleciona uma coleção já pensada para a idade atual, reduzindo a sensação de escolha caótica para a criança.</p>
                <button type="button" onClick={handleRecommendedPack} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-indigo-950"><WandSparkles className="h-4 w-4" /> Abrir pack</button>
              </div>
              <div className="rounded-[1.8rem] bg-indigo-50 p-4">
                <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Mundo favorito</div>
                <div className="mt-2 text-xl font-black text-indigo-950">{experienceSummary.favoriteWorld.shortTitle}</div>
                <p className="mt-2 text-sm leading-relaxed text-indigo-700">Uma entrada segura para quando a criança quer algo familiar, mas ainda com fases diferentes para sustentar variedade.</p>
                <button type="button" onClick={() => handlePhaseSelect(getFirstPlayablePhaseForWorld(activeProgress, experienceSummary.favoriteWorld.game))} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-indigo-950"><Star className="h-4 w-4" /> Abrir favorito</button>
              </div>
            </div>
            {(breakReminderReached || limitReached) && !pauseCardDismissed && (
              <div className="mt-5 rounded-[1.8rem] bg-yellow-100 p-5 text-yellow-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.18em]">Pausa divertida</div>
                    <div className="mt-2 text-xl font-black">Hora de respirar, alongar e voltar melhor</div>
                  </div>
                  <button type="button" onClick={() => setPauseCardDismissed(true)} className="rounded-full bg-white/70 p-2"><X className="h-4 w-4" /></button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {pauseTips.map((tip) => (
                    <div key={tip} className="rounded-2xl bg-white/70 p-4 text-sm font-bold">{tip}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Missões do dia</div>
                <h3 className="mt-2 text-2xl font-black text-indigo-950">Pequenos objetivos que dão novidade e vontade de voltar</h3>
              </div>
              <div className="rounded-full bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">{missionsClaimed}/3 resgatadas</div>
            </div>
            <div className="mt-5 grid gap-4">
              {dailyMissions.map((mission) => (
                <div key={mission.id} className={cn('rounded-[1.8rem] border p-4', mission.claimed ? 'border-emerald-200 bg-emerald-50' : mission.completed ? 'border-yellow-200 bg-yellow-50' : 'border-indigo-100 bg-indigo-50')}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">{mission.claimed ? 'Resgatada' : mission.completed ? 'Pronta para resgate' : 'Em andamento'}</div>
                      <div className="mt-1 text-lg font-black text-indigo-950">{mission.title}</div>
                      <p className="mt-2 text-sm leading-relaxed text-indigo-700">{mission.description}</p>
                    </div>
                    <div className="rounded-full bg-white px-4 py-2 text-sm font-black text-indigo-900">+{mission.rewardStars} ⭐</div>
                  </div>
                  <div className="mt-4"><ProgressBar value={mission.progress} max={mission.target} /></div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">{mission.progress}/{mission.target} concluído</div>
                    {mission.claimed ? (
                      <div className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Guardada no perfil</div>
                    ) : mission.completed ? (
                      <button type="button" onClick={() => handleClaimMissionReward(mission.id)} className="inline-flex items-center gap-2 rounded-full bg-indigo-950 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white"><Sparkles className="h-4 w-4" /> Resgatar agora</button>
                    ) : (
                      <div className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">Continue brincando</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[1.8rem] bg-indigo-50 p-4 text-sm font-semibold text-indigo-900">Estrelas bônus prontas para resgate agora: <span className="font-black">{readyMissionRewards}</span>. Esta estrutura já deixa a base pronta para sincronizar missões e calendários no Supabase em breve.</div>
          </div>

          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Cofre encantado</div>
                <h3 className="mt-2 text-2xl font-black text-indigo-950">Selos, presentes visuais e recados da guia</h3>
              </div>
              <div className="rounded-full bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">{vaultItems.filter((item) => item.unlocked).length}/{vaultItems.length} itens guardados</div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {vaultItems.map((item) => (
                <div key={item.id} className={cn('rounded-[1.6rem] border p-4', item.unlocked ? 'border-transparent bg-indigo-50 text-indigo-950' : 'border-dashed border-indigo-200 bg-white text-indigo-400')}>
                  <div className="text-3xl">{item.emoji}</div>
                  <div className="mt-2 text-base font-black">{item.title}</div>
                  <div className="mt-2 text-sm leading-relaxed">{item.subtitle}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3">
              {mascotCards.map((card) => (
                <div key={card.title} className="rounded-[1.6rem] bg-indigo-50 p-4">
                  <div className="flex items-center gap-3"><div className="text-2xl">{card.emoji}</div><div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">{card.title}</div></div>
                  <p className="mt-3 text-sm leading-relaxed text-indigo-900">{card.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Mapa de progressão</div>
                <h3 className="mt-2 text-2xl font-black text-indigo-950">Escolha um mundo e a próxima fase</h3>
              </div>
              <button type="button" onClick={() => handlePhaseSelect(recommendedPhaseId)} className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-5 py-3 text-sm font-black text-white"><WandSparkles className="h-4 w-4" /> Próxima recomendada</button>
            </div>
            <div className="mt-6 space-y-4">
              {worlds.map((world) => {
                const Icon = world.icon;
                const gameProgress = activeProgress?.games[world.game] ?? createEmptyGameProgress(world.game);
                const selected = world.game === selectedGame;
                return (
                  <div key={world.game} className={cn('rounded-[1.8rem] border-2 p-5 transition', selected ? 'border-indigo-900 bg-indigo-950 text-white' : 'border-transparent bg-indigo-50')}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn('rounded-2xl bg-gradient-to-br p-3', selected ? 'from-white/20 to-white/10' : world.colorClass)}><Icon className={cn('h-6 w-6', selected ? 'text-white' : 'text-indigo-950')} /></div>
                        <div>
                          <div className={cn('text-xl font-black', selected ? 'text-white' : 'text-indigo-950')}>{world.title}</div>
                          <div className={cn('text-sm', selected ? 'text-white/70' : 'text-indigo-600')}>{world.description}</div>
                        </div>
                      </div>
                      <div className={cn('rounded-full px-3 py-2 text-sm font-black', selected ? 'bg-white/10 text-yellow-300' : 'bg-white text-indigo-900')}>
                        ⭐ {gameProgress.bestStars} / 12
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      {worldPhaseOrder[world.game].map((phaseId, index) => {
                        const state = getPhaseStatus(activeProgress, world.game, phaseId);
                        const isSelectedPhase = phaseId === selectedPhaseId;
                        return (
                          <button key={phaseId} type="button" onClick={() => handlePhaseSelect(phaseId)} className={cn('rounded-[1.3rem] border px-4 py-4 text-left transition', !state.unlocked && 'cursor-not-allowed opacity-45', isSelectedPhase ? 'border-yellow-300 bg-white/15' : selected ? 'border-white/15 bg-white/8' : 'border-transparent bg-white hover:border-indigo-200')}>
                            <div className="flex items-center justify-between gap-2">
                              <div className={cn('text-sm font-black uppercase tracking-[0.18em]', selected ? 'text-white/70' : 'text-indigo-500')}>Fase {index + 1}</div>
                              {state.completions > 0 ? <CheckCircle2 className={cn('h-4 w-4', selected ? 'text-emerald-300' : 'text-emerald-500')} /> : !state.unlocked ? <Lock className={cn('h-4 w-4', selected ? 'text-white/60' : 'text-indigo-400')} /> : null}
                            </div>
                            <div className={cn('mt-2 text-sm font-bold leading-snug', selected ? 'text-white' : 'text-indigo-950')}>{phaseMap[phaseId].title}</div>
                            <div className={cn('mt-3 flex gap-1', selected ? 'text-yellow-300' : 'text-yellow-400')}>
                              {Array.from({ length: Math.max(1, state.bestStars) }, (_, starIndex) => <Star key={`${phaseId}-${starIndex}`} className="h-4 w-4 fill-current" />)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Guia e conquistas</div>
            <h3 className="mt-2 text-2xl font-black text-indigo-950">Estelinha acompanha, celebra e mostra o próximo brilho</h3>
            <div className="mt-5 rounded-[2rem] bg-indigo-50 p-5">
              <div className="flex items-center gap-3"><div className="rounded-2xl bg-pink-100 p-3"><Sparkles className="h-6 w-6 text-pink-500" /></div><div><div className="text-lg font-black text-indigo-950">Estelinha</div><div className="text-sm text-indigo-600">Guia da fase ativa</div></div></div>
              <p className="mt-4 text-sm leading-relaxed text-indigo-900">{mascotMessage}</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Fase ativa</div><div className="mt-1 text-lg font-black text-indigo-950">{selectedPhase.title}</div><div className="mt-2 text-sm text-indigo-700">{selectedPhase.description}</div></div>
              <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Estrelas na fase</div><div className="mt-1 text-3xl font-black text-indigo-950">{currentPhaseState.bestStars}</div><div className="mt-2 text-sm text-indigo-700">Melhor desempenho salvo</div></div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Título atual</div><div className="mt-1 text-2xl font-black text-indigo-950">{experienceSummary.rank}</div><div className="mt-2 text-sm text-indigo-700">Nome simbólico para a evolução da criança dentro do app.</div></div>
              <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Próxima grande recompensa</div><div className="mt-1 text-2xl font-black text-indigo-950">{nextRewardMilestone ? getRewardEmoji(nextRewardMilestone.label) : '🎉'}</div><div className="mt-2 text-sm text-indigo-700">{nextRewardMilestone ? `${nextRewardMilestone.label} com ${nextRewardMilestone.threshold} estrelas.` : 'Todos os marcos já foram alcançados.'}</div></div>
            </div>
            <div className="mt-5 rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Rodízio inteligente</div>
                  <div className="mt-1 text-xl font-black text-indigo-950">{varietyInsight.title}</div>
                </div>
                <div className={cn('rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.18em]', varietyBonusReady ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700')}>{varietyBonusReady ? 'bônus pronto' : 'bônus já usado hoje'}</div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-indigo-800">{varietyInsight.text}</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Mundo sugerido</div><div className="mt-2 text-lg font-black text-indigo-950">{varietyInsight.world.shortTitle}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Próxima fase</div><div className="mt-2 text-lg font-black text-indigo-950">{phaseMap[varietyInsight.phaseId].title}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Vantagem</div><div className="mt-2 text-lg font-black text-indigo-950">+1 estrela bônus</div></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={() => handlePhaseSelect(varietyInsight.phaseId)} className="inline-flex items-center gap-2 rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"><WandSparkles className="h-4 w-4" /> Ir para o rodízio</button>
                <button type="button" onClick={handleSurprisePhase} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100"><Sparkles className="h-4 w-4" /> Modo surpresa</button>
              </div>
            </div>
            <div className="mt-5 rounded-[2rem] bg-indigo-50 p-5">
              <div className="flex items-center justify-between gap-3"><div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Álbum de conquistas</div><div className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">{activeProgress?.unlockedRewards.length ?? 0} desbloqueadas</div></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {rewardGallery.map((reward) => (
                  <div key={`${reward.label}-${reward.unlocked ? 'on' : 'off'}`} className={cn('rounded-[1.4rem] border p-4 text-left', reward.unlocked ? 'border-transparent bg-white text-indigo-950' : 'border-dashed border-indigo-200 bg-white/40 text-indigo-400')}>
                    <div className="text-2xl">{reward.unlocked ? getRewardEmoji(reward.label) : '🔒'}</div>
                    <div className="mt-2 text-sm font-black leading-snug">{reward.label}</div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em]">{reward.unlocked ? 'desbloqueada' : 'próxima meta'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {celebration && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/55 p-4 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.92, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 18 }} className="w-full max-w-xl rounded-[2.2rem] bg-white p-6 shadow-2xl shadow-indigo-900/30">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Fase concluída</div>
                    <h3 className="mt-2 text-3xl font-black text-indigo-950">{celebration.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-indigo-700">A Estelinha registrou sua vitória e guardou tudo no perfil ativo.</p>
                  </div>
                  <button type="button" onClick={() => setCelebration(null)} className="rounded-full bg-indigo-50 p-2 text-indigo-700"><X className="h-4 w-4" /></button>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-2xl">
                  {['🎉', '✨', '🌟', '🎈', '🏆', '💫'].map((item) => <span key={item} className="rounded-full bg-indigo-50 px-3 py-1">{item}</span>)}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.6rem] bg-pink-50 p-4 text-center"><div className="text-xs font-black uppercase tracking-[0.18em] text-pink-500">Estrelas</div><div className="mt-2 text-4xl font-black text-pink-600">{celebration.stars}</div></div>
                  <div className="rounded-[1.6rem] bg-indigo-50 p-4 text-center"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Pontuação</div><div className="mt-2 text-4xl font-black text-indigo-950">{celebration.score}</div></div>
                  <div className="rounded-[1.6rem] bg-yellow-50 p-4 text-center"><div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">Recompensa</div><div className="mt-2 text-3xl">{getRewardEmoji(celebration.reward)}</div><div className="mt-2 text-sm font-black text-yellow-800">{celebration.reward}</div></div>
                </div>
                <div className="mt-5 rounded-[1.8rem] bg-indigo-50 p-4">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Resultado da rodada</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-indigo-900">{celebration.unlockedNow ? 'Nova fase desbloqueada para continuar a aventura.' : 'Seu melhor resultado foi comparado e salvo automaticamente.'}</div>
                    <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-indigo-900">{celebration.unlockedCount > 0 ? `${celebration.unlockedCount} nova(s) conquista(s) entrou(aram) no álbum.` : 'Continue jogando para encher ainda mais o álbum de conquistas.'}</div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {celebration.nextPhaseId && <button type="button" onClick={() => { setSelectedPhaseId(celebration.nextPhaseId as string); setCelebration(null); }} className="inline-flex items-center gap-2 rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"><ArrowRight className="h-4 w-4" /> Próxima fase</button>}
                  <button type="button" onClick={() => { handlePhaseSelect(varietyInsight.phaseId); setCelebration(null); }} className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-5 py-3 text-sm font-black text-white"><WandSparkles className="h-4 w-4" /> Rodízio inteligente</button>
                  <button type="button" onClick={() => setCelebration(null)} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100"><Play className="h-4 w-4" /> Continuar aqui</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {onboardingOpen && activeProfile && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-indigo-950/45 p-4 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.96, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 18 }} className="w-full max-w-2xl rounded-[2.2rem] bg-white p-6 shadow-2xl shadow-indigo-900/30">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Primeira aventura</div>
                    <h3 className="mt-2 text-3xl font-black text-indigo-950">Tudo pronto para {activeProfile.name} começar</h3>
                    <p className="mt-3 text-sm leading-relaxed text-indigo-700">A entrada ficou mais acolhedora: escolha uma rota simples, curta e segura para a primeira sessão.</p>
                  </div>
                  <button type="button" onClick={dismissOnboarding} className="rounded-full bg-indigo-50 p-2 text-indigo-700"><X className="h-4 w-4" /></button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-2xl">{activeProfile.avatar}</div><div className="mt-2 text-lg font-black text-indigo-950">Perfil pronto</div><p className="mt-2 text-sm leading-relaxed text-indigo-700">Avatar {activeProfile.avatar} e companheiro {activeProfile.buddy} já estão preparados.</p></div>
                  <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-2xl">🎯</div><div className="mt-2 text-lg font-black text-indigo-950">Missões leves</div><p className="mt-2 text-sm leading-relaxed text-indigo-700">As missões do dia ajudam a manter variedade sem cansar a criança.</p></div>
                  <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-2xl">🎁</div><div className="mt-2 text-lg font-black text-indigo-950">Cofre visual</div><p className="mt-2 text-sm leading-relaxed text-indigo-700">Cada mundo rende selos e presentes que dão sensação de continuidade.</p></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={() => { dismissOnboarding(); handlePhaseSelect(recommendedPhaseId); }} className="inline-flex items-center gap-2 rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"><Play className="h-4 w-4" /> Começar pela próxima fase</button>
                  <button type="button" onClick={() => { dismissOnboarding(); handleRecommendedPack(); }} className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-5 py-3 text-sm font-black text-white"><WandSparkles className="h-4 w-4" /> Abrir pack sugerido</button>
                  <button type="button" onClick={dismissOnboarding} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100"><ArrowRight className="h-4 w-4" /> Explorar depois</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Biblioteca de packs</div>
              <h3 className="mt-2 text-2xl font-black text-indigo-950">Coleções prontas por idade e por tema</h3>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-indigo-700">Os packs organizam as mesmas 84 fases em trilhas mais claras para pais, escola e retenção do produto. Em vez de apenas navegar por mundos, agora você também pode abrir jornadas prontas como letras, números, animais, espaço e coordenação.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleRecommendedPack} className="inline-flex items-center gap-2 rounded-full bg-pink-500 px-5 py-3 text-sm font-black text-white"><WandSparkles className="h-4 w-4" /> Pack recomendado</button>
              <button type="button" onClick={openSelectedPackNextPhase} className="inline-flex items-center gap-2 rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"><ArrowRight className="h-4 w-4" /> Abrir próxima fase do pack</button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {resolvedPacks.map((pack) => {
              const summary = getPackProgressSummary(pack.phaseIds, activeProgress);
              const isSelected = pack.id === selectedPack.id;
              const isRecommended = pack.id === recommendedPackId;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => handlePackSelect(pack.id)}
                  className={cn('rounded-[1.8rem] border p-5 text-left transition', isSelected ? 'border-indigo-950 bg-indigo-950 text-white shadow-xl shadow-indigo-200/70' : 'border-indigo-100 bg-white hover:border-indigo-300')}
                >
                  <div className={cn('inline-flex rounded-2xl bg-gradient-to-br px-3 py-2 text-xs font-black uppercase tracking-[0.18em]', isSelected ? 'from-white/20 to-white/10 text-white' : pack.accentClass + ' text-indigo-950')}>
                    {pack.ageLabel}
                  </div>
                  <div className={cn('mt-4 text-lg font-black', isSelected ? 'text-white' : 'text-indigo-950')}>{pack.title}</div>
                  <div className={cn('mt-1 text-sm font-semibold', isSelected ? 'text-white/70' : 'text-indigo-500')}>{pack.themeLabel}</div>
                  <p className={cn('mt-3 text-sm leading-relaxed', isSelected ? 'text-white/80' : 'text-indigo-700')}>{pack.description}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className={cn('rounded-2xl p-3', isSelected ? 'bg-white/10' : 'bg-indigo-50')}><div className={cn('text-[11px] font-black uppercase tracking-[0.18em]', isSelected ? 'text-white/60' : 'text-indigo-400')}>Fases</div><div className="mt-1 text-xl font-black">{pack.phaseIds.length}</div></div>
                    <div className={cn('rounded-2xl p-3', isSelected ? 'bg-white/10' : 'bg-indigo-50')}><div className={cn('text-[11px] font-black uppercase tracking-[0.18em]', isSelected ? 'text-white/60' : 'text-indigo-400')}>Feitas</div><div className="mt-1 text-xl font-black">{summary.completed}</div></div>
                    <div className={cn('rounded-2xl p-3', isSelected ? 'bg-white/10' : 'bg-indigo-50')}><div className={cn('text-[11px] font-black uppercase tracking-[0.18em]', isSelected ? 'text-white/60' : 'text-indigo-400')}>⭐</div><div className="mt-1 text-xl font-black">{summary.stars}</div></div>
                  </div>
                  {isRecommended && <div className={cn('mt-4 rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.18em]', isSelected ? 'bg-pink-400/25 text-pink-100' : 'bg-pink-50 text-pink-600')}>Recomendado para a idade atual</div>}
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
            <div className="rounded-[2rem] bg-indigo-50 p-5">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Pack ativo</div>
              <h4 className="mt-2 text-2xl font-black text-indigo-950">{selectedPack.title}</h4>
              <div className="mt-2 text-sm font-semibold text-indigo-500">{selectedPack.ageLabel} · {selectedPack.themeLabel}</div>
              <p className="mt-4 text-sm leading-relaxed text-indigo-800">{selectedPack.mascotTip}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Fases desbloqueadas</div><div className="mt-1 text-3xl font-black text-indigo-950">{selectedPackSummary.unlocked} / {selectedPack.phaseIds.length}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Fases concluídas</div><div className="mt-1 text-3xl font-black text-indigo-950">{selectedPackSummary.completed}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Estrelas do pack</div><div className="mt-1 text-3xl font-black text-indigo-950">{selectedPackSummary.stars}</div></div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {selectedPack.featureBullets.map((bullet) => (
                  <span key={bullet} className="rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-indigo-900">{bullet}</span>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-indigo-100 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Fases do pack</div>
                  <div className="mt-1 text-xl font-black text-indigo-950">Coleção organizada por mundos</div>
                </div>
                <div className="rounded-full bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">{selectedPackWorlds.length} mundo{selectedPackWorlds.length === 1 ? '' : 's'} no pack</div>
              </div>
              <div className="mt-5 space-y-4">
                {selectedPackWorlds.map((game) => {
                  const world = worldByGame[game];
                  const packPhaseIds = selectedPack.phaseIds.filter((phaseId) => getGameForPhase(phaseId) === game);
                  return (
                    <div key={game} className="rounded-[1.6rem] bg-indigo-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-lg font-black text-indigo-950">{world.shortTitle}</div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">{packPhaseIds.length} fases</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {packPhaseIds.map((phaseId) => {
                          const state = getPhaseStatus(activeProgress, game, phaseId);
                          const isSelectedPhase = phaseId === selectedPhaseId;
                          return (
                            <button
                              key={phaseId}
                              type="button"
                              onClick={() => handlePhaseSelect(phaseId)}
                              className={cn('rounded-full px-4 py-2 text-left text-xs font-black uppercase tracking-[0.14em] transition', !state.unlocked && 'cursor-not-allowed opacity-45', isSelectedPhase ? 'bg-indigo-950 text-white' : state.completions > 0 ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-900')}
                            >
                              {phaseMap[phaseId].title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div key={selectedPhaseId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {renderSelectedGame()}
            </motion.div>
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {celebration && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/55 p-4 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.92, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 18 }} className="w-full max-w-xl rounded-[2.2rem] bg-white p-6 shadow-2xl shadow-indigo-900/30">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Fase concluída</div>
                    <h3 className="mt-2 text-3xl font-black text-indigo-950">{celebration.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-indigo-700">A Estelinha registrou sua vitória e guardou tudo no perfil ativo.</p>
                  </div>
                  <button type="button" onClick={() => setCelebration(null)} className="rounded-full bg-indigo-50 p-2 text-indigo-700"><X className="h-4 w-4" /></button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-[1.6rem] bg-pink-50 p-4 text-center"><div className="text-xs font-black uppercase tracking-[0.18em] text-pink-500">Estrelas</div><div className="mt-2 text-4xl font-black text-pink-600">{celebration.stars}</div></div>
                  <div className="rounded-[1.6rem] bg-indigo-50 p-4 text-center"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Pontuação</div><div className="mt-2 text-4xl font-black text-indigo-950">{celebration.score}</div></div>
                  <div className="rounded-[1.6rem] bg-yellow-50 p-4 text-center"><div className="text-xs font-black uppercase tracking-[0.18em] text-yellow-600">Recompensa</div><div className="mt-2 text-3xl">{getRewardEmoji(celebration.reward)}</div><div className="mt-2 text-sm font-black text-yellow-800">{celebration.reward}</div></div>
                </div>
                <div className="mt-5 rounded-[1.8rem] bg-indigo-50 p-4">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Resultado da rodada</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-indigo-900">{celebration.unlockedNow ? 'Nova fase desbloqueada para continuar a aventura.' : 'Seu melhor resultado foi comparado e salvo automaticamente.'}</div>
                    <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-indigo-900">{celebration.unlockedCount > 0 ? `${celebration.unlockedCount} nova(s) conquista(s) entrou(aram) no álbum.` : 'Continue jogando para encher ainda mais o álbum de conquistas.'}</div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {celebration.nextPhaseId && <button type="button" onClick={() => { setSelectedPhaseId(celebration.nextPhaseId as string); setCelebration(null); }} className="inline-flex items-center gap-2 rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white"><ArrowRight className="h-4 w-4" /> Próxima fase</button>}
                  <button type="button" onClick={() => setCelebration(null)} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100"><Play className="h-4 w-4" /> Continuar aqui</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-8 rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Resumo do perfil ativo</div>
              <h3 className="mt-2 text-2xl font-black text-indigo-950">Continuidade, rotina e encantamento já visíveis</h3>
            </div>
            {activeProfile && <div className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-900">Perfil atual: {activeProfile.name}</div>}
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Estrelas totais</div><div className="mt-1 text-3xl font-black text-indigo-950">{activeProgress?.totalStars ?? 0}</div></div>
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Fases concluídas</div><div className="mt-1 text-3xl font-black text-indigo-950">{activeProgress ? worlds.reduce((sum, world) => sum + worldPhaseOrder[world.game].filter((phaseId) => activeProgress.games[world.game].phases[phaseId].completions > 0).length, 0) : 0}</div></div>
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Tempo total</div><div className="mt-1 text-3xl font-black text-indigo-950">{formatDuration(activeProgress?.totalPlayTimeSeconds ?? 0)}</div></div>
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Mundo ativo</div><div className="mt-1 text-2xl font-black text-indigo-950">{worldByGame[selectedGame].shortTitle}</div></div>
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Sequência</div><div className="mt-1 text-3xl font-black text-indigo-950">{experienceSummary.streak}</div></div>
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-sm font-bold text-indigo-500">Título atual</div><div className="mt-1 text-2xl font-black text-indigo-950">{experienceSummary.rank}</div></div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Temporadas e eventos</div>
                <h3 className="mt-2 text-2xl font-black text-indigo-950">Novidade recorrente sem mexer na lógica central dos jogos</h3>
              </div>
              <div className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-900">Catálogo dinâmico · base preparada</div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {resolvedEvents.map((event) => {
                const progressCount = getSeasonProgress(activeProgress, event);
                const claimed = profileSeasonClaims.includes(event.id);
                const ready = progressCount >= event.targetCompletions;
                const world = worldByGame[event.world];
                return (
                  <div key={event.id} className="rounded-[1.8rem] border border-indigo-100 p-5">
                    <div className={cn('inline-flex rounded-2xl bg-gradient-to-br px-4 py-3 text-2xl text-white', event.palette)}>{event.emoji}</div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">{event.monthRange}</div>
                        <div className="mt-1 text-xl font-black text-indigo-950">{event.title}</div>
                      </div>
                      <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-indigo-700">{world.shortTitle}</div>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-indigo-700">{event.subtitle}</p>
                    <div className="mt-4 rounded-2xl bg-indigo-50 p-4">
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold text-indigo-900">
                        <span>Progresso do evento</span>
                        <span>{Math.min(progressCount, event.targetCompletions)}/{event.targetCompletions}</span>
                      </div>
                      <div className="mt-3"><ProgressBar value={Math.min(progressCount, event.targetCompletions)} max={event.targetCompletions} /></div>
                      <div className="mt-3 text-xs font-semibold text-indigo-700">Prêmio: {event.rewardLabel} + {event.rewardStars} estrelas bônus</div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSelectedPhaseId(getFirstPlayablePhaseForWorld(activeProgress, event.world))} className="rounded-full bg-indigo-950 px-4 py-2 text-sm font-black text-white">Abrir mundo</button>
                      <button type="button" onClick={() => claimSeasonEvent(event.id)} disabled={!ready || claimed} className={cn('rounded-full px-4 py-2 text-sm font-black', claimed ? 'bg-emerald-100 text-emerald-700' : ready ? 'bg-pink-500 text-white' : 'bg-slate-100 text-slate-500')}>
                        {claimed ? 'Resgatado' : ready ? 'Resgatar selo' : 'Em progresso'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Recompensas visuais por mundo</div>
            <h3 className="mt-2 text-2xl font-black text-indigo-950">Cada trilha agora tem um medalhão próprio</h3>
            <div className="mt-5 grid gap-3">
              {worldMedals.map((entry) => (
                <div key={entry.world.game} className="rounded-[1.6rem] bg-indigo-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-lg font-black text-indigo-950">{entry.world.shortTitle}</div>
                      <div className="mt-1 text-sm font-semibold text-indigo-600">{entry.progress.completed}/{worldPhaseOrder[entry.world.game].length} fases concluídas · {entry.progress.stars} estrelas neste mundo</div>
                    </div>
                    <div className={cn('rounded-full px-3 py-2 text-sm font-black', entry.color)}>{entry.medal} {entry.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Trilha semanal para pais</div>
            <h3 className="mt-2 text-2xl font-black text-indigo-950">Uma semana simples para transformar progresso em rotina saudável</h3>
            <div className="mt-5 grid gap-3">
              {activeWeeklyTrack.map((item) => (
                <div key={item.day} className="rounded-[1.6rem] bg-indigo-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">{item.day}</div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700">Ritmo leve</div>
                  </div>
                  <div className="mt-2 text-lg font-black text-indigo-950">{item.title}</div>
                  <div className="mt-3 text-sm font-semibold text-indigo-900">Tela: <span className="font-medium text-indigo-700">{item.screen}</span></div>
                  <div className="mt-2 text-sm font-semibold text-indigo-900">Fora da tela: <span className="font-medium text-indigo-700">{item.offline}</span></div>
                  <div className="mt-2 text-sm font-semibold text-indigo-900">Objetivo: <span className="font-medium text-indigo-700">{item.goal}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
            <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Preparação para Supabase</div>
            <h3 className="mt-2 text-2xl font-black text-indigo-950">Biblioteca dinâmica já desenhada para a próxima virada</h3>
            <div className="mt-4 rounded-[1.8rem] bg-indigo-50 p-5">
              <div className="text-sm font-semibold leading-relaxed text-indigo-800">{dynamicContentBlueprint.note}</div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Packs</div><div className="mt-2 text-sm font-black text-indigo-950">{dynamicContentBlueprint.entities.packs}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Fases do pack</div><div className="mt-2 text-sm font-black text-indigo-950">{dynamicContentBlueprint.entities.packPhases}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Eventos</div><div className="mt-2 text-sm font-black text-indigo-950">{dynamicContentBlueprint.entities.seasonalEvents}</div></div>
                <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Trilhas semanais</div><div className="mt-2 text-sm font-black text-indigo-950">{dynamicContentBlueprint.entities.weeklyTracks}</div></div>
              </div>
              <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-indigo-800">Quando você decidir ativar o Supabase para conteúdo dinâmico, a base já estará organizada para trocar coleções, temporadas e trilhas sem reescrever a lógica principal do app.</div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-[2.25rem] bg-white p-6 shadow-[0_24px_80px_rgba(79,70,229,0.10)]">
          <input ref={catalogImportRef} type="file" accept="application/json" onChange={handleCatalogImportFile} className="hidden" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Estúdio de conteúdo</div>
              <h3 className="mt-2 text-2xl font-black text-indigo-950">Infraestrutura + catálogo dinâmico prontos para a ativação V16</h3>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-indigo-700">Agora a base premium consegue validar ambiente, sincronizar progresso, carregar catálogo remoto e publicar packs, eventos e trilhas semanais com fallback local preservado.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={checkInfrastructureNow} className="rounded-full bg-white px-4 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100">Verificar infraestrutura</button>
              <button type="button" onClick={() => setContentStudioOpen((current) => !current)} className="rounded-full bg-indigo-950 px-5 py-3 text-sm font-black text-white">{contentStudioOpen ? 'Fechar estúdio' : 'Abrir estúdio'}</button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Status do catálogo</div><div className="mt-2 text-lg font-black text-indigo-950">{catalogMessage}</div><div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-500">status: {catalogStatus}</div></div>
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Manifesto</div><div className="mt-2 text-lg font-black text-indigo-950">v{catalogManifestVersion}</div></div>
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Origem atual</div><div className="mt-2 text-lg font-black text-indigo-950">{catalogSource === 'remote' ? 'Remoto ativo' : catalogSource === 'draft' ? 'Pré-visualização local' : dynamicContentEnabled() ? 'Fallback local' : 'Somente local'}</div></div>
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Última atualização</div><div className="mt-2 text-sm font-black text-indigo-950">{catalogUpdatedAt ? new Date(catalogUpdatedAt).toLocaleString('pt-BR') : 'Ainda local'}</div></div>
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Infra</div><div className="mt-2 text-lg font-black text-indigo-950">{infraMessage}</div><div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-500">status: {infraStatus}</div></div>
            <div className="rounded-[1.6rem] bg-indigo-50 p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Validação</div><div className="mt-2 text-lg font-black text-indigo-950">{studioValidation.ok ? 'Rascunho válido' : 'Revisão necessária'}</div><div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-500">packs {studioValidation.counts.packs} · eventos {studioValidation.counts.events} · trilhas {studioValidation.counts.tracks}</div></div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={refreshDynamicCatalog} className="rounded-full bg-white px-4 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100">Atualizar do servidor</button>
            <button type="button" onClick={seedCatalogDraft} className="rounded-full bg-white px-4 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100">Carregar catálogo atual no editor</button>
            <button type="button" onClick={loadRemoteCatalogIntoStudio} className="rounded-full bg-white px-4 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100">Carregar remoto no editor</button>
            <button type="button" onClick={exportCatalogBundle} className="rounded-full bg-white px-4 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100">Baixar pacote JSON</button>
            <button type="button" onClick={openCatalogImport} className="rounded-full bg-white px-4 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100">Importar pacote JSON</button>
            <button type="button" onClick={() => { setDynamicPacks(fallbackContentPacks); setDynamicEvents(fallbackSeasonalEvents); setDynamicWeeklyTracks(fallbackParentWeeklyTracks); setCatalogStatus('idle'); setCatalogMessage('Catálogo local restaurado'); setCatalogManifestVersion(dynamicContentBlueprint.version); setCatalogSource('local'); seedCatalogDraft(); }} className="rounded-full bg-white px-4 py-3 text-sm font-black text-indigo-950 ring-1 ring-indigo-100">Restaurar catálogo local</button>
          </div>

          {contentStudioOpen && (
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-4">
                <div className="rounded-[1.8rem] bg-indigo-50 p-5">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Publicação simples</div>
                  <h4 className="mt-2 text-xl font-black text-indigo-950">Pronto para Netlify + Supabase</h4>
                  <p className="mt-3 text-sm leading-relaxed text-indigo-700">Cole um token administrativo temporário do Netlify para publicar o catálogo. Enquanto isso, você pode testar tudo localmente com a pré-visualização e exportar/importar pacotes únicos.</p>
                  <input value={adminToken} onChange={(event) => setAdminToken(event.target.value)} placeholder="CONTENT_ADMIN_TOKEN" className="mt-4 w-full rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-950 outline-none ring-0" />
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-indigo-800">Status do admin: <span className="font-black text-indigo-950">{adminMessage}</span><div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-500">status: {adminStatus}</div></div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={previewCatalogDraft} className="rounded-full bg-indigo-950 px-4 py-3 text-sm font-black text-white">Pré-visualizar localmente</button>
                    <button type="button" onClick={requestPublishCatalog} className="rounded-full bg-pink-500 px-4 py-3 text-sm font-black text-white">Publicar no Supabase</button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Packs</div><div className="mt-2 text-2xl font-black text-indigo-950">{resolvedPacks.length}</div></div>
                    <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Eventos</div><div className="mt-2 text-2xl font-black text-indigo-950">{resolvedEvents.length}</div></div>
                    <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Trilhas</div><div className="mt-2 text-2xl font-black text-indigo-950">{resolvedWeeklyTracks.length}</div></div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-indigo-800">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Última publicação remota</div>
                    <div className="mt-2 text-lg font-black text-indigo-950">{lastPublicationSummary?.publishedAt ? new Date(lastPublicationSummary.publishedAt).toLocaleString('pt-BR') : 'Ainda não registrada'}</div>
                    <div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-500">manifesto {lastPublicationSummary?.manifestVersion ?? catalogManifestVersion}</div>
                    <div className="mt-3 text-xs font-semibold text-indigo-700">{lastPublicationSummary?.counts ? `packs ${lastPublicationSummary.counts.packs} · eventos ${lastPublicationSummary.counts.events} · trilhas ${lastPublicationSummary.counts.tracks}` : 'Sem histórico remoto carregado neste momento.'}</div>
                  </div>
                </div>

                <div className="rounded-[1.8rem] bg-indigo-50 p-5">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Saúde da infraestrutura</div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Netlify Functions</div><div className="mt-2 text-lg font-black text-indigo-950">{infraSnapshot?.netlifyFunctions ? 'Ativas' : 'Aguardando teste'}</div></div>
                    <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Supabase</div><div className="mt-2 text-lg font-black text-indigo-950">{infraSnapshot?.supabaseConfigured ? (infraSnapshot.supabaseReachable ? 'Configurado e acessível' : 'Configurado, revisar acesso') : 'Ainda não configurado'}</div></div>
                    <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Cloud save</div><div className="mt-2 text-lg font-black text-indigo-950">{infraSnapshot?.cloudSyncEnabled ? 'Pronto para nuvem' : 'Desativado no build'}</div></div>
                    <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Token admin</div><div className="mt-2 text-lg font-black text-indigo-950">{infraSnapshot?.adminTokenConfigured ? 'Configurado' : 'Pendente'}</div></div>
                    <div className="rounded-2xl bg-white p-4"><div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Publicações</div><div className="mt-2 text-lg font-black text-indigo-950">{infraSnapshot?.catalogPublicationsReady ? 'Tabela pronta' : 'Schema pendente'}</div></div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-white p-4 text-sm font-semibold text-indigo-800">
                    {infraSnapshot?.warnings.length ? (
                      <ul className="space-y-2">
                        {infraSnapshot.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                      </ul>
                    ) : 'Sem alertas. O ambiente está coerente para a etapa Netlify + Supabase.'}
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.8rem] bg-indigo-50 p-5">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Editor JSON · packs</div>
                  <textarea value={catalogDraft.packs} onChange={(event) => setCatalogDraft((current) => ({ ...current, packs: event.target.value }))} className="mt-3 h-44 w-full rounded-2xl border border-indigo-200 bg-white p-4 text-xs font-semibold text-indigo-950 outline-none" />
                </div>
                <div className="rounded-[1.8rem] bg-indigo-50 p-5">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Editor JSON · eventos</div>
                  <textarea value={catalogDraft.events} onChange={(event) => setCatalogDraft((current) => ({ ...current, events: event.target.value }))} className="mt-3 h-36 w-full rounded-2xl border border-indigo-200 bg-white p-4 text-xs font-semibold text-indigo-950 outline-none" />
                </div>
                <div className="rounded-[1.8rem] bg-indigo-50 p-5">
                  <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Editor JSON · trilhas semanais</div>
                  <textarea value={catalogDraft.tracks} onChange={(event) => setCatalogDraft((current) => ({ ...current, tracks: event.target.value }))} className="mt-3 h-36 w-full rounded-2xl border border-indigo-200 bg-white p-4 text-xs font-semibold text-indigo-950 outline-none" />
                </div>
              </div>
            </div>
          )}
        </div>

        <AnimatePresence>
          {parentGate && <ParentGateModal gate={parentGate} onClose={() => setParentGate(null)} />}
        </AnimatePresence>

        <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
          <AnimatePresence>
            {toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

const AgeTracksSection = () => (
  <section id="idades" className="px-4 py-24">
    <div className="mx-auto max-w-7xl rounded-[3rem] border border-white/70 bg-white/68 p-8 shadow-[0_34px_120px_rgba(79,70,229,0.10)] backdrop-blur-xl md:p-10">
      <SectionTitle badge="Faixas etárias" title="Cada idade continua com um caminho adequado, mas agora com apresentação muito mais convidativa" text="A estrutura por idade permanece essencial. O redesign visual apenas reforça a leitura, a segurança pedagógica e a sensação de progressão coerente para 4, 5, 6 e 7 anos." />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {ageTracks.map((track, index) => (
          <div key={track.age} className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(79,70,229,0.08)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">{track.age}</div>
              <div className="text-2xl">{['🧸','🔤','🔢','🚀'][index] ?? '⭐'}</div>
            </div>
            <p className="mt-4 leading-relaxed text-slate-700">{track.content}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const SafetySection = () => (
  <section id="seguranca" className="px-4 py-24">
    <div className="mx-auto max-w-7xl">
      <SectionTitle badge="Segurança e confiança" title="Uma experiência lúdica para a criança e tranquila para os pais" text="Além do redesign visual, o app mantém proteção parental, controle de tempo, pausas, progressão supervisionada e uma linguagem visual que transmite mais ordem, cuidado e qualidade percebida." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {safetyItems.map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-[1.8rem] border border-white/70 bg-white/86 p-5 shadow-[0_18px_50px_rgba(79,70,229,0.08)] backdrop-blur-xl">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] bg-[linear-gradient(135deg,#10b981,#22d3ee)] text-white shadow-[0_12px_30px_rgba(16,185,129,0.20)]"><ShieldCheck className="h-5 w-5" /></div>
            <div className="font-semibold text-slate-800">{item}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const TestimonialsSection = () => (
  <section className="px-4 py-24">
    <div className="mx-auto max-w-7xl rounded-[3rem] border border-white/70 bg-white/68 p-8 shadow-[0_34px_120px_rgba(79,70,229,0.10)] backdrop-blur-xl md:p-10">
      <SectionTitle badge="Percepção de valor" title="O redesign reforça a qualidade percebida do app para crianças, pais e apresentação comercial" text="Agora a mesma base funcional parece mais próxima de um produto premium real. Isso melhora confiança, desejo, clareza de navegação e potencial comercial." />
      <div className="grid gap-5 md:grid-cols-3">
        {(testimonials as TestimonialProps[]).map((item, index) => (
          <div key={item.name} className="rounded-[2rem] border border-white/70 bg-white/88 p-6 shadow-[0_18px_50px_rgba(79,70,229,0.08)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">{item.role}</div>
              <div className="text-xl">{['💛','✨','🎯'][index] ?? '⭐'}</div>
            </div>
            <div className="mt-3 text-xl font-black text-slate-950">{item.name}</div>
            <p className="mt-4 leading-relaxed text-slate-700">“{item.text}”</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const FAQItem = ({ q, a }: FAQItemProps) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[1.8rem] bg-white p-5 shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
        <span className="text-lg font-black text-indigo-950">{q}</span>
        <ChevronDown className={cn('h-5 w-5 text-indigo-500 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-4 overflow-hidden leading-relaxed text-indigo-800">
            {a}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
};

const FAQSection = () => (
  <section className="px-4 py-24">
    <div className="mx-auto max-w-5xl rounded-[3rem] border border-white/70 bg-white/68 p-8 shadow-[0_34px_120px_rgba(79,70,229,0.10)] backdrop-blur-xl md:p-10">
      <SectionTitle badge="Perguntas frequentes" title="O que mudou com o redesign premium" text="As respostas abaixo mostram como a nova camada visual melhora a experiência sem perder a base funcional já construída." />
      <div className="grid gap-4">
        {(faqData as FAQItemProps[]).map((item) => <FAQItem key={item.q} {...item} />)}
      </div>
    </div>
  </section>
);

const OfferSection = () => (
  <section className="px-4 py-24">
    <div className="mx-auto max-w-7xl overflow-hidden rounded-[3rem] bg-[linear-gradient(135deg,#1d4ed8_0%,#4338ca_28%,#7c3aed_58%,#ec4899_82%,#fb923c_100%)] p-8 text-white shadow-[0_30px_100px_rgba(79,70,229,0.28)] md:p-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.82fr] lg:items-center">
        <div>
          <div className="inline-flex rounded-full bg-white/14 px-4 py-2 text-sm font-black uppercase tracking-[0.2em] text-yellow-200">Escopo premium entregue</div>
          <h2 className="mt-5 text-3xl font-black leading-tight md:text-5xl">Uma base funcional de verdade, agora com visual muito mais próximo de um produto premium infantil</h2>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/82">Esta versão atualizada une minijogos reais, perfis, mapa, packs, missões, eventos, recompensas, painel dos pais e um redesign visual muito mais alinhado à direção artística premium que definimos como alvo.</p>
        </div>
        <div className="rounded-[2.2rem] border border-white/10 bg-white/10 p-6 backdrop-blur-sm">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-white/70">Checklist desta entrega</div>
          <div className="mt-4 space-y-3">
            {['Home completamente redesenhada', 'Mapa e cards com visual premium', 'Base funcional preservada', 'Feedback visual mais forte', 'Pais, missões, eventos e recompensas', 'Pronta para próxima etapa com infraestrutura'].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3 text-sm font-semibold text-white"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> {item}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </section>
);

const Footer = () => (
  <footer className="px-4 pb-12 pt-6 text-slate-900">
    <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[2.4rem] border border-white/70 bg-white/72 px-6 py-8 shadow-[0_24px_70px_rgba(79,70,229,0.10)] backdrop-blur-xl md:flex-row md:items-center md:justify-between">
      <div>
        <div className="text-xl font-black">Escola Divertida</div>
        <div className="mt-2 max-w-xl text-sm text-slate-600">Projeto infantil com front-end redesenhado, minijogos reais, progressão por fase, packs curados, missões, eventos e base pronta para a próxima integração com Netlify + Supabase.</div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
        <a href="#metodo">Método</a>
        <a href="#mapa">Mapa</a>
        <a href="#minijogos">Jogar</a>
        <a href="#seguranca">Pais</a>
      </div>
    </div>
  </footer>
);

const FloatingCTA = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > 640);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.a href="#minijogos" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="fixed bottom-5 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#4f46e5_0%,#7c3aed_52%,#ec4899_100%)] px-6 py-4 text-center text-sm font-black text-white shadow-[0_20px_60px_rgba(99,102,241,0.32)] md:hidden">
          Abrir versão redesenhada
          <ArrowRight className="h-4 w-4" />
        </motion.a>
      )}
    </AnimatePresence>
  );
};

const App = () => (
  <div className="premium-app min-h-screen text-slate-900">
    <style>{`.clip-triangle{clip-path:polygon(50% 0%, 0% 100%, 100% 100%);}`}</style>
    <TopNavbar />
    <Hero />
    <HighlightStrip />
    <MethodSection />
    <WorldsCatalog />
    <MiniGamesSection />
    <AgeTracksSection />
    <SafetySection />
    <TestimonialsSection />
    <FAQSection />
    <OfferSection />
    <Footer />
    <FloatingCTA />
  </div>
);

export default App;
