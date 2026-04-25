import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import {
  AudioLines,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  Gift,
  Home,
  Layers3,
  Map,
  Menu,
  Play,
  ShieldCheck,
  UserRound,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from './utils/cn';
import { dynamicContentEnabled, fetchDynamicCatalog } from './lib/dynamicContent';
import { fetchInfrastructureHealth } from './lib/infraHealth';
import { getOrCreateDeviceId, safeReadStorage, writeStorage } from './lib/storage';
import {
  ageTracks,
  alphabetPools,
  avatarOptions,
  buddyOptions,
  colorBuckets,
  colorItems,
  contentPacks as fallbackPacks,
  faqData,
  memoryThemePools,
  methodologyCards,
  parentWeeklyTracks as fallbackTracks,
  phaseMap,
  profileAccentPalette,
  rewardMilestones,
  seasonalEvents as fallbackEvents,
  shapeLibrary,
  worlds,
  worldPhaseOrder,
} from './data/gameContent';
import type {
  AlphabetPhase,
  ChildProfile,
  ColorBucketId,
  ColorsPhase,
  ContentPack,
  GameKey,
  GamePhase,
  MathPhase,
  MazePhase,
  MemoryPhase,
  ParentWeeklyTrack,
  PuzzlePhase,
  SeasonalEvent,
  ShapePhase,
} from './data/gameContent';
import type { InfrastructureHealthPayload } from './lib/infraHealth';

type PanelKey = 'home' | 'packs' | 'events' | 'tracks' | 'map' | 'play' | 'rewards' | 'parents' | 'profile';

type MiniProgress = {
  plays: number;
  bestStars: number;
  bestScore: number;
  completed: boolean;
  updatedAt: string;
};

type ProgressMap = Record<string, MiniProgress>;

type Toast = {
  id: number;
  tone: 'success' | 'info' | 'warning';
  title: string;
  text: string;
};

type PackCard = ContentPack & {
  colorA: string;
  colorB: string;
  illustration: string;
};

type ViewState = {
  panel: PanelKey;
  title: string;
  subtitle: string;
};

type GameView = {
  phaseId: string;
  sourceLabel: string;
};

type NavItem = {
  key: PanelKey;
  label: string;
  shortLabel: string;
  icon: ElementType;
  accent: string;
  description: string;
};

const STORAGE_KEYS = {
  profiles: 'edv16-profiles-ui',
  progress: 'edv16-progress-ui',
  activeProfileId: 'edv16-active-profile-ui',
  sound: 'edv16-sound-ui',
  legacyProfiles: 'escola-v6-profiles',
  legacyProgress: 'escola-v6-progress',
  legacyActive: 'escola-v6-active-profile',
};

const packGradientPool = [
  ['#FF8FB1', '#FFC56E'],
  ['#6EE7F9', '#7C83FD'],
  ['#7EE081', '#C6F36A'],
  ['#C79BFF', '#FF9CE6'],
  ['#6EE7B7', '#7DD3FC'],
  ['#FDBA74', '#FB7185'],
  ['#A5B4FC', '#F9A8D4'],
  ['#93C5FD', '#5EEAD4'],
];

const packIllustrations = ['🦊', '🚀', '🧠', '🌈', '🐠', '🐮', '🏰', '🧩', '❄️', '🎪', '📚', '🏆'];

const worldIllustrations: Record<GameKey, string> = {
  memory: '🦉',
  alphabet: '🔤',
  math: '🔢',
  shape: '🔷',
  colors: '🎨',
  maze: '🧭',
  puzzle: '🧩',
};

const worldAccent: Record<GameKey, string> = {
  memory: 'from-amber-300 to-pink-300',
  alphabet: 'from-yellow-300 to-orange-300',
  math: 'from-sky-300 to-cyan-300',
  shape: 'from-fuchsia-300 to-rose-300',
  colors: 'from-emerald-300 to-lime-300',
  maze: 'from-teal-300 to-emerald-300',
  puzzle: 'from-violet-300 to-fuchsia-300',
};

const navItems: NavItem[] = [
  { key: 'home', label: 'Início mágico', shortLabel: 'Início', icon: Home, accent: 'from-pink-400 to-orange-300', description: 'Tela principal com atalhos grandes e mascotes.' },
  { key: 'packs', label: 'Packs encantados', shortLabel: 'Packs', icon: Layers3, accent: 'from-violet-400 to-pink-400', description: 'Coleções prontas organizadas por tema e idade.' },
  { key: 'events', label: 'Eventos do dia', shortLabel: 'Eventos', icon: CalendarDays, accent: 'from-amber-400 to-orange-400', description: 'Campanhas sazonais com recompensas especiais.' },
  { key: 'tracks', label: 'Trilhas para pais', shortLabel: 'Trilhas', icon: BookOpen, accent: 'from-emerald-400 to-teal-400', description: 'Planos simples para acompanhar a rotina.' },
  { key: 'map', label: 'Mapa dos mundos', shortLabel: 'Mapa', icon: Map, accent: 'from-sky-400 to-indigo-400', description: 'Seleção de mundos e fases com navegação visual.' },
  { key: 'play', label: 'Jogar agora', shortLabel: 'Jogar', icon: Gamepad2, accent: 'from-fuchsia-400 to-violet-400', description: 'Entrada rápida para partidas simples e divertidas.' },
  { key: 'rewards', label: 'Tesouro de estrelas', shortLabel: 'Tesouro', icon: Gift, accent: 'from-yellow-400 to-amber-400', description: 'Recompensas, metas e progresso visível.' },
  { key: 'parents', label: 'Painel da família', shortLabel: 'Pais', icon: Users, accent: 'from-cyan-400 to-blue-400', description: 'Resumo amigável para adultos sem bagunça.' },
  { key: 'profile', label: 'Meu personagem', shortLabel: 'Perfil', icon: UserRound, accent: 'from-rose-400 to-fuchsia-400', description: 'Avatar, faixa etária e preferências da criança.' },
];

const panelMeta: Record<PanelKey, ViewState> = {
  home: { panel: 'home', title: 'Bem-vindo ao mundo da diversão', subtitle: 'Escolha grande, navegação simples e jogos que abrem em janelas flutuantes.' },
  packs: { panel: 'packs', title: 'Packs encantados', subtitle: 'Coleções prontas para começar sem confusão.' },
  events: { panel: 'events', title: 'Eventos especiais', subtitle: 'Campanhas com brilho, objetivos claros e prêmio visível.' },
  tracks: { panel: 'tracks', title: 'Trilhas da família', subtitle: 'Planos curtos para brincar e aprender com leveza.' },
  map: { panel: 'map', title: 'Mapa dos mundos', subtitle: 'Cada mundo tem sua própria aventura, com fases grandes e botões fáceis.' },
  play: { panel: 'play', title: 'Jogar agora', subtitle: 'Entre rápido em um pack, em um mundo ou na última fase aberta.' },
  rewards: { panel: 'rewards', title: 'Tesouro de estrelas', subtitle: 'Veja medalhas, metas e recompensas em um painel claro.' },
  parents: { panel: 'parents', title: 'Painel da família', subtitle: 'Resumo prático para adultos sem linguagem técnica cansativa.' },
  profile: { panel: 'profile', title: 'Meu personagem', subtitle: 'Troque avatar, amigo e idade com um visual mais divertido.' },
};

const createProfile = (index = 0): ChildProfile => ({
  id: `perfil-${Date.now()}`,
  name: 'Pequeno Explorador',
  age: 5,
  accent: profileAccentPalette[index % profileAccentPalette.length] ?? 'from-pink-400 to-rose-400',
  avatar: avatarOptions[index % avatarOptions.length]?.emoji ?? '🦊',
  buddy: buddyOptions[index % buddyOptions.length]?.emoji ?? '⭐',
  mascotTheme: 'classic',
  createdAt: new Date().toISOString(),
});

const createProgress = (): MiniProgress => ({
  plays: 0,
  bestStars: 0,
  bestScore: 0,
  completed: false,
  updatedAt: new Date().toISOString(),
});

const normalizePacks = (packs: ContentPack[]): PackCard[] =>
  packs.map((pack, index) => ({
    ...pack,
    colorA: packGradientPool[index % packGradientPool.length][0],
    colorB: packGradientPool[index % packGradientPool.length][1],
    illustration: packIllustrations[index % packIllustrations.length],
  }));

const packToGameKeys = (pack: ContentPack): GameKey[] => {
  const set = new Set<GameKey>();
  pack.phaseIds.forEach((phaseId) => {
    const phase = phaseMap[phaseId];
    if (phase) set.add(phase.game);
  });
  return Array.from(set);
};

const sumStars = (progressMap: ProgressMap) => Object.values(progressMap).reduce((acc, item) => acc + item.bestStars, 0);

const sumCompleted = (progressMap: ProgressMap) => Object.values(progressMap).filter((item) => item.completed).length;

const mapHashToPanel = (hash: string): PanelKey => {
  const clean = hash.replace('#', '').toLowerCase();
  if (['packs'].includes(clean)) return 'packs';
  if (['eventos', 'events'].includes(clean)) return 'events';
  if (['trilhas', 'tracks'].includes(clean)) return 'tracks';
  if (['mapa', 'map'].includes(clean)) return 'map';
  if (['jogar', 'play'].includes(clean)) return 'play';
  if (['recompensas', 'rewards'].includes(clean)) return 'rewards';
  if (['pais', 'parents'].includes(clean)) return 'parents';
  if (['perfil', 'profile'].includes(clean)) return 'profile';
  return 'home';
};

const panelToHash = (panel: PanelKey) => {
  if (panel === 'home') return '';
  const table: Record<Exclude<PanelKey, 'home'>, string> = {
    packs: 'packs',
    events: 'eventos',
    tracks: 'trilhas',
    map: 'mapa',
    play: 'jogar',
    rewards: 'recompensas',
    parents: 'pais',
    profile: 'perfil',
  };
  return `#${table[panel as Exclude<PanelKey, 'home'>]}`;
};

const sampleFrom = <T,>(list: T[], count: number) => {
  const clone = [...list];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone.slice(0, count);
};

const ensureProgressShape = (phaseId: string, progressMap: ProgressMap): MiniProgress => progressMap[phaseId] ?? createProgress();

const loadLegacyProgress = (): ProgressMap => {
  const modern = safeReadStorage<ProgressMap>(STORAGE_KEYS.progress, {});
  if (Object.keys(modern).length) return modern;
  const legacyRaw = safeReadStorage<Record<string, any>>(STORAGE_KEYS.legacyProgress, {});
  const firstProfile = Object.values(legacyRaw ?? {})[0] as any;
  if (!firstProfile?.games) return {};
  const normalized: ProgressMap = {};
  (Object.keys(firstProfile.games) as GameKey[]).forEach((game) => {
    const phases = firstProfile.games?.[game]?.phases ?? {};
    Object.entries<any>(phases).forEach(([phaseId, item]) => {
      normalized[phaseId] = {
        plays: Number(item?.plays ?? 0),
        bestStars: Number(item?.bestStars ?? 0),
        bestScore: Number(item?.bestScore ?? 0),
        completed: Number(item?.completions ?? 0) > 0 || Number(item?.bestStars ?? 0) > 0,
        updatedAt: new Date().toISOString(),
      };
    });
  });
  return normalized;
};

const worldCompletionCount = (world: GameKey, progressMap: ProgressMap) =>
  worldPhaseOrder[world].filter((phaseId) => progressMap[phaseId]?.completed).length;

const worldStarCount = (world: GameKey, progressMap: ProgressMap) =>
  worldPhaseOrder[world].reduce((acc, phaseId) => acc + (progressMap[phaseId]?.bestStars ?? 0), 0);

const nextUnlockedPhaseId = (world: GameKey, progressMap: ProgressMap) => {
  const ids = worldPhaseOrder[world];
  for (let i = 0; i < ids.length; i += 1) {
    if (i === 0) return ids[0];
    if (progressMap[ids[i - 1]]?.completed && !progressMap[ids[i]]?.completed) return ids[i];
  }
  return ids.find((phaseId) => !progressMap[phaseId]?.completed) ?? ids[0];
};

const isPhaseUnlocked = (phaseId: string, progressMap: ProgressMap) => {
  const phase = phaseMap[phaseId];
  if (!phase) return false;
  const ids = worldPhaseOrder[phase.game];
  const index = ids.indexOf(phaseId);
  if (index <= 0) return true;
  return Boolean(progressMap[ids[index - 1]]?.completed);
};

const progressTone = (value: number, total: number) => {
  const ratio = total ? value / total : 0;
  if (ratio >= 0.75) return 'is-great';
  if (ratio >= 0.45) return 'is-good';
  return 'is-soft';
};

function App() {
  const [profiles, setProfiles] = useState<ChildProfile[]>(() => {
    const modern = safeReadStorage<ChildProfile[]>(STORAGE_KEYS.profiles, []);
    const legacy = safeReadStorage<ChildProfile[]>(STORAGE_KEYS.legacyProfiles, []);
    const source = modern.length ? modern : legacy;
    return source.length ? source : [createProfile(0)];
  });
  const [activeProfileId, setActiveProfileId] = useState<string>(() => safeReadStorage(STORAGE_KEYS.activeProfileId, safeReadStorage(STORAGE_KEYS.legacyActive, '')));
  const [progressMap, setProgressMap] = useState<ProgressMap>(() => loadLegacyProgress());
  const [panel, setPanel] = useState<PanelKey>(() => mapHashToPanel(typeof window !== 'undefined' ? window.location.hash : ''));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gameView, setGameView] = useState<GameView | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string>('');
  const [selectedWorld, setSelectedWorld] = useState<GameKey>('memory');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [catalogPacks, setCatalogPacks] = useState<PackCard[]>(() => normalizePacks(fallbackPacks));
  const [catalogEvents, setCatalogEvents] = useState<SeasonalEvent[]>(fallbackEvents);
  const [catalogTracks, setCatalogTracks] = useState<ParentWeeklyTrack[]>(fallbackTracks);
  const [catalogUpdatedAt, setCatalogUpdatedAt] = useState<string | null>(null);
  const [catalogSource, setCatalogSource] = useState<'local' | 'remote'>('local');
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(() => safeReadStorage<boolean>(STORAGE_KEYS.sound, true));
  const [infra, setInfra] = useState<InfrastructureHealthPayload | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [deviceId] = useState(() => getOrCreateDeviceId('edv16-device'));

  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0], [profiles, activeProfileId]);

  const filteredTracks = useMemo(
    () => catalogTracks.filter((track) => activeProfile.age >= track.ageMin && activeProfile.age <= track.ageMax),
    [catalogTracks, activeProfile.age],
  );

  const filteredPacks = useMemo(
    () => catalogPacks.filter((pack) => pack.recommendedAges.includes(activeProfile.age)),
    [catalogPacks, activeProfile.age],
  );

  const selectedPack = useMemo(
    () => filteredPacks.find((pack) => pack.id === selectedPackId) ?? filteredPacks[0] ?? catalogPacks[0] ?? null,
    [filteredPacks, selectedPackId, catalogPacks],
  );

  const selectedTrack = useMemo(
    () => filteredTracks.find((track) => track.id === selectedTrackId) ?? filteredTracks[0] ?? catalogTracks[0] ?? null,
    [filteredTracks, selectedTrackId, catalogTracks],
  );

  const totalStars = useMemo(() => sumStars(progressMap), [progressMap]);
  const totalCompleted = useMemo(() => sumCompleted(progressMap), [progressMap]);
  const nextReward = useMemo(
    () => rewardMilestones.find((reward) => reward.threshold > totalStars) ?? rewardMilestones[rewardMilestones.length - 1],
    [totalStars],
  );

  const recommendedWorld = useMemo(() => {
    const tracks = filteredTracks.filter((track) => track.world);
    return tracks[0]?.world ?? selectedPack ? (phaseMap[selectedPack?.phaseIds[0] ?? '']?.game ?? 'memory') : 'memory';
  }, [filteredTracks, selectedPack]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.profiles, profiles);
  }, [profiles]);

  useEffect(() => {
    if (activeProfile) {
      writeStorage(STORAGE_KEYS.activeProfileId, activeProfile.id);
    }
  }, [activeProfile]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.progress, progressMap);
  }, [progressMap]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.sound, soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    const hash = panelToHash(panel);
    if (typeof window !== 'undefined') {
      if (hash) {
        window.history.replaceState(null, '', hash);
      } else {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [panel]);

  useEffect(() => {
    if (selectedPack && !selectedPackId) setSelectedPackId(selectedPack.id);
  }, [selectedPack, selectedPackId]);

  useEffect(() => {
    if (selectedTrack && !selectedTrackId) setSelectedTrackId(selectedTrack.id);
  }, [selectedTrack, selectedTrackId]);

  useEffect(() => {
    let cancelled = false;
    const loadCatalog = async () => {
      setLoadingCatalog(true);
      if (dynamicContentEnabled()) {
        const response = await fetchDynamicCatalog();
        if (!cancelled && response.ok && response.payload) {
          setCatalogPacks(normalizePacks(response.payload.contentPacks));
          setCatalogEvents(response.payload.seasonalEvents);
          setCatalogTracks(response.payload.parentWeeklyTracks);
          setCatalogUpdatedAt(response.updatedAt ?? null);
          setCatalogSource('remote');
          setLoadingCatalog(false);
          return;
        }
      }
      if (!cancelled) {
        setCatalogPacks(normalizePacks(fallbackPacks));
        setCatalogEvents(fallbackEvents);
        setCatalogTracks(fallbackTracks);
        setCatalogUpdatedAt(null);
        setCatalogSource('local');
        setLoadingCatalog(false);
      }
    };
    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchInfrastructureHealth().then((response) => {
      if (!cancelled && response.ok && response.payload) setInfra(response.payload);
    });
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  const pushToast = (tone: Toast['tone'], title: string, text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, tone, title, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3800);
  };

  const handleGameComplete = (phaseId: string, stars: number, score: number) => {
    setProgressMap((current) => ({
      ...current,
      [phaseId]: {
        plays: (current[phaseId]?.plays ?? 0) + 1,
        bestStars: Math.max(current[phaseId]?.bestStars ?? 0, stars),
        bestScore: Math.max(current[phaseId]?.bestScore ?? 0, score),
        completed: true,
        updatedAt: new Date().toISOString(),
      },
    }));
    pushToast('success', 'Missão concluída!', `Você ganhou ${stars} estrelas nesta fase.`);
  };

  const handleGamePlayed = (phaseId: string) => {
    setProgressMap((current) => ({
      ...current,
      [phaseId]: {
        ...ensureProgressShape(phaseId, current),
        plays: (current[phaseId]?.plays ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      },
    }));
  };

  const featuredPack = selectedPack ?? filteredPacks[0] ?? catalogPacks[0] ?? null;
  const featuredTrack = selectedTrack ?? filteredTracks[0] ?? catalogTracks[0] ?? null;
  const latestEvent = catalogEvents[0] ?? null;

  return (
    <div className="kid-shell">
      <FloatingDecor />
      <SidebarNav panel={panel} setPanel={setPanel} drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} profile={activeProfile} />

      <div className="kid-main">
        <TopBar
          profile={activeProfile}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          onOpenMenu={() => setDrawerOpen(true)}
          onOpenPlay={() => setPanel('play')}
        />

        <main className="kid-content">
          <HomeDashboard
            profile={activeProfile}
            totalStars={totalStars}
            totalCompleted={totalCompleted}
            nextRewardLabel={nextReward.label}
            featuredPack={featuredPack}
            latestEvent={latestEvent}
            featuredTrack={featuredTrack}
            recommendedWorld={recommendedWorld}
            infra={infra}
            catalogSource={catalogSource}
            catalogUpdatedAt={catalogUpdatedAt}
            loadingCatalog={loadingCatalog}
            progressMap={progressMap}
            onOpenPanel={setPanel}
            onQuickPlay={(phaseId, sourceLabel) => setGameView({ phaseId, sourceLabel })}
          />
        </main>
      </div>

      <AnimatePresence>
        {panel !== 'home' && (
          <FloatingWindow title={panelMeta[panel].title} subtitle={panelMeta[panel].subtitle} onClose={() => setPanel('home')}>
            {panel === 'packs' && (
              <PacksPanel
                packs={filteredPacks.length ? filteredPacks : catalogPacks}
                activeAge={activeProfile.age}
                progressMap={progressMap}
                selectedPackId={selectedPack?.id ?? ''}
                onSelectPack={setSelectedPackId}
                onPlayPhase={(phaseId, sourceLabel) => setGameView({ phaseId, sourceLabel })}
              />
            )}
            {panel === 'events' && <EventsPanel events={catalogEvents} progressMap={progressMap} />}
            {panel === 'tracks' && <TracksPanel tracks={filteredTracks.length ? filteredTracks : catalogTracks} onPlayPhase={(phaseId, sourceLabel) => setGameView({ phaseId, sourceLabel })} />}
            {panel === 'map' && <MapPanel progressMap={progressMap} onPlayPhase={(phaseId, sourceLabel) => setGameView({ phaseId, sourceLabel })} onSelectWorld={setSelectedWorld} selectedWorld={selectedWorld} />}
            {panel === 'play' && (
              <PlayPanel
                packs={filteredPacks.length ? filteredPacks : catalogPacks}
                progressMap={progressMap}
                selectedWorld={selectedWorld}
                setSelectedWorld={setSelectedWorld}
                onPlayPhase={(phaseId, sourceLabel) => setGameView({ phaseId, sourceLabel })}
              />
            )}
            {panel === 'rewards' && <RewardsPanel progressMap={progressMap} totalStars={totalStars} totalCompleted={totalCompleted} />}
            {panel === 'parents' && <ParentsPanel profile={activeProfile} tracks={filteredTracks.length ? filteredTracks : catalogTracks} infra={infra} />}
            {panel === 'profile' && <ProfilePanel profiles={profiles} activeProfileId={activeProfile.id} onSetActive={setActiveProfileId} onUpdateProfiles={setProfiles} />}
          </FloatingWindow>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameView && (
          <FloatingWindow title={phaseMap[gameView.phaseId]?.title ?? 'Fase'} subtitle={gameView.sourceLabel} onClose={() => setGameView(null)} wide>
            <GameStage
              phase={phaseMap[gameView.phaseId]}
              progress={progressMap[gameView.phaseId] ?? createProgress()}
              soundEnabled={soundEnabled}
              onPlayed={() => handleGamePlayed(gameView.phaseId)}
              onComplete={(stars, score) => handleGameComplete(gameView.phaseId, stars, score)}
            />
          </FloatingWindow>
        )}
      </AnimatePresence>

      <ToastLayer toasts={toasts} />
    </div>
  );
}

type SidebarNavProps = {
  panel: PanelKey;
  setPanel: (panel: PanelKey) => void;
  drawerOpen: boolean;
  setDrawerOpen: (value: boolean) => void;
  profile: ChildProfile;
};

function SidebarNav({ panel, setPanel, drawerOpen, setDrawerOpen, profile }: SidebarNavProps) {
  return (
    <>
      <aside className="kid-sidebar desktop-only">
        <SidebarContent panel={panel} setPanel={setPanel} profile={profile} closeDrawer={() => undefined} />
      </aside>
      <AnimatePresence>
        {drawerOpen && (
          <motion.div className="drawer-backdrop mobile-only" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerOpen(false)}>
            <motion.aside
              className="kid-sidebar mobile-sheet"
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
            >
              <SidebarContent panel={panel} setPanel={setPanel} profile={profile} closeDrawer={() => setDrawerOpen(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

type SidebarContentProps = {
  panel: PanelKey;
  setPanel: (panel: PanelKey) => void;
  profile: ChildProfile;
  closeDrawer: () => void;
};

function SidebarContent({ panel, setPanel, profile, closeDrawer }: SidebarContentProps) {
  return (
    <div className="sidebar-inner">
      <div className="brand-badge">
        <motion.div className="brand-orb" animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 6, repeat: Infinity }}>
          ✨
        </motion.div>
        <div>
          <strong>Escola Divertida</strong>
          <span>Menu mágico da criança</span>
        </div>
      </div>

      <div className="sidebar-profile-card">
        <div className="sidebar-avatar">{profile.avatar}</div>
        <div>
          <strong>{profile.name}</strong>
          <span>{profile.age} anos · {profile.buddy}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.key === panel;
          return (
            <button
              type="button"
              key={item.key}
              className={cn('sidebar-nav-item', active && 'is-active')}
              onClick={() => {
                setPanel(item.key);
                closeDrawer();
              }}
            >
              <span className={cn('sidebar-icon', item.accent)}>
                <Icon size={20} />
              </span>
              <span className="sidebar-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer-card">
        <p>Toque em qualquer opção para abrir uma janela grande e fácil de usar.</p>
        <div className="sidebar-stars">🌟 🦊 🎨 🚀</div>
      </div>
    </div>
  );
}

type TopBarProps = {
  profile: ChildProfile;
  soundEnabled: boolean;
  setSoundEnabled: (value: boolean) => void;
  onOpenMenu: () => void;
  onOpenPlay: () => void;
};

function TopBar({ profile, soundEnabled, setSoundEnabled, onOpenMenu, onOpenPlay }: TopBarProps) {
  return (
    <header className="kid-topbar">
      <div className="topbar-left">
        <button type="button" className="circle-button mobile-only" onClick={onOpenMenu} aria-label="Abrir menu">
          <Menu size={20} />
        </button>
        <div className="topbar-title">
          <div className="title-icon">{profile.avatar}</div>
          <div>
            <strong>Olá, {profile.name}!</strong>
            <span>Escolha uma aventura brilhante para começar.</span>
          </div>
        </div>
      </div>
      <div className="topbar-actions">
        <button type="button" className="circle-button" onClick={() => setSoundEnabled(!soundEnabled)} aria-label="Alternar som">
          {soundEnabled ? <AudioLines size={18} /> : <ShieldCheck size={18} />}
        </button>
        <button type="button" className="play-pill" onClick={onOpenPlay}>
          <Play size={18} /> Abrir aventuras
        </button>
      </div>
    </header>
  );
}

type HomeDashboardProps = {
  profile: ChildProfile;
  totalStars: number;
  totalCompleted: number;
  nextRewardLabel: string;
  featuredPack: PackCard | null;
  latestEvent: SeasonalEvent | null;
  featuredTrack: ParentWeeklyTrack | null;
  recommendedWorld: GameKey;
  infra: InfrastructureHealthPayload | null;
  catalogSource: 'local' | 'remote';
  catalogUpdatedAt: string | null;
  loadingCatalog: boolean;
  progressMap: ProgressMap;
  onOpenPanel: (panel: PanelKey) => void;
  onQuickPlay: (phaseId: string, sourceLabel: string) => void;
};

function HomeDashboard({
  profile,
  totalStars,
  totalCompleted,
  nextRewardLabel,
  featuredPack,
  latestEvent,
  featuredTrack,
  recommendedWorld,
  infra,
  catalogSource,
  catalogUpdatedAt,
  loadingCatalog,
  progressMap,
  onOpenPanel,
  onQuickPlay,
}: HomeDashboardProps) {
  const world = worlds.find((item) => item.game === recommendedWorld) ?? worlds[0];
  const nextPhaseId = nextUnlockedPhaseId(world.game, progressMap);
  const worldProgress = worldCompletionCount(world.game, progressMap);

  return (
    <div className="dashboard-stack">
      <section className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow-chip">✨ Navegação infantil premium</span>
          <h1>Menu lateral, janelas flutuantes e aventuras fáceis de abrir</h1>
          <p>
            Agora o app mostra menos texto técnico e mais botões claros, ilustrações, mascotes e atalhos grandes.
            Cada área abre em uma janela própria para a criança não se perder.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-big-button" onClick={() => onOpenPanel('play')}>
              <Play size={20} /> Jogar agora
            </button>
            <button type="button" className="secondary-big-button" onClick={() => onOpenPanel('packs')}>
              <Layers3 size={20} /> Ver packs
            </button>
          </div>
          <div className="hero-stats-grid">
            <StatBubble label="Estrelas" value={String(totalStars)} tone="pink" />
            <StatBubble label="Fases prontas" value={String(totalCompleted)} tone="blue" />
            <StatBubble label="Próximo prêmio" value={nextRewardLabel} tone="gold" compact />
          </div>
        </div>
        <div className="hero-visual">
          <motion.div className="hero-mascot-card" animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity }}>
            <div className="mascot-sky">{profile.avatar}</div>
            <div className="mascot-copy">
              <strong>{profile.name}</strong>
              <span>{profile.buddy} pronto para brincar</span>
            </div>
          </motion.div>
          <div className="hero-mini-worlds">
            {worlds.slice(0, 4).map((item, index) => (
              <motion.div
                key={item.game}
                className={cn('mini-world-card', worldAccent[item.game])}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * index }}
              >
                <span>{worldIllustrations[item.game]}</span>
                <strong>{item.shortTitle}</strong>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="quick-grid">
        <QuickLaunchCard
          icon={Gamepad2}
          title="Abrir fase recomendada"
          text={`Seu próximo passo no ${world.shortTitle} já está pronto.`}
          actionLabel="Abrir fase"
          accent="from-fuchsia-400 to-violet-400"
          onClick={() => onQuickPlay(nextPhaseId, `Fase recomendada · ${world.title}`)}
        />
        <QuickLaunchCard
          icon={Layers3}
          title={featuredPack?.title ?? 'Packs encantados'}
          text={featuredPack?.description ?? 'Coleções prontas por idade e tema.'}
          actionLabel="Ver packs"
          accent="from-amber-400 to-orange-400"
          onClick={() => onOpenPanel('packs')}
        />
        <QuickLaunchCard
          icon={CalendarDays}
          title={latestEvent?.title ?? 'Eventos especiais'}
          text={latestEvent?.subtitle ?? 'Campanhas com recompensa e brilho.'}
          actionLabel="Ver eventos"
          accent="from-sky-400 to-cyan-400"
          onClick={() => onOpenPanel('events')}
        />
      </section>

      <section className="dashboard-panels-grid">
        <div className="kid-panel card-panel wide">
          <div className="panel-heading-row">
            <SectionHeading eyebrow="Meu momento" title="Tudo em blocos fáceis para a criança" icon={<WandSparkles size={20} />} />
            <span className={cn('status-pill', catalogSource === 'remote' ? 'is-remote' : 'is-local')}>
              {loadingCatalog ? 'Carregando catálogo…' : catalogSource === 'remote' ? 'Catálogo V6 ativo' : 'Catálogo local'}
            </span>
          </div>
          <div className="icon-story-grid">
            <StoryCard emoji="🧭" title="Escolher" text="Toque no menu lateral e abra a janela que quiser." />
            <StoryCard emoji="🎮" title="Brincar" text="Cada fase abre numa janela grande, sem bagunça na tela." />
            <StoryCard emoji="🌟" title="Ganhar" text="As estrelas aparecem de forma clara e premiam o esforço." />
            <StoryCard emoji="👨‍👩‍👧" title="Acompanhar" text="Pais veem trilhas e progresso sem linguagem técnica pesada." />
          </div>
          <div className="home-meta-bar">
            <span>Atualização do catálogo: {catalogUpdatedAt ? new Date(catalogUpdatedAt).toLocaleString('pt-BR') : 'modo local'}</span>
            <span>Infraestrutura: {infra?.supabaseReachable ? 'conectada' : 'checando'}</span>
          </div>
        </div>
        <div className="kid-panel card-panel">
          <SectionHeading eyebrow="Atalho brilhante" title="Trilha recomendada" icon={<BookOpen size={20} />} />
          {featuredTrack ? (
            <div className="track-highlight-card">
              <strong>{featuredTrack.title}</strong>
              <p>{featuredTrack.description}</p>
              <ul>
                {featuredTrack.days.slice(0, 3).map((day) => (
                  <li key={day.day}><span>{day.day}</span>{day.title}</li>
                ))}
              </ul>
              <button type="button" className="mini-pill-button" onClick={() => onOpenPanel('tracks')}>Abrir trilha</button>
            </div>
          ) : (
            <EmptyMessage text="Nenhuma trilha carregada para esta idade." />
          )}
        </div>
      </section>

      <section className="dashboard-panels-grid">
        <div className="kid-panel card-panel">
          <SectionHeading eyebrow="Mapa favorito" title={world.title} icon={<Map size={20} />} />
          <div className="world-preview-card">
            <div className="world-preview-header">
              <span className="world-preview-emoji">{worldIllustrations[world.game]}</span>
              <div>
                <strong>{world.shortTitle}</strong>
                <p>{world.description}</p>
              </div>
            </div>
            <div className="progress-mini-grid">
              <ProgressBubble label="Fases prontas" value={`${worldProgress}/12`} tone={progressTone(worldProgress, 12)} />
              <ProgressBubble label="Próxima fase" value={phaseMap[nextPhaseId]?.title ?? 'Fase 1'} tone="is-good" />
            </div>
            <button type="button" className="mini-pill-button" onClick={() => onOpenPanel('map')}>Abrir mapa</button>
          </div>
        </div>
        <div className="kid-panel card-panel">
          <SectionHeading eyebrow="Brilho e prêmios" title="Tesouro do jogador" icon={<Gift size={20} />} />
          <div className="reward-mini-list">
            {rewardMilestones.slice(0, 4).map((milestone) => (
              <div key={milestone.label} className={cn('reward-mini-card', totalStars >= milestone.threshold && 'is-unlocked')}>
                <span>🏅</span>
                <div>
                  <strong>{milestone.label}</strong>
                  <small>{milestone.threshold} estrelas</small>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="mini-pill-button" onClick={() => onOpenPanel('rewards')}>Abrir tesouro</button>
        </div>
      </section>

      <section className="kid-panel card-panel">
        <SectionHeading eyebrow="Guia para adultos" title="Sem termos técnicos, só orientações claras" icon={<ShieldCheck size={20} />} />
        <div className="parents-soft-grid">
          {methodologyCards.slice(0, 4).map((item, index) => (
            <motion.div key={item.title} className="parent-soft-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * index }}>
              <span className="parent-soft-emoji">{['📦', '🧠', '🛟', '🚀'][index]}</span>
              <strong>{item.title}</strong>
              <p>{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

type FloatingWindowProps = {
  title: string;
  subtitle: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
};

function FloatingWindow({ title, subtitle, onClose, wide, children }: FloatingWindowProps) {
  return (
    <motion.div className="floating-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section
        className={cn('floating-window', wide && 'is-wide')}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 260, damping: 25 }}
      >
        <div className="floating-head">
          <div>
            <span className="eyebrow-chip">🌟 Janela de aventura</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <button type="button" className="circle-button" onClick={onClose} aria-label="Fechar janela">
            <X size={20} />
          </button>
        </div>
        <div className="floating-body">{children}</div>
      </motion.section>
    </motion.div>
  );
}

type PacksPanelProps = {
  packs: PackCard[];
  activeAge: number;
  progressMap: ProgressMap;
  selectedPackId: string;
  onSelectPack: (id: string) => void;
  onPlayPhase: (phaseId: string, sourceLabel: string) => void;
};

function PacksPanel({ packs, activeAge, progressMap, selectedPackId, onSelectPack, onPlayPhase }: PacksPanelProps) {
  const selectedPack = packs.find((pack) => pack.id === selectedPackId) ?? packs[0] ?? null;

  return (
    <div className="window-grid two-columns">
      <div className="panel-column list-column">
        <div className="section-banner">
          <strong>Packs para {activeAge} anos</strong>
          <span>Toque em um pack para ver as fases grandes e coloridas.</span>
        </div>
        <div className="pack-list">
          {packs.map((pack) => {
            const stars = pack.phaseIds.reduce((acc, phaseId) => acc + (progressMap[phaseId]?.bestStars ?? 0), 0);
            return (
              <button type="button" key={pack.id} className={cn('pack-list-item', selectedPack?.id === pack.id && 'is-active')} onClick={() => onSelectPack(pack.id)}>
                <div className="pack-list-emoji" style={{ background: `linear-gradient(135deg, ${pack.colorA}, ${pack.colorB})` }}>{pack.illustration}</div>
                <div>
                  <strong>{pack.title}</strong>
                  <span>{pack.themeLabel} · {pack.ageLabel}</span>
                </div>
                <small>{stars}⭐</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="panel-column detail-column">
        {selectedPack ? (
          <>
            <div className="pack-hero-card" style={{ background: `linear-gradient(135deg, ${selectedPack.colorA}, ${selectedPack.colorB})` }}>
              <span className="pack-hero-emoji">{selectedPack.illustration}</span>
              <div>
                <h3>{selectedPack.title}</h3>
                <p>{selectedPack.description}</p>
              </div>
            </div>
            <div className="chip-row">
              {selectedPack.featureBullets.map((bullet) => (
                <span className="magic-chip" key={bullet}>{bullet}</span>
              ))}
            </div>
            <div className="game-chip-row">
              {packToGameKeys(selectedPack).map((game) => (
                <span key={game} className="game-key-chip">{worldIllustrations[game]} {worlds.find((item) => item.game === game)?.shortTitle}</span>
              ))}
            </div>
            <div className="phase-grid">
              {selectedPack.phaseIds.map((phaseId) => {
                const phase = phaseMap[phaseId];
                if (!phase) return null;
                const progress = progressMap[phaseId];
                return (
                  <button type="button" key={phaseId} className={cn('phase-card', !isPhaseUnlocked(phaseId, progressMap) && 'is-locked')} onClick={() => isPhaseUnlocked(phaseId, progressMap) && onPlayPhase(phaseId, `Pack · ${selectedPack.title}`)}>
                    <span className="phase-card-world">{worldIllustrations[phase.game]}</span>
                    <strong>{phase.title}</strong>
                    <p>{phase.reward}</p>
                    <div className="phase-card-footer">
                      <span>{progress?.bestStars ?? 0}⭐</span>
                      <span>{isPhaseUnlocked(phaseId, progressMap) ? 'Abrir' : 'Bloqueada'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyMessage text="Nenhum pack encontrado para esta faixa etária." />
        )}
      </div>
    </div>
  );
}

type EventsPanelProps = {
  events: SeasonalEvent[];
  progressMap: ProgressMap;
};

function EventsPanel({ events, progressMap }: EventsPanelProps) {
  return (
    <div className="event-grid">
      {events.map((event) => {
        const completions = worldCompletionCount(event.world, progressMap);
        const ratio = Math.min(1, completions / event.targetCompletions);
        return (
          <article key={event.id} className="event-card">
            <div className={cn('event-banner', event.palette)}>
              <span>{event.emoji}</span>
              <div>
                <strong>{event.title}</strong>
                <small>{event.monthRange}</small>
              </div>
            </div>
            <p>{event.subtitle}</p>
            <div className="progress-strip">
              <div className="progress-strip-fill" style={{ width: `${ratio * 100}%` }} />
            </div>
            <div className="event-meta-row">
              <span>{completions}/{event.targetCompletions} missões</span>
              <span>{event.rewardStars}⭐</span>
            </div>
            <div className="event-prize-card">🏆 {event.rewardLabel}</div>
          </article>
        );
      })}
    </div>
  );
}

type TracksPanelProps = {
  tracks: ParentWeeklyTrack[];
  onPlayPhase: (phaseId: string, sourceLabel: string) => void;
};

function TracksPanel({ tracks, onPlayPhase }: TracksPanelProps) {
  const [trackIndex, setTrackIndex] = useState(0);
  const active = tracks[trackIndex] ?? null;
  const suggestedPhase = active?.world ? worldPhaseOrder[active.world][0] : null;

  useEffect(() => {
    setTrackIndex(0);
  }, [tracks.length]);

  if (!active) return <EmptyMessage text="Nenhuma trilha disponível." />;

  return (
    <div className="window-grid two-columns">
      <div className="panel-column list-column">
        {tracks.map((track, index) => (
          <button type="button" key={track.id} className={cn('track-list-item', index === trackIndex && 'is-active')} onClick={() => setTrackIndex(index)}>
            <span>{track.world ? worldIllustrations[track.world] : '🌟'}</span>
            <div>
              <strong>{track.title}</strong>
              <small>{track.ageMin}–{track.ageMax} anos</small>
            </div>
          </button>
        ))}
      </div>
      <div className="panel-column detail-column">
        <div className="track-detail-card">
          <div className="panel-heading-row">
            <SectionHeading eyebrow="Plano da semana" title={active.title} icon={<BookOpen size={20} />} />
            {suggestedPhase && <button type="button" className="mini-pill-button" onClick={() => onPlayPhase(suggestedPhase, `Trilha · ${active.title}`)}>Abrir jogo</button>}
          </div>
          <p>{active.description}</p>
          <div className="weekday-grid">
            {active.days.map((day) => (
              <article key={day.day} className="weekday-card">
                <span className="weekday-pill">{day.day}</span>
                <strong>{day.title}</strong>
                <p>{day.goal}</p>
                <div className="weekday-mini-box">
                  <span>🎮</span>
                  <small>{day.screen}</small>
                </div>
                <div className="weekday-mini-box is-soft">
                  <span>🏡</span>
                  <small>{day.offline}</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type MapPanelProps = {
  progressMap: ProgressMap;
  onPlayPhase: (phaseId: string, sourceLabel: string) => void;
  selectedWorld: GameKey;
  onSelectWorld: (game: GameKey) => void;
};

function MapPanel({ progressMap, onPlayPhase, selectedWorld, onSelectWorld }: MapPanelProps) {
  const world = worlds.find((item) => item.game === selectedWorld) ?? worlds[0];
  return (
    <div className="window-grid two-columns">
      <div className="panel-column list-column world-list-column">
        {worlds.map((item) => {
          const done = worldCompletionCount(item.game, progressMap);
          return (
            <button type="button" key={item.game} className={cn('world-list-item', selectedWorld === item.game && 'is-active')} onClick={() => onSelectWorld(item.game)}>
              <span className="world-list-emoji">{worldIllustrations[item.game]}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{done}/12 fases</small>
              </div>
            </button>
          );
        })}
      </div>
      <div className="panel-column detail-column">
        <div className={cn('world-hero-card', worldAccent[world.game])}>
          <div className="world-hero-copy">
            <span className="world-hero-emoji">{worldIllustrations[world.game]}</span>
            <div>
              <h3>{world.title}</h3>
              <p>{world.description}</p>
            </div>
          </div>
          <div className="progress-mini-grid compact">
            <ProgressBubble label="Fases" value={`${worldCompletionCount(world.game, progressMap)}/12`} tone={progressTone(worldCompletionCount(world.game, progressMap), 12)} />
            <ProgressBubble label="Estrelas" value={`${worldStarCount(world.game, progressMap)}`} tone="is-good" />
          </div>
        </div>
        <div className="phase-grid">
          {worldPhaseOrder[world.game].map((phaseId) => {
            const phase = phaseMap[phaseId];
            const unlocked = isPhaseUnlocked(phaseId, progressMap);
            const progress = progressMap[phaseId];
            return (
              <button key={phaseId} type="button" className={cn('phase-card', !unlocked && 'is-locked')} onClick={() => unlocked && onPlayPhase(phaseId, `Mapa · ${world.title}`)}>
                <span className="phase-card-world">{worldIllustrations[world.game]}</span>
                <strong>{phase.title}</strong>
                <p>{phase.reward}</p>
                <div className="phase-card-footer">
                  <span>{progress?.bestStars ?? 0}⭐</span>
                  <span>{unlocked ? 'Abrir' : 'Bloqueada'}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type PlayPanelProps = {
  packs: PackCard[];
  progressMap: ProgressMap;
  selectedWorld: GameKey;
  setSelectedWorld: (game: GameKey) => void;
  onPlayPhase: (phaseId: string, sourceLabel: string) => void;
};

function PlayPanel({ packs, progressMap, selectedWorld, setSelectedWorld, onPlayPhase }: PlayPanelProps) {
  const randomPack = packs[Math.floor(Math.random() * Math.max(packs.length, 1))] ?? packs[0] ?? null;
  const world = worlds.find((item) => item.game === selectedWorld) ?? worlds[0];
  const nextPhase = nextUnlockedPhaseId(world.game, progressMap);

  return (
    <div className="play-grid">
      <article className="play-launch-card is-primary">
        <span className="big-emoji">{worldIllustrations[world.game]}</span>
        <h3>Continuar de onde parou</h3>
        <p>Entre direto na próxima fase aberta do seu mundo favorito.</p>
        <button type="button" className="primary-big-button" onClick={() => onPlayPhase(nextPhase, `Continuar · ${world.title}`)}>
          <Play size={18} /> Abrir {phaseMap[nextPhase]?.title}
        </button>
      </article>
      <article className="play-launch-card">
        <span className="big-emoji">🎁</span>
        <h3>Modo surpresa</h3>
        <p>Escolhe uma aventura divertida sem a criança precisar procurar demais.</p>
        {randomPack ? <button type="button" className="secondary-big-button" onClick={() => onPlayPhase(randomPack.phaseIds[0], `Modo surpresa · ${randomPack.title}`)}>Surpresa agora</button> : <EmptyMessage text="Sem pack carregado." />}
      </article>
      <article className="play-launch-card wide-card">
        <h3>Escolha um mundo para jogar</h3>
        <div className="world-pill-row">
          {worlds.map((item) => (
            <button type="button" key={item.game} className={cn('world-pill', selectedWorld === item.game && 'is-active')} onClick={() => setSelectedWorld(item.game)}>
              {worldIllustrations[item.game]} {item.shortTitle}
            </button>
          ))}
        </div>
        <div className="play-phase-row">
          {worldPhaseOrder[selectedWorld].slice(0, 6).map((phaseId) => (
            <button type="button" key={phaseId} className={cn('mini-phase-button', !isPhaseUnlocked(phaseId, progressMap) && 'is-locked')} onClick={() => isPhaseUnlocked(phaseId, progressMap) && onPlayPhase(phaseId, `Jogar · ${world.title}`)}>
              <strong>{phaseMap[phaseId].title}</strong>
              <small>{progressMap[phaseId]?.bestStars ?? 0}⭐</small>
            </button>
          ))}
        </div>
      </article>
    </div>
  );
}

type RewardsPanelProps = {
  progressMap: ProgressMap;
  totalStars: number;
  totalCompleted: number;
};

function RewardsPanel({ progressMap, totalStars, totalCompleted }: RewardsPanelProps) {
  return (
    <div className="rewards-layout">
      <div className="reward-summary-banner">
        <StatBubble label="Estrelas coletadas" value={String(totalStars)} tone="gold" />
        <StatBubble label="Fases concluídas" value={String(totalCompleted)} tone="blue" />
        <StatBubble label="Mundos tocados" value={String(worlds.filter((world) => worldCompletionCount(world.game, progressMap) > 0).length)} tone="pink" />
      </div>
      <div className="reward-milestone-grid">
        {rewardMilestones.map((reward) => (
          <div key={reward.label} className={cn('reward-milestone-card', totalStars >= reward.threshold && 'is-unlocked')}>
            <span>🏅</span>
            <strong>{reward.label}</strong>
            <small>{reward.threshold} estrelas</small>
          </div>
        ))}
      </div>
    </div>
  );
}

type ParentsPanelProps = {
  profile: ChildProfile;
  tracks: ParentWeeklyTrack[];
  infra: InfrastructureHealthPayload | null;
};

function ParentsPanel({ profile, tracks, infra }: ParentsPanelProps) {
  const suggestedAgeTrack = ageTracks.find((track) => track.age.startsWith(String(profile.age))) ?? ageTracks[0];
  return (
    <div className="parents-grid">
      <article className="parent-dashboard-card">
        <SectionHeading eyebrow="Resumo rápido" title="O que vale abrir hoje" icon={<Users size={20} />} />
        <div className="parent-soft-card is-strong">
          <strong>{suggestedAgeTrack.age}</strong>
          <p>{suggestedAgeTrack.content}</p>
        </div>
        <div className="parent-mini-grid">
          <div className="parent-mini-card"><strong>{tracks.length}</strong><span>trilhas sugeridas</span></div>
          <div className="parent-mini-card"><strong>{infra?.supabaseReachable ? 'online' : 'checando'}</strong><span>catálogo remoto</span></div>
          <div className="parent-mini-card"><strong>{profile.age} anos</strong><span>faixa ativa</span></div>
        </div>
      </article>
      <article className="parent-dashboard-card">
        <SectionHeading eyebrow="Dicas claras" title="Como usar sem cansar a criança" icon={<ShieldCheck size={20} />} />
        <div className="faq-list compact-faq">
          {faqData.slice(0, 4).map((item) => (
            <div key={item.q} className="faq-card">
              <strong>{item.q}</strong>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

type ProfilePanelProps = {
  profiles: ChildProfile[];
  activeProfileId: string;
  onSetActive: (id: string) => void;
  onUpdateProfiles: (profiles: ChildProfile[]) => void;
};

function ProfilePanel({ profiles, activeProfileId, onSetActive, onUpdateProfiles }: ProfilePanelProps) {
  const active = profiles.find((item) => item.id === activeProfileId) ?? profiles[0];
  const updateActive = (partial: Partial<ChildProfile>) => {
    onUpdateProfiles(profiles.map((profile) => (profile.id === active.id ? { ...profile, ...partial } : profile)));
  };

  return (
    <div className="profile-layout">
      <div className="profile-card-grid">
        {profiles.map((profile) => (
          <button type="button" key={profile.id} className={cn('profile-switch-card', profile.id === active.id && 'is-active')} onClick={() => onSetActive(profile.id)}>
            <span className="profile-switch-avatar">{profile.avatar}</span>
            <div>
              <strong>{profile.name}</strong>
              <small>{profile.age} anos · {profile.buddy}</small>
            </div>
          </button>
        ))}
        <button type="button" className="profile-switch-card add-card" onClick={() => onUpdateProfiles([...profiles, createProfile(profiles.length)])}>
          <span className="profile-switch-avatar">➕</span>
          <div>
            <strong>Novo perfil</strong>
            <small>Adicionar outro jogador</small>
          </div>
        </button>
      </div>
      <div className="profile-editor-card">
        <SectionHeading eyebrow="Editar personagem" title={active.name} icon={<UserRound size={20} />} />
        <label className="editor-field">
          <span>Nome</span>
          <input value={active.name} onChange={(event) => updateActive({ name: event.target.value })} />
        </label>
        <label className="editor-field">
          <span>Idade</span>
          <input type="range" min={4} max={7} value={active.age} onChange={(event) => updateActive({ age: Number(event.target.value) })} />
          <strong>{active.age} anos</strong>
        </label>
        <div className="emoji-picker-grid">
          {avatarOptions.map((option) => (
            <button type="button" key={option.label} className={cn('emoji-picker', active.avatar === option.emoji && 'is-active')} onClick={() => updateActive({ avatar: option.emoji })}>
              {option.emoji}
            </button>
          ))}
        </div>
        <div className="emoji-picker-grid small-grid">
          {buddyOptions.map((option) => (
            <button type="button" key={option.label} className={cn('emoji-picker small', active.buddy === option.emoji && 'is-active')} onClick={() => updateActive({ buddy: option.emoji })}>
              {option.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type GameStageProps = {
  phase?: GamePhase;
  progress: MiniProgress;
  soundEnabled: boolean;
  onPlayed: () => void;
  onComplete: (stars: number, score: number) => void;
};

function GameStage({ phase, progress, soundEnabled, onPlayed, onComplete }: GameStageProps) {
  useEffect(() => {
    onPlayed();
  }, [phase?.id]);

  if (!phase) return <EmptyMessage text="Fase não encontrada." />;

  return (
    <div className="game-stage-shell">
      <div className="game-stage-summary">
        <div className="summary-card">
          <span>{worldIllustrations[phase.game]}</span>
          <div>
            <strong>{phase.reward}</strong>
            <small>{progress.bestStars}⭐ melhor resultado</small>
          </div>
        </div>
        <div className="summary-card soft">
          <span>{soundEnabled ? '🔊' : '🔇'}</span>
          <div>
            <strong>{phase.description}</strong>
            <small>Toques grandes, leitura simples e animação leve.</small>
          </div>
        </div>
      </div>

      {phase.game === 'memory' && <MemoryGame phase={phase} onComplete={onComplete} />}
      {phase.game === 'alphabet' && <AlphabetGame phase={phase} onComplete={onComplete} />}
      {phase.game === 'math' && <MathGame phase={phase} onComplete={onComplete} />}
      {phase.game === 'shape' && <ShapeGame phase={phase} onComplete={onComplete} />}
      {phase.game === 'colors' && <ColorsGame phase={phase} onComplete={onComplete} />}
      {phase.game === 'maze' && <MazeGame phase={phase} onComplete={onComplete} />}
      {phase.game === 'puzzle' && <PuzzleGame phase={phase} onComplete={onComplete} />}
    </div>
  );
}

type GameComplete = (stars: number, score: number) => void;

function MemoryGame({ phase, onComplete }: { phase: MemoryPhase; onComplete: GameComplete }) {
  const [cards, setCards] = useState<{ id: number; symbol: string; matched: boolean }[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    const symbols = sampleFrom(memoryThemePools[phase.theme], phase.pairCount);
    const deck = sampleFrom([...symbols, ...symbols], symbols.length * 2).map((symbol, index) => ({ id: index, symbol, matched: false }));
    setCards(deck);
    setSelected([]);
    setMoves(0);
  }, [phase.id]);

  useEffect(() => {
    if (selected.length !== 2) return;
    const [a, b] = selected;
    const cardA = cards.find((item) => item.id === a);
    const cardB = cards.find((item) => item.id === b);
    if (!cardA || !cardB) return;
    const timeout = window.setTimeout(() => {
      if (cardA.symbol === cardB.symbol) {
        setCards((current) => current.map((item) => (item.id === a || item.id === b ? { ...item, matched: true } : item)));
      }
      setSelected([]);
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [selected, cards]);

  useEffect(() => {
    if (cards.length && cards.every((item) => item.matched)) {
      const stars = moves <= phase.movesFor3Stars ? 3 : moves <= phase.movesFor2Stars ? 2 : 1;
      onComplete(stars, Math.max(0, 120 - moves * 5));
    }
  }, [cards, moves]);

  return (
    <div className="game-panel">
      <div className="game-helper">Encontre os pares iguais. Toque em dois cartões por vez.</div>
      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${Math.min(4, Math.ceil(Math.sqrt(cards.length)))}, minmax(0, 1fr))` }}>
        {cards.map((card) => {
          const flipped = selected.includes(card.id) || card.matched;
          return (
            <button
              type="button"
              key={card.id}
              className={cn('memory-card', flipped && 'is-flipped')}
              disabled={flipped || selected.length === 2}
              onClick={() => {
                setMoves((current) => current + 1);
                setSelected((current) => [...current, card.id]);
              }}
            >
              <span>{flipped ? card.symbol : '✨'}</span>
            </button>
          );
        })}
      </div>
      <div className="game-footer-note">Movimentos: {moves}</div>
    </div>
  );
}

function AlphabetGame({ phase, onComplete }: { phase: AlphabetPhase; onComplete: GameComplete }) {
  const [questions, setQuestions] = useState<typeof alphabetPools.animals>([]);
  const [index, setIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const [feedback, setFeedback] = useState<'idle' | 'correct' | 'wrong'>('idle');

  useEffect(() => {
    const base = alphabetPools[phase.poolTag] ?? alphabetPools.mixed;
    setQuestions(sampleFrom(base, phase.questionCount));
    setIndex(0);
    setHits(0);
    setFeedback('idle');
  }, [phase.id]);

  const current = questions[index];
  if (!current) return <EmptyMessage text="Preparando letrinhas mágicas…" />;

  const answer = (option: string) => {
    const correct = option === current.letter;
    const nextHits = hits + (correct ? 1 : 0);
    setHits(nextHits);
    setFeedback(correct ? 'correct' : 'wrong');
    window.setTimeout(() => {
      if (index === questions.length - 1) {
        const ratio = nextHits / questions.length;
        const stars = ratio >= 0.85 ? 3 : ratio >= 0.55 ? 2 : 1;
        onComplete(stars, Math.round(ratio * 100));
      } else {
        setIndex((value) => value + 1);
        setFeedback('idle');
      }
    }, 550);
  };

  return (
    <div className="game-panel quiz-panel">
      <div className="question-stage">
        <span className="question-emoji">{current.emoji}</span>
        <h3>{current.word}</h3>
        <p>Qual é a letra inicial?</p>
      </div>
      <div className="option-grid">
        {current.options.map((option) => (
          <button key={option} type="button" className={cn('quiz-option', feedback !== 'idle' && option === current.letter && 'is-correct')} onClick={() => answer(option)}>
            {option}
          </button>
        ))}
      </div>
      <div className="game-footer-note">Rodada {index + 1} de {questions.length}</div>
    </div>
  );
}

function buildMathQuestion(phase: MathPhase) {
  if (phase.mode === 'count') {
    const count = Math.max(2, Math.floor(Math.random() * phase.maxValue) + 1);
    const visual = '⭐ '.repeat(count).trim();
    return {
      prompt: 'Quantas estrelas você vê?',
      visual,
      correct: count,
      options: sampleFrom([count, count + 1, Math.max(1, count - 1), count + 2], 3),
    };
  }
  if (phase.mode === 'add') {
    const a = Math.floor(Math.random() * Math.max(2, phase.maxValue - 1)) + 1;
    const b = Math.floor(Math.random() * Math.max(2, phase.maxValue - 1)) + 1;
    const correct = a + b;
    return {
      prompt: `${a} + ${b} = ?`,
      visual: '➕',
      correct,
      options: sampleFrom([correct, correct + 1, Math.max(0, correct - 1), correct + 2], 3),
    };
  }
  if (phase.mode === 'subtract') {
    const a = Math.floor(Math.random() * Math.max(3, phase.maxValue)) + 2;
    const b = Math.floor(Math.random() * Math.min(a - 1, 4)) + 1;
    const correct = a - b;
    return {
      prompt: `${a} - ${b} = ?`,
      visual: '➖',
      correct,
      options: sampleFrom([correct, correct + 1, Math.max(0, correct - 1), correct + 2], 3),
    };
  }
  const start = Math.floor(Math.random() * Math.max(4, phase.maxValue - 3)) + 1;
  const seq = [start, start + 1, start + 2];
  const correct = start + 3;
  return {
    prompt: `${seq.join(' • ')} • ?`,
    visual: '🔁',
    correct,
    options: sampleFrom([correct, correct + 1, Math.max(1, correct - 1), correct + 2], 3),
  };
}

function MathGame({ phase, onComplete }: { phase: MathPhase; onComplete: GameComplete }) {
  const [index, setIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const [question, setQuestion] = useState(buildMathQuestion(phase));

  useEffect(() => {
    setIndex(0);
    setHits(0);
    setQuestion(buildMathQuestion(phase));
  }, [phase.id]);

  const answer = (value: number) => {
    const correct = value === question.correct;
    const nextHits = hits + (correct ? 1 : 0);
    setHits(nextHits);
    if (index === phase.questionCount - 1) {
      const ratio = nextHits / phase.questionCount;
      const stars = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
      onComplete(stars, Math.round(ratio * 100));
    } else {
      setIndex((current) => current + 1);
      setQuestion(buildMathQuestion(phase));
    }
  };

  return (
    <div className="game-panel quiz-panel">
      <div className="question-stage">
        <span className="question-emoji">{question.visual}</span>
        <h3>{question.prompt}</h3>
        <p>Escolha a resposta certa.</p>
      </div>
      <div className="option-grid">
        {question.options.map((option) => (
          <button key={option} type="button" className="quiz-option" onClick={() => answer(option)}>
            {option}
          </button>
        ))}
      </div>
      <div className="game-footer-note">Pergunta {index + 1} de {phase.questionCount}</div>
    </div>
  );
}

function ShapeGame({ phase, onComplete }: { phase: ShapePhase; onComplete: GameComplete }) {
  const availableShapes = shapeLibrary.filter((shape) => (phase.shapeSet === 'basic' ? ['circle', 'square', 'triangle'].includes(shape.id) : true));
  const [index, setIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const [target, setTarget] = useState(availableShapes[0]);

  useEffect(() => {
    setIndex(0);
    setHits(0);
    setTarget(sampleFrom(availableShapes, 1)[0]);
  }, [phase.id]);

  const answer = (id: string) => {
    const correct = id === target.id;
    const nextHits = hits + (correct ? 1 : 0);
    setHits(nextHits);
    if (index === phase.pieceCount - 1) {
      const ratio = nextHits / phase.pieceCount;
      const stars = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
      onComplete(stars, Math.round(ratio * 100));
    } else {
      setIndex((current) => current + 1);
      setTarget(sampleFrom(availableShapes, 1)[0]);
    }
  };

  return (
    <div className="game-panel quiz-panel">
      <div className="question-stage">
        <span className="question-emoji">{target.label === 'Círculo' ? '⚪' : target.label === 'Quadrado' ? '🟦' : target.label === 'Triângulo' ? '🔺' : target.label === 'Estrela' ? '⭐' : target.label === 'Losango' ? '🔷' : '❤️'}</span>
        <h3>Toque em: {target.label}</h3>
        <p>Escolha a forma certa para continuar a jornada.</p>
      </div>
      <div className="shape-grid">
        {availableShapes.map((shape) => (
          <button key={shape.id} type="button" className="shape-choice" onClick={() => answer(shape.id)} style={{ borderColor: shape.color }}>
            <span style={{ color: shape.color }}>{shape.label === 'Círculo' ? '⚪' : shape.label === 'Quadrado' ? '🟦' : shape.label === 'Triângulo' ? '🔺' : shape.label === 'Estrela' ? '⭐' : shape.label === 'Losango' ? '🔷' : '❤️'}</span>
            <strong>{shape.label}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function ColorsGame({ phase, onComplete }: { phase: ColorsPhase; onComplete: GameComplete }) {
  const buckets = colorBuckets.slice(0, phase.bucketCount);
  const items = sampleFrom(colorItems.filter((item) => buckets.some((bucket) => bucket.id === item.color)), phase.itemCount);
  const [index, setIndex] = useState(0);
  const [hits, setHits] = useState(0);
  const item = items[index];

  useEffect(() => {
    setIndex(0);
    setHits(0);
  }, [phase.id]);

  if (!item) return <EmptyMessage text="Preparando as tintas…" />;

  const answer = (bucketId: ColorBucketId) => {
    const correct = bucketId === item.color;
    const nextHits = hits + (correct ? 1 : 0);
    setHits(nextHits);
    if (index === items.length - 1) {
      const ratio = nextHits / items.length;
      const stars = ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
      onComplete(stars, Math.round(ratio * 100));
    } else {
      setIndex((current) => current + 1);
    }
  };

  return (
    <div className="game-panel quiz-panel">
      <div className="question-stage">
        <span className="question-emoji">{item.emoji}</span>
        <h3>Para qual cor esse item vai?</h3>
        <p>{item.label}</p>
      </div>
      <div className="bucket-choice-grid">
        {buckets.map((bucket) => (
          <button key={bucket.id} type="button" className={cn('bucket-choice', bucket.colorClass)} onClick={() => answer(bucket.id)}>
            {bucket.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function MazeGame({ phase, onComplete }: { phase: MazePhase; onComplete: GameComplete }) {
  const [steps, setSteps] = useState(0);
  const parsed = useMemo(() => phase.grid.map((row) => row.split('')), [phase.id]);
  const start = useMemo(() => {
    for (let y = 0; y < parsed.length; y += 1) {
      for (let x = 0; x < parsed[y].length; x += 1) {
        if (parsed[y][x] === 'S') return { x, y };
      }
    }
    return { x: 1, y: 1 };
  }, [phase.id]);
  const target = useMemo(() => {
    for (let y = 0; y < parsed.length; y += 1) {
      for (let x = 0; x < parsed[y].length; x += 1) {
        if (parsed[y][x] === 'T') return { x, y };
      }
    }
    return { x: parsed[0].length - 2, y: parsed.length - 2 };
  }, [phase.id]);
  const [player, setPlayer] = useState(start);

  useEffect(() => {
    setPlayer(start);
    setSteps(0);
  }, [phase.id]);

  const move = (dx: number, dy: number) => {
    const next = { x: player.x + dx, y: player.y + dy };
    if (!parsed[next.y] || !parsed[next.y][next.x] || parsed[next.y][next.x] === '#') return;
    const nextSteps = steps + 1;
    setPlayer(next);
    setSteps(nextSteps);
    if (next.x === target.x && next.y === target.y) {
      const stars = nextSteps <= phase.idealSteps ? 3 : nextSteps <= phase.idealSteps + 4 ? 2 : 1;
      onComplete(stars, Math.max(25, 150 - nextSteps * 5));
    }
  };

  return (
    <div className="game-panel maze-panel">
      <div className="maze-grid" style={{ gridTemplateColumns: `repeat(${parsed[0]?.length ?? 1}, 1fr)` }}>
        {parsed.flatMap((row, y) => row.map((cell, x) => {
          const isPlayer = player.x === x && player.y === y;
          const isGoal = cell === 'T';
          return <div key={`${x}-${y}`} className={cn('maze-cell', cell === '#' && 'is-wall', isGoal && 'is-goal', isPlayer && 'is-player')}>{isPlayer ? '🧒' : isGoal ? '🏆' : cell === '#' ? '' : '·'}</div>;
        }))}
      </div>
      <div className="maze-controls">
        <button type="button" className="circle-button" onClick={() => move(0, -1)}><ChevronLeft className="rotate-90" size={18} /></button>
        <div className="maze-middle-controls">
          <button type="button" className="circle-button" onClick={() => move(-1, 0)}><ChevronLeft size={18} /></button>
          <button type="button" className="circle-button" onClick={() => move(1, 0)}><ChevronRight size={18} /></button>
        </div>
        <button type="button" className="circle-button" onClick={() => move(0, 1)}><ChevronRight className="rotate-90" size={18} /></button>
      </div>
      <div className="game-footer-note">Passos: {steps}</div>
    </div>
  );
}

function PuzzleGame({ phase, onComplete }: { phase: PuzzlePhase; onComplete: GameComplete }) {
  const targetTiles = phase.scene.tiles;
  const [tiles, setTiles] = useState(targetTiles);
  const [selected, setSelected] = useState<number | null>(null);
  const [swaps, setSwaps] = useState(0);

  useEffect(() => {
    const shuffled = sampleFrom(targetTiles, targetTiles.length);
    setTiles(shuffled);
    setSelected(null);
    setSwaps(0);
  }, [phase.id]);

  useEffect(() => {
    const solved = tiles.every((tile, index) => tile.id === targetTiles[index]?.id);
    if (solved && swaps > 0) {
      const stars = swaps <= targetTiles.length ? 3 : swaps <= targetTiles.length * 2 ? 2 : 1;
      onComplete(stars, Math.max(20, 120 - swaps * 4));
    }
  }, [tiles, swaps]);

  const pick = (index: number) => {
    if (selected === null) {
      setSelected(index);
      return;
    }
    if (selected === index) {
      setSelected(null);
      return;
    }
    const clone = [...tiles];
    [clone[selected], clone[index]] = [clone[index], clone[selected]];
    setTiles(clone);
    setSelected(null);
    setSwaps((value) => value + 1);
  };

  return (
    <div className="game-panel">
      <div className="question-stage compact-stage">
        <span className="question-emoji">🧩</span>
        <h3>{phase.scene.title}</h3>
        <p>Toque em duas peças para trocar de lugar até montar a cena.</p>
      </div>
      <div className="puzzle-grid" style={{ gridTemplateColumns: `repeat(${targetTiles.length > 4 ? 3 : 2}, minmax(0, 1fr))` }}>
        {tiles.map((tile, index) => (
          <button key={`${tile.id}-${index}`} type="button" className={cn('puzzle-tile', selected === index && 'is-selected')} onClick={() => pick(index)}>
            <span>{tile.emoji}</span>
            <strong>{tile.label}</strong>
          </button>
        ))}
      </div>
      <div className="game-footer-note">Trocas: {swaps}</div>
    </div>
  );
}

function FloatingDecor() {
  return (
    <div className="floating-decor" aria-hidden>
      {['⭐', '🌈', '🧩', '🎨', '🦊', '🚀', '🐠', '🎪'].map((emoji, index) => (
        <motion.span
          key={`${emoji}-${index}`}
          className={`decor-${index}`}
          animate={{ y: [0, -18, 0], rotate: [0, 8, -8, 0] }}
          transition={{ duration: 5 + index * 0.3, repeat: Infinity, delay: index * 0.2 }}
        >
          {emoji}
        </motion.span>
      ))}
    </div>
  );
}

function ToastLayer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-stack">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div key={toast.id} className={cn('toast-card', `tone-${toast.tone}`)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <strong>{toast.title}</strong>
            <p>{toast.text}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function SectionHeading({ eyebrow, title, icon }: { eyebrow: string; title: string; icon: React.ReactNode }) {
  return (
    <div className="section-heading">
      <span>{eyebrow}</span>
      <div>
        <div className="heading-icon">{icon}</div>
        <h3>{title}</h3>
      </div>
    </div>
  );
}

function StatBubble({ label, value, tone, compact }: { label: string; value: string; tone: 'pink' | 'blue' | 'gold'; compact?: boolean }) {
  return (
    <div className={cn('stat-bubble', `tone-${tone}`, compact && 'is-compact')}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function ProgressBubble({ label, value, tone }: { label: string; value: string; tone: 'is-great' | 'is-good' | 'is-soft' }) {
  return (
    <div className={cn('progress-bubble', tone)}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function StoryCard({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="story-card">
      <span>{emoji}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function QuickLaunchCard({ icon: Icon, title, text, actionLabel, accent, onClick }: { icon: ElementType; title: string; text: string; actionLabel: string; accent: string; onClick: () => void }) {
  return (
    <motion.article className="quick-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
      <div className={cn('quick-card-icon', accent)}>
        <Icon size={20} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
      <button type="button" className="mini-pill-button" onClick={onClick}>{actionLabel}</button>
    </motion.article>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

export default App;
