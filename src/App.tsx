import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Flame,
  Gift,
  Heart,
  Home,
  Map,
  Menu,
  Play,
  Settings,
  Sparkles,
  Star,
  Users,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  alphabetPools,
  colorBuckets,
  colorItems,
  contentPacks as fallbackContentPacks,
  memoryThemePools,
  parentWeeklyTracks as fallbackParentWeeklyTracks,
  phaseMap,
  seasonalEvents as fallbackSeasonalEvents,
  shapeLibrary,
  worlds,
  worldPhaseOrder,
  type AlphabetPhase,
  type ChildProfile,
  type ColorsPhase,
  type ContentPack,
  type GameKey,
  type GamePhase,
  type MathPhase,
  type MazePhase,
  type MemoryPhase,
  type ParentWeeklyTrack,
  type PuzzlePhase,
  type SeasonalEvent,
  type ShapePhase,
} from './data/gameContent';
import { dynamicContentEnabled, fetchDynamicCatalog } from './lib/dynamicContent';
import { safeReadStorage, writeStorage } from './lib/storage';
import homeArt from './assets/home-ref.jpeg';
import mapArt from './assets/map-ref.jpeg';
import gameArt from './assets/game-ref.jpeg';
import parentsArt from './assets/parents-ref.jpeg';
import rewardsArt from './assets/rewards-ref.jpeg';

type PanelKey = 'home' | 'play' | 'map' | 'packs' | 'events' | 'rewards' | 'parents' | 'settings';

type PlayerProgress = {
  stars: number;
  gems: number;
  streak: number;
  hearts: number;
  rewardsOpened: number;
  lastWorld: GameKey;
  completedPhases: string[];
  dailyMinutes: number;
  favoriteWorld: GameKey;
};

type GameResult = {
  stars: number;
  bonusText: string;
};

type MemoryCard = {
  id: string;
  emoji: string;
  matched: boolean;
  revealed: boolean;
};

const STORAGE_KEYS = {
  profiles: 'edv-v8-profiles',
  activeProfileId: 'edv-v8-active-profile',
  progressMap: 'edv-v8-progress-map',
  settings: 'edv-v8-settings',
};

const defaultProfiles: ChildProfile[] = [
  {
    id: 'profile-pedro',
    name: 'Pedro',
    age: 6,
    accent: 'from-sky-500 via-indigo-500 to-fuchsia-500',
    avatar: '🧒',
    buddy: '⭐',
    mascotTheme: 'estelinha',
    createdAt: new Date().toISOString(),
  },
];

const defaultProgress = (): PlayerProgress => ({
  stars: 1850,
  gems: 48,
  streak: 7,
  hearts: 3,
  rewardsOpened: 3,
  lastWorld: 'alphabet',
  completedPhases: ['memory-1', 'alphabet-1', 'math-1', 'shape-1', 'colors-1'],
  dailyMinutes: 85,
  favoriteWorld: 'memory',
});

const panelItems: Array<{ key: PanelKey; label: string; icon: typeof Home; tone: string }> = [
  { key: 'home', label: 'Início', icon: Home, tone: 'from-fuchsia-500 to-violet-500' },
  { key: 'play', label: 'Jogar', icon: Play, tone: 'from-lime-500 to-emerald-500' },
  { key: 'map', label: 'Mapa', icon: Map, tone: 'from-sky-500 to-cyan-500' },
  { key: 'packs', label: 'Packs', icon: WandSparkles, tone: 'from-orange-500 to-pink-500' },
  { key: 'events', label: 'Eventos', icon: Sparkles, tone: 'from-amber-500 to-orange-500' },
  { key: 'rewards', label: 'Recompensas', icon: Gift, tone: 'from-violet-500 to-fuchsia-500' },
  { key: 'parents', label: 'Pais', icon: Users, tone: 'from-indigo-500 to-sky-500' },
  { key: 'settings', label: 'Config.', icon: Settings, tone: 'from-slate-500 to-slate-700' },
];

const worldArtwork: Record<GameKey, string> = {
  memory: gameArt,
  alphabet: homeArt,
  math: mapArt,
  shape: homeArt,
  colors: mapArt,
  maze: gameArt,
  puzzle: rewardsArt,
};

const worldEmoji: Record<GameKey, string> = {
  memory: '🧠',
  alphabet: '🔤',
  math: '🔢',
  shape: '🧩',
  colors: '🌈',
  maze: '🌀',
  puzzle: '🖼️',
};

const cap = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const sample = <T,>(items: T[], total: number) => {
  const clone = [...items];
  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone.slice(0, total);
};

const getTodayPhrase = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const getStarsForRatio = (ratio: number) => {
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.65) return 2;
  return 1;
};

const formatWorldName = (game: GameKey) => worlds.find((world) => world.game === game)?.shortTitle ?? game;

const GlassPanel = ({
  title,
  subtitle,
  badge,
  children,
  art,
  actions,
}: {
  title: string;
  subtitle: string;
  badge: string;
  children: React.ReactNode;
  art?: string;
  actions?: React.ReactNode;
}) => (
  <motion.section
    key={title}
    initial={{ opacity: 0, y: 18, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 18, scale: 0.98 }}
    transition={{ duration: 0.22 }}
    className="relative overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/72 p-5 shadow-[0_30px_90px_rgba(34,14,79,0.18)] backdrop-blur-2xl md:p-7"
  >
    {art && <img src={art} alt="Referência visual" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.18]" />}
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.85),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.16),transparent_28%)]" />
    <div className="relative z-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="inline-flex rounded-full bg-white/75 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-indigo-700 shadow-sm">{badge}</div>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-[2.3rem]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700 md:text-base">{subtitle}</p>
        </div>
        {actions}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  </motion.section>
);

const ModalShell = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm"
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 16 }}
      className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2.3rem] border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(243,244,255,0.96))] shadow-[0_40px_120px_rgba(15,23,42,0.35)]"
    >
      <div className="flex items-center justify-between border-b border-indigo-100 px-5 py-4 md:px-7">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Janela interativa</div>
          <div className="mt-1 text-2xl font-black text-slate-950">{title}</div>
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="overflow-auto p-4 md:p-6">{children}</div>
    </motion.div>
  </motion.div>
);

const MemoryGame = ({ phase, onComplete }: { phase: MemoryPhase; onComplete: (result: GameResult) => void }) => {
  const [cards, setCards] = useState<MemoryCard[]>(() => {
    const selected = sample(memoryThemePools[phase.theme], phase.pairCount);
    return sample(
      selected.flatMap((emoji, index) => [
        { id: `${emoji}-${index}-a`, emoji, matched: false, revealed: false },
        { id: `${emoji}-${index}-b`, emoji, matched: false, revealed: false },
      ]),
      phase.pairCount * 2,
    );
  });
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (cards.length > 0 && cards.every((card) => card.matched)) {
      const ratio = phase.movesFor2Stars / Math.max(moves, 1);
      onComplete({ stars: getStarsForRatio(Math.min(1.1, ratio)), bonusText: `Você encontrou ${phase.pairCount} pares!` });
    }
  }, [cards, moves, onComplete, phase.movesFor2Stars, phase.pairCount]);

  const revealCard = (cardId: string) => {
    if (locked) return;
    const card = cards.find((item) => item.id === cardId);
    if (!card || card.matched || openIds.includes(cardId)) return;
    const nextOpen = [...openIds, cardId];
    setCards((current) => current.map((item) => (item.id === cardId ? { ...item, revealed: true } : item)));
    if (nextOpen.length < 2) {
      setOpenIds(nextOpen);
      return;
    }
    setLocked(true);
    setMoves((value) => value + 1);
    const first = cards.find((item) => item.id === nextOpen[0]);
    const second = cards.find((item) => item.id === cardId);
    window.setTimeout(() => {
      const matched = first?.emoji === second?.emoji;
      setCards((current) => current.map((item) => {
        if (!nextOpen.includes(item.id)) return item;
        if (matched) return { ...item, matched: true, revealed: true };
        return { ...item, revealed: false };
      }));
      setOpenIds([]);
      setLocked(false);
    }, 650);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,#eff6ff,#fdf2f8)] p-5 shadow-inner">
        <div className="text-sm font-black uppercase tracking-[0.22em] text-indigo-500">Memória</div>
        <h3 className="mt-3 text-2xl font-black text-slate-950">{phase.title}</h3>
        <p className="mt-2 text-sm text-slate-700">{phase.description}</p>
        <div className="mt-5 rounded-[1.6rem] bg-white/85 p-4 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Meta da fase</div>
          <div className="mt-2 text-lg font-black text-slate-950">Encontre todos os pares</div>
          <div className="mt-2 text-sm text-slate-600">Movimentos: <span className="font-black text-indigo-700">{moves}</span></div>
          <div className="text-sm text-slate-600">Recompensa: <span className="font-black text-fuchsia-600">{phase.reward}</span></div>
        </div>
      </div>
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(91,33,182,0.16),rgba(56,189,248,0.12))] p-4 md:p-6">
        <div className="mb-4 flex items-center justify-between gap-4 rounded-[1.5rem] bg-white/80 px-4 py-3">
          <div className="text-sm font-black uppercase tracking-[0.2em] text-indigo-500">Fase ativa</div>
          <div className="text-sm font-semibold text-slate-700">Pares: {phase.pairCount}</div>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => revealCard(card.id)}
              className={`aspect-square rounded-[1.4rem] border-2 text-4xl shadow-sm transition ${card.matched || card.revealed ? 'border-yellow-300 bg-white' : 'border-white/40 bg-[linear-gradient(180deg,#8b5cf6,#6366f1)] text-transparent'}`}
            >
              <span className={card.matched || card.revealed ? 'opacity-100' : 'opacity-0'}>{card.emoji}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const AlphabetGame = ({ phase, onComplete }: { phase: AlphabetPhase; onComplete: (result: GameResult) => void }) => {
  const questions = useMemo(() => sample(alphabetPools[phase.poolTag], phase.questionCount), [phase.poolTag, phase.questionCount]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const current = questions[index];

  const choose = (option: string) => {
    const isCorrect = option === current.letter;
    const nextCorrect = correct + (isCorrect ? 1 : 0);
    if (index === questions.length - 1) {
      onComplete({ stars: getStarsForRatio(nextCorrect / Math.max(1, questions.length)), bonusText: `Você acertou ${nextCorrect} de ${questions.length}.` });
      return;
    }
    setCorrect(nextCorrect);
    setIndex((value) => value + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,#eff6ff,#ecfeff)] p-5 shadow-inner">
        <div className="text-sm font-black uppercase tracking-[0.22em] text-indigo-500">Cidade das letras</div>
        <h3 className="mt-3 text-2xl font-black text-slate-950">{phase.title}</h3>
        <p className="mt-2 text-sm text-slate-700">Escolha a letra inicial correta.</p>
        <div className="mt-5 rounded-[1.6rem] bg-white/85 p-4 shadow-sm">
          <div className="text-sm text-slate-600">Rodada {index + 1} / {questions.length}</div>
          <div className="text-sm text-slate-600">Acertos: <span className="font-black text-indigo-700">{correct}</span></div>
          <div className="mt-2 text-sm text-slate-600">Recompensa: <span className="font-black text-fuchsia-600">{phase.reward}</span></div>
        </div>
      </div>
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(244,114,182,0.12))] p-6">
        <div className="rounded-[2rem] bg-white/85 p-6 shadow-sm">
          <div className="text-center text-7xl">{current.emoji}</div>
          <div className="mt-4 text-center text-3xl font-black text-slate-950">{current.word}</div>
          <div className="mt-2 text-center text-sm font-semibold text-slate-600">Qual letra começa essa palavra?</div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {current.options.map((option) => (
              <button key={option} type="button" onClick={() => choose(option)} className="rounded-[1.4rem] bg-[linear-gradient(135deg,#4f46e5,#7c3aed)] px-4 py-5 text-3xl font-black text-white shadow-lg">{option}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const buildMathQuestions = (phase: MathPhase) => Array.from({ length: phase.questionCount }, () => {
  const a = Math.floor(Math.random() * phase.maxValue) + 1;
  const b = Math.floor(Math.random() * phase.maxValue) + 1;
  if (phase.mode === 'count') {
    const correct = Math.floor(Math.random() * phase.maxValue) + 1;
    return {
      prompt: 'Quantos itens aparecem?',
      visual: '⭐'.repeat(correct),
      correct,
      options: sample([correct, cap(correct + 1, 1, phase.maxValue + 3), cap(correct + 2, 1, phase.maxValue + 4), cap(correct - 1, 1, phase.maxValue)], 3),
    };
  }
  if (phase.mode === 'add') {
    const correct = a + b;
    return { prompt: `${a} + ${b} = ?`, visual: `${'🍎'.repeat(a)} + ${'🍌'.repeat(b)}`, correct, options: sample([correct, correct + 1, Math.max(1, correct - 1), correct + 2], 3) };
  }
  if (phase.mode === 'subtract') {
    const high = Math.max(a, b) + 1;
    const low = Math.min(a, b);
    const correct = high - low;
    return { prompt: `${high} - ${low} = ?`, visual: `${'🟡'.repeat(high)}`, correct, options: sample([correct, correct + 1, Math.max(1, correct - 1), correct + 2], 3) };
  }
  const start = Math.floor(Math.random() * (phase.maxValue - 3)) + 1;
  const correct = start + 3;
  return { prompt: `${start}, ${start + 1}, ${start + 2}, ?`, visual: '🔢 continue a sequência', correct, options: sample([correct, correct + 1, Math.max(1, correct - 1), correct + 2], 3) };
});

const MathGame = ({ phase, onComplete }: { phase: MathPhase; onComplete: (result: GameResult) => void }) => {
  const questions = useMemo(() => buildMathQuestions(phase), [phase]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const current = questions[index];
  const options = useMemo(() => sample(Array.from(new Set([...current.options, current.correct])), 3), [current.correct, current.options]);

  const choose = (value: number) => {
    const nextCorrect = correct + (value === current.correct ? 1 : 0);
    if (index === questions.length - 1) {
      onComplete({ stars: getStarsForRatio(nextCorrect / Math.max(1, questions.length)), bonusText: `Você completou ${questions.length} desafios.` });
      return;
    }
    setCorrect(nextCorrect);
    setIndex((state) => state + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,#ecfeff,#eff6ff)] p-5 shadow-inner">
        <div className="text-sm font-black uppercase tracking-[0.22em] text-cyan-600">Vale dos números</div>
        <h3 className="mt-3 text-2xl font-black text-slate-950">{phase.title}</h3>
        <p className="mt-2 text-sm text-slate-700">Desafios curtinhos com visual grande e fácil de entender.</p>
        <div className="mt-5 rounded-[1.6rem] bg-white/85 p-4 shadow-sm">
          <div className="text-sm text-slate-600">Rodada {index + 1} / {questions.length}</div>
          <div className="text-sm text-slate-600">Acertos: <span className="font-black text-cyan-700">{correct}</span></div>
        </div>
      </div>
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(14,165,233,0.12),rgba(250,204,21,0.12))] p-6">
        <div className="rounded-[2rem] bg-white/85 p-6 shadow-sm">
          <div className="text-center text-sm font-black uppercase tracking-[0.18em] text-cyan-600">Pergunta atual</div>
          <div className="mt-3 text-center text-4xl font-black text-slate-950">{current.prompt}</div>
          <div className="mt-4 text-center text-4xl">{current.visual}</div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {options.map((option) => (
              <button key={option} type="button" onClick={() => choose(option)} className="rounded-[1.4rem] bg-[linear-gradient(135deg,#0ea5e9,#2563eb)] px-4 py-5 text-3xl font-black text-white shadow-lg">{option}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ShapeGame = ({ phase, onComplete }: { phase: ShapePhase; onComplete: (result: GameResult) => void }) => {
  const shapeSet = phase.shapeSet === 'basic' ? shapeLibrary.slice(0, 4) : shapeLibrary;
  const rounds = useMemo(() => Array.from({ length: Math.min(6, phase.pieceCount) }, () => ({
    target: sample(shapeSet, 1)[0],
    options: sample(shapeSet, Math.min(4, shapeSet.length)),
  })), [phase.pieceCount, shapeSet]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const current = rounds[index];

  const choose = (shapeId: string) => {
    const nextCorrect = correct + (shapeId === current.target.id ? 1 : 0);
    if (index === rounds.length - 1) {
      onComplete({ stars: getStarsForRatio(nextCorrect / Math.max(1, rounds.length)), bonusText: `Você encaixou ${nextCorrect} formas certas.` });
      return;
    }
    setCorrect(nextCorrect);
    setIndex((state) => state + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,#fdf2f8,#eef2ff)] p-5 shadow-inner">
        <div className="text-sm font-black uppercase tracking-[0.22em] text-fuchsia-600">Ilha do encaixe</div>
        <h3 className="mt-3 text-2xl font-black text-slate-950">{phase.title}</h3>
        <p className="mt-2 text-sm text-slate-700">Toque na forma correta. Grande, simples e rápido para brincar.</p>
      </div>
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(244,114,182,0.12),rgba(99,102,241,0.12))] p-6">
        <div className="rounded-[2rem] bg-white/85 p-6 shadow-sm">
          <div className="text-center text-sm font-black uppercase tracking-[0.2em] text-fuchsia-600">Rodada {index + 1}</div>
          <div className="mt-4 text-center text-2xl font-black text-slate-950">Encontre: {current.target.label}</div>
          <div className="mt-4 flex justify-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-[2rem] border-4 border-white bg-slate-50 text-5xl shadow-inner" style={{ color: current.target.color }}>
              {current.target.id === 'circle' && <div className="h-16 w-16 rounded-full bg-current" />}
              {current.target.id === 'square' && <div className="h-16 w-16 rounded-[1rem] bg-current" />}
              {current.target.id === 'triangle' && <div style={{ width: 0, height: 0, borderLeft: '34px solid transparent', borderRight: '34px solid transparent', borderBottom: `60px solid ${current.target.color}` }} />}
              {current.target.id === 'star' && <span>⭐</span>}
              {current.target.id === 'diamond' && <div className="h-14 w-14 rotate-45 rounded-[0.9rem] bg-current" />}
              {current.target.id === 'heart' && <span>💖</span>}
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sample([...current.options, current.target], Math.min(4, shapeSet.length)).map((shape) => (
              <button key={`${index}-${shape.id}`} type="button" onClick={() => choose(shape.id)} className="rounded-[1.3rem] bg-slate-100 px-4 py-5 text-lg font-black text-slate-900 shadow-sm">
                {shape.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ColorsGame = ({ phase, onComplete }: { phase: ColorsPhase; onComplete: (result: GameResult) => void }) => {
  const buckets = colorBuckets.slice(0, phase.bucketCount);
  const pool = colorItems.filter((item) => buckets.some((bucket) => bucket.id === item.color));
  const items = useMemo(() => sample(pool, phase.itemCount), [phase.itemCount, pool]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const current = items[index];

  const choose = (bucketId: string) => {
    const nextCorrect = correct + (bucketId === current.color ? 1 : 0);
    if (index === items.length - 1) {
      onComplete({ stars: getStarsForRatio(nextCorrect / Math.max(1, items.length)), bonusText: `Você organizou ${items.length} itens.` });
      return;
    }
    setCorrect(nextCorrect);
    setIndex((state) => state + 1);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,#fefce8,#ecfccb)] p-5 shadow-inner">
        <div className="text-sm font-black uppercase tracking-[0.22em] text-emerald-600">Jardim das cores</div>
        <h3 className="mt-3 text-2xl font-black text-slate-950">{phase.title}</h3>
        <p className="mt-2 text-sm text-slate-700">Arrume cada item no cesto da cor certa.</p>
      </div>
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(250,204,21,0.12),rgba(16,185,129,0.12))] p-6">
        <div className="rounded-[2rem] bg-white/85 p-6 shadow-sm">
          <div className="text-center text-sm font-black uppercase tracking-[0.18em] text-emerald-600">Item atual</div>
          <div className="mt-4 text-center text-8xl">{current.emoji}</div>
          <div className="mt-3 text-center text-2xl font-black text-slate-950">{current.label}</div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {buckets.map((bucket) => (
              <button key={bucket.id} type="button" onClick={() => choose(bucket.id)} className={`rounded-[1.4rem] px-4 py-5 text-lg font-black shadow-sm ${bucket.colorClass}`}>
                {bucket.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MazeGame = ({ phase, onComplete }: { phase: MazePhase; onComplete: (result: GameResult) => void }) => {
  const grid = phase.grid.map((row) => row.split(''));
  const start = grid.flatMap((row, y) => row.map((cell, x) => ({ cell, x, y }))).find((item) => item.cell === 'S');
  const target = grid.flatMap((row, y) => row.map((cell, x) => ({ cell, x, y }))).find((item) => item.cell === 'T');
  const [position, setPosition] = useState({ x: start?.x ?? 1, y: start?.y ?? 1 });
  const [steps, setSteps] = useState(0);
  const [done, setDone] = useState(false);

  const move = (dx: number, dy: number) => {
    if (done) return;
    const next = { x: position.x + dx, y: position.y + dy };
    const cell = grid[next.y]?.[next.x];
    if (!cell || cell === '#') return;
    setPosition(next);
    setSteps((value) => value + 1);
    if (next.x === target?.x && next.y === target?.y) {
      setDone(true);
      const ratio = phase.idealSteps / Math.max(phase.idealSteps, steps + 1);
      window.setTimeout(() => onComplete({ stars: getStarsForRatio(ratio), bonusText: `Tesouro alcançado em ${steps + 1} passos!` }), 300);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,#ecfeff,#eef2ff)] p-5 shadow-inner">
        <div className="text-sm font-black uppercase tracking-[0.22em] text-sky-600">Caverna do tesouro</div>
        <h3 className="mt-3 text-2xl font-black text-slate-950">{phase.title}</h3>
        <p className="mt-2 text-sm text-slate-700">Use os botões para encontrar o baú escondido.</p>
        <div className="mt-4 text-sm text-slate-700">Passos: <span className="font-black text-sky-700">{steps}</span></div>
      </div>
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(59,130,246,0.12),rgba(99,102,241,0.12))] p-6">
        <div className="rounded-[2rem] bg-white/85 p-6 shadow-sm">
          <div className="flex justify-center">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${grid[0].length}, minmax(0, 1fr))` }}>
              {grid.flatMap((row, y) => row.map((cell, x) => {
                const isPlayer = position.x === x && position.y === y;
                return (
                  <div key={`${x}-${y}`} className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black ${cell === '#' ? 'bg-slate-800' : cell === 'T' ? 'bg-yellow-200' : 'bg-sky-50 border border-sky-100'}`}>
                    {isPlayer ? '🧒' : cell === 'T' ? '🏆' : cell === 'S' ? '⭐' : ''}
                  </div>
                );
              }))}
            </div>
          </div>
          <div className="mt-6 flex flex-col items-center gap-2">
            <button type="button" onClick={() => move(0, -1)} className="rounded-full bg-indigo-600 px-6 py-3 text-lg font-black text-white">↑</button>
            <div className="flex gap-2">
              <button type="button" onClick={() => move(-1, 0)} className="rounded-full bg-indigo-600 px-6 py-3 text-lg font-black text-white">←</button>
              <button type="button" onClick={() => move(1, 0)} className="rounded-full bg-indigo-600 px-6 py-3 text-lg font-black text-white">→</button>
            </div>
            <button type="button" onClick={() => move(0, 1)} className="rounded-full bg-indigo-600 px-6 py-3 text-lg font-black text-white">↓</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PuzzleGame = ({ phase, onComplete }: { phase: PuzzlePhase; onComplete: (result: GameResult) => void }) => {
  const ordered = phase.scene.tiles;
  const [pool, setPool] = useState(() => sample(ordered, ordered.length));
  const [selected, setSelected] = useState<typeof ordered>([]);
  const [mistakes, setMistakes] = useState(0);

  const choose = (tileId: number) => {
    const expected = ordered[selected.length];
    const tile = pool.find((item) => item.id === tileId);
    if (!tile) return;
    if (tile.id === expected.id) {
      const nextSelected = [...selected, tile];
      const nextPool = pool.filter((item) => item.id !== tileId);
      setSelected(nextSelected);
      setPool(nextPool);
      if (nextSelected.length === ordered.length) {
        const ratio = ordered.length / Math.max(ordered.length + mistakes, 1);
        onComplete({ stars: getStarsForRatio(ratio), bonusText: `Cena montada: ${phase.scene.title}!` });
      }
    } else {
      setMistakes((value) => value + 1);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,#faf5ff,#fdf2f8)] p-5 shadow-inner">
        <div className="text-sm font-black uppercase tracking-[0.22em] text-violet-600">Ateliê dos puzzles</div>
        <h3 className="mt-3 text-2xl font-black text-slate-950">{phase.title}</h3>
        <p className="mt-2 text-sm text-slate-700">Toque na próxima peça correta para montar a cena.</p>
        <div className="mt-4 text-sm text-slate-700">Erros: <span className="font-black text-violet-700">{mistakes}</span></div>
      </div>
      <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(168,85,247,0.12),rgba(244,114,182,0.12))] p-6">
        <div className="rounded-[2rem] bg-white/85 p-6 shadow-sm">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-violet-600">Cena alvo</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ordered.map((tile, index) => (
              <div key={tile.id} className={`rounded-[1.4rem] border border-violet-100 p-4 text-center shadow-sm ${selected.length > index ? 'bg-violet-100' : 'bg-slate-50'}`}>
                <div className="text-4xl">{selected.length > index ? tile.emoji : '✨'}</div>
                <div className="mt-2 text-sm font-black text-slate-800">{selected.length > index ? tile.label : `Peça ${index + 1}`}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pool.map((tile) => (
              <button key={tile.id} type="button" onClick={() => choose(tile.id)} className="rounded-[1.4rem] bg-violet-50 px-4 py-5 text-left shadow-sm">
                <div className="text-4xl">{tile.emoji}</div>
                <div className="mt-2 text-base font-black text-slate-900">{tile.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const GameModalContent = ({ phase, onClose, onWin }: { phase: GamePhase; onClose: () => void; onWin: (phaseId: string, result: GameResult) => void }) => {
  const handleComplete = (result: GameResult) => {
    onWin(phase.id, result);
    window.setTimeout(onClose, 500);
  };

  if (phase.game === 'memory') return <MemoryGame phase={phase} onComplete={handleComplete} />;
  if (phase.game === 'alphabet') return <AlphabetGame phase={phase} onComplete={handleComplete} />;
  if (phase.game === 'math') return <MathGame phase={phase} onComplete={handleComplete} />;
  if (phase.game === 'shape') return <ShapeGame phase={phase} onComplete={handleComplete} />;
  if (phase.game === 'colors') return <ColorsGame phase={phase} onComplete={handleComplete} />;
  if (phase.game === 'maze') return <MazeGame phase={phase} onComplete={handleComplete} />;
  return <PuzzleGame phase={phase} onComplete={handleComplete} />;
};


type ModalPanelKey = 'packs' | 'events' | 'rewards' | 'parents' | 'settings';

const App = () => {
  const [panel, setPanel] = useState<PanelKey>('home');
  const [modalPanel, setModalPanel] = useState<ModalPanelKey | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profiles] = useState<ChildProfile[]>(() => safeReadStorage(STORAGE_KEYS.profiles, defaultProfiles));
  const [activeProfileId] = useState<string>(() => safeReadStorage(STORAGE_KEYS.activeProfileId, defaultProfiles[0].id));
  const [progressMap, setProgressMap] = useState<Record<string, PlayerProgress>>(() => safeReadStorage(STORAGE_KEYS.progressMap, { [defaultProfiles[0].id]: defaultProgress() }));
  const [contentPacks, setContentPacks] = useState<ContentPack[]>(fallbackContentPacks);
  const [seasonalEvents, setSeasonalEvents] = useState<SeasonalEvent[]>(fallbackSeasonalEvents);
  const [weeklyTracks, setWeeklyTracks] = useState<ParentWeeklyTrack[]>(fallbackParentWeeklyTracks);
  const [catalogStatus, setCatalogStatus] = useState<'local' | 'remote'>('local');
  const [selectedWorld, setSelectedWorld] = useState<GameKey | null>('memory');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => safeReadStorage(STORAGE_KEYS.settings, { audio: true }).audio);

  const activeProfile = useMemo(() => profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0], [activeProfileId, profiles]);
  const activeProgress = progressMap[activeProfile.id] ?? defaultProgress();

  useEffect(() => {
    writeStorage(STORAGE_KEYS.profiles, profiles);
  }, [profiles]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.activeProfileId, activeProfileId);
  }, [activeProfileId]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.progressMap, progressMap);
  }, [progressMap]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.settings, { audio: audioEnabled });
  }, [audioEnabled]);

  useEffect(() => {
    let cancelled = false;
    if (!dynamicContentEnabled()) return;
    fetchDynamicCatalog().then((response) => {
      if (cancelled || !response.ok || !response.payload) return;
      setContentPacks(response.payload.contentPacks);
      setSeasonalEvents(response.payload.seasonalEvents);
      setWeeklyTracks(response.payload.parentWeeklyTracks);
      setCatalogStatus('remote');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const activeTrack = useMemo(
    () => weeklyTracks.find((track) => activeProfile.age >= track.ageMin && activeProfile.age <= track.ageMax) ?? weeklyTracks[0],
    [activeProfile.age, weeklyTracks],
  );
  const lastWorld = worlds.find((world) => world.game === activeProgress.lastWorld) ?? worlds[0];
  const recommendedPack = contentPacks.find((pack) => pack.recommendedAges.includes(activeProfile.age)) ?? contentPacks[0];
  const featuredEvent = seasonalEvents[0];
  const completedCount = activeProgress.completedPhases.length;
  const missionCards = [
    { title: 'Jogar 2 fases', progress: `${Math.min(2, completedCount % 3)}/2`, stars: 20 },
    { title: 'Acertar cores', progress: `${Math.min(5, completedCount % 6)}/5`, stars: 15 },
    { title: 'Abrir recompensa', progress: `${Math.min(1, activeProgress.rewardsOpened ? 1 : 0)}/1`, stars: 25 },
  ];

  const completePhase = (phaseId: string, result: GameResult) => {
    setProgressMap((current) => {
      const currentProgress = current[activeProfile.id] ?? defaultProgress();
      const firstTime = !currentProgress.completedPhases.includes(phaseId);
      const nextProgress: PlayerProgress = {
        ...currentProgress,
        stars: currentProgress.stars + result.stars * (firstTime ? 18 : 8),
        gems: currentProgress.gems + (firstTime ? result.stars : 1),
        streak: currentProgress.streak + 1,
        rewardsOpened: currentProgress.rewardsOpened + (firstTime ? 1 : 0),
        hearts: 3,
        lastWorld: phaseMap[phaseId].game,
        favoriteWorld: phaseMap[phaseId].game,
        completedPhases: firstTime ? [...currentProgress.completedPhases, phaseId] : currentProgress.completedPhases,
        dailyMinutes: currentProgress.dailyMinutes + 6,
      };
      return { ...current, [activeProfile.id]: nextProgress };
    });
    setToast(`Muito bem! ${result.bonusText}`);
  };

  const openPhase = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
    setSelectedWorld(phaseMap[phaseId].game);
  };

  const openMenuItem = (key: PanelKey) => {
    if (key === 'home' || key === 'play' || key === 'map') {
      setPanel(key);
      setModalPanel(null);
    } else {
      setModalPanel(key as ModalPanelKey);
    }
    setDrawerOpen(false);
  };

  const worldCompletion = (game: GameKey) => {
    const phaseIds = worldPhaseOrder[game];
    const done = phaseIds.filter((phaseId) => activeProgress.completedPhases.includes(phaseId)).length;
    return {
      done,
      total: phaseIds.length,
      ratio: phaseIds.length ? done / phaseIds.length : 0,
    };
  };

  const quickPanels: Array<{ key: ModalPanelKey; label: string; icon: typeof Gift; tone: string }> = [
    { key: 'packs', label: 'Packs', icon: WandSparkles, tone: 'from-orange-500 to-pink-500' },
    { key: 'events', label: 'Eventos', icon: Sparkles, tone: 'from-amber-500 to-orange-500' },
    { key: 'rewards', label: 'Prêmios', icon: Gift, tone: 'from-violet-500 to-fuchsia-500' },
    { key: 'parents', label: 'Pais', icon: Users, tone: 'from-blue-500 to-cyan-500' },
  ];

  const sidebar = (
    <aside className="hidden w-[168px] shrink-0 flex-col rounded-[2.4rem] border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(240,244,255,0.96))] p-4 shadow-[0_28px_100px_rgba(27,36,94,0.2)] backdrop-blur-2xl xl:flex">
      <div className="mb-4 rounded-[2rem] bg-[linear-gradient(160deg,#3b82f6,#7c3aed,#ec4899)] p-4 text-white shadow-[0_24px_50px_rgba(124,58,237,0.36)]">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[1.4rem] bg-white/20 text-3xl shadow-inner">⭐</div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-white/80">Companheira</div>
            <div className="mt-1 text-xl font-black">Estelinha</div>
          </div>
        </div>
        <div className="mt-4 rounded-[1.4rem] bg-white/18 px-3 py-3 text-sm font-semibold text-white/90">Toque em um botão grande e abra uma aventura sem se perder.</div>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        {panelItems.map((item) => {
          const Icon = item.icon;
          const active = (modalPanel ? modalPanel === item.key : panel === item.key) && !(item.key === 'home' || item.key === 'play' || item.key === 'map' ? false : false);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => openMenuItem(item.key)}
              className={`group rounded-[1.8rem] px-3 py-3 text-left shadow-sm ${active ? `bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${item.tone} text-white shadow-[0_16px_40px_rgba(79,70,229,0.24)]` : 'bg-white/88 text-slate-800 hover:bg-white'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-[1.1rem] ${active ? 'bg-white/18 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black tracking-tight">{item.label}</div>
                  <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${active ? 'text-white/80' : 'text-slate-400'}`}>{item.key === 'home' || item.key === 'play' || item.key === 'map' ? 'Tela' : 'Janela'}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 rounded-[1.8rem] bg-[linear-gradient(160deg,#eef2ff,#fff7ed)] p-4 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Próximo presente</div>
        <div className="mt-2 text-2xl font-black text-slate-950">{activeProgress.stars} ⭐</div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/90">
          <div className="h-full rounded-full bg-[linear-gradient(135deg,#f59e0b,#ef4444)]" style={{ width: `${cap((activeProgress.stars / 2500) * 100, 6, 100)}%` }} />
        </div>
      </div>
    </aside>
  );

  const topBar = (
    <header className="rounded-[2.4rem] border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(242,246,255,0.92))] px-4 py-4 shadow-[0_18px_60px_rgba(15,23,42,0.16)] backdrop-blur-2xl md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setDrawerOpen(true)} className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg xl:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3 rounded-[1.8rem] bg-[linear-gradient(140deg,#2563eb,#7c3aed,#f43f5e)] px-4 py-3 text-white shadow-[0_18px_45px_rgba(76,29,149,0.34)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-[1.3rem] bg-white/18 text-3xl">🌟</div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-white/80">Escola Divertida</div>
              <div className="text-xl font-black">V9 Premium Kids</div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-yellow-100 px-4 py-2 text-sm font-black text-yellow-700 shadow-sm"><Star className="h-4 w-4 fill-current" /> {activeProgress.stars}</div>
          <div className="flex items-center gap-2 rounded-full bg-sky-100 px-4 py-2 text-sm font-black text-sky-700 shadow-sm">💎 {activeProgress.gems}</div>
          <div className="flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-sm font-black text-red-600 shadow-sm"><Heart className="h-4 w-4 fill-current" /> {activeProgress.hearts}</div>
          <div className="flex items-center gap-2 rounded-full bg-orange-100 px-4 py-2 text-sm font-black text-orange-600 shadow-sm"><Flame className="h-4 w-4 fill-current" /> {activeProgress.streak} dias</div>
          <button type="button" className={`flex items-center gap-3 rounded-full bg-[linear-gradient(135deg,var(--tw-gradient-stops))] px-4 py-2 text-white shadow-lg ${activeProfile.accent}`}>
            <div className="text-2xl">{activeProfile.avatar}</div>
            <div className="text-left">
              <div className="text-sm font-black">{activeProfile.name}</div>
              <div className="text-[11px] font-semibold text-white/80">{activeProfile.age} anos</div>
            </div>
          </button>
        </div>
      </div>
    </header>
  );

  const homePanel = (
    <GlassPanel
      title={`${getTodayPhrase()}, ${activeProfile.name}!`}
      subtitle="Agora o app ficou mais próximo de um jogo infantil premium: blocos grandes, ilhas coloridas, atalhos claros e janelas flutuantes para cada escolha importante."
      badge={catalogStatus === 'remote' ? 'V9 • catálogo V6 remoto ativo' : 'V9 • catálogo local pronto'}
      art={homeArt}
      actions={
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => setPanel('play')} className="rounded-full bg-[linear-gradient(135deg,#84cc16,#10b981)] px-5 py-3 text-sm font-black text-white shadow-lg">Jogar agora</button>
          <button type="button" onClick={() => setPanel('map')} className="rounded-full bg-[linear-gradient(135deg,#60a5fa,#2563eb)] px-5 py-3 text-sm font-black text-white shadow-lg">Ver mapa</button>
          <button type="button" onClick={() => setModalPanel('rewards')} className="rounded-full bg-[linear-gradient(135deg,#8b5cf6,#ec4899)] px-5 py-3 text-sm font-black text-white shadow-lg">Abrir recompensas</button>
        </div>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-[2.3rem] bg-[linear-gradient(135deg,#1d4ed8,#7c3aed,#ec4899)] p-5 text-white shadow-[0_30px_70px_rgba(79,70,229,0.34)]">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <div className="inline-flex rounded-full bg-white/18 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-white/90">Seu mundo mágico</div>
                <h3 className="mt-4 text-3xl font-black leading-tight">Toque, escolha e jogue sem bagunça.</h3>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/88">Tudo foi organizado para a criança encontrar rápido o que quer: jogar, explorar o mapa, abrir packs e ganhar recompensas com clareza visual.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setPanel('play')} className="rounded-full bg-white px-5 py-3 text-sm font-black text-indigo-700 shadow">Continuar aventura</button>
                  <button type="button" onClick={() => openPhase(worldPhaseOrder[lastWorld.game][0])} className="rounded-full bg-yellow-300 px-5 py-3 text-sm font-black text-slate-900 shadow">Fase rápida</button>
                </div>
              </div>
              <div className="rounded-[2rem] border border-white/25 bg-white/14 p-3">
                <img src={homeArt} alt="Moodboard infantil" className="h-56 w-full rounded-[1.6rem] object-cover shadow-lg" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: 'Estrelas', value: activeProgress.stars, tone: 'from-yellow-200 to-amber-200', icon: '⭐' },
              { label: 'Gemas', value: activeProgress.gems, tone: 'from-sky-200 to-cyan-200', icon: '💎' },
              { label: 'Sequência', value: `${activeProgress.streak} dias`, tone: 'from-orange-200 to-red-200', icon: '🔥' },
              { label: 'Prêmios', value: `${activeProgress.rewardsOpened} baús`, tone: 'from-fuchsia-200 to-violet-200', icon: '🎁' },
            ].map((card) => (
              <div key={card.label} className={`rounded-[1.9rem] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${card.tone} p-4 shadow-sm`}>
                <div className="text-3xl">{card.icon}</div>
                <div className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-600">{card.label}</div>
                <div className="mt-1 text-2xl font-black text-slate-950">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-[2.2rem] bg-white/82 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Mundos em destaque</div>
                <div className="mt-1 text-2xl font-black text-slate-950">Escolha por imagem, cor e personagem</div>
              </div>
              <button type="button" onClick={() => setPanel('map')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-black text-white shadow">Ver tudo</button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {worlds.slice(0, 4).map((world) => {
                const stats = worldCompletion(world.game);
                return (
                  <button key={world.game} type="button" onClick={() => { setPanel('play'); setSelectedWorld(world.game); }} className={`group overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${world.colorClass} p-4 text-left shadow-lg`}>
                    <div className="relative overflow-hidden rounded-[1.6rem] border border-white/45">
                      <img src={worldArtwork[world.game]} alt={world.title} className="h-36 w-full object-cover transition duration-500 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 to-transparent" />
                      <div className="absolute left-3 top-3 inline-flex rounded-full bg-white/80 px-2 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-900">{world.age}</div>
                      <div className="absolute bottom-3 left-3 text-4xl">{worldEmoji[world.game]}</div>
                    </div>
                    <div className="mt-4 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xl font-black text-slate-950">{world.shortTitle}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-800">{world.description}</div>
                      </div>
                      <div className="rounded-full bg-white/85 px-3 py-1 text-xs font-black text-indigo-700 shadow">{stats.done}/{stats.total}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2.2rem] bg-[linear-gradient(135deg,#fff7ed,#fef3c7)] p-5 shadow-sm">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-orange-500">Missões do dia</div>
            <div className="mt-3 space-y-3">
              {missionCards.map((mission) => (
                <div key={mission.title} className="rounded-[1.4rem] bg-white/88 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-black text-slate-950">{mission.title}</div>
                    <div className="text-sm font-black text-yellow-600">+{mission.stars}⭐</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">Progresso: {mission.progress}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[2.2rem] bg-[linear-gradient(135deg,#ede9fe,#fdf2f8)] p-5 shadow-sm">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-violet-600">Pack recomendado</div>
            <div className="mt-2 text-2xl font-black text-slate-950">{recommendedPack.title}</div>
            <div className="mt-2 text-sm text-slate-700">{recommendedPack.description}</div>
            <button type="button" onClick={() => setModalPanel('packs')} className="mt-4 rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg">Abrir coleção</button>
          </div>
          <div className="rounded-[2.2rem] bg-[linear-gradient(135deg,#eff6ff,#ecfeff)] p-5 shadow-sm">
            <div className="text-sm font-black uppercase tracking-[0.18em] text-sky-600">Evento em destaque</div>
            <div className="mt-2 text-2xl font-black text-slate-950">{featuredEvent.title}</div>
            <div className="mt-2 text-sm text-slate-700">{featuredEvent.subtitle}</div>
            <button type="button" onClick={() => setModalPanel('events')} className="mt-4 rounded-full bg-sky-600 px-5 py-3 text-sm font-black text-white shadow-lg">Participar</button>
          </div>
        </div>
      </div>
    </GlassPanel>
  );

  const mapPanel = (
    <GlassPanel title="Mapa de progressão" subtitle="Os mundos aparecem como ilhas grandes, com progresso claro, botões chamativos e caminho visual fácil de entender." badge="Mapa cinematográfico" art={mapArt}>
      <div className="rounded-[2.3rem] bg-white/84 p-4 shadow-sm">
        <div className="mb-5 overflow-hidden rounded-[2rem] border border-white/50">
          <img src={mapArt} alt="Mapa lúdico" className="h-48 w-full object-cover" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {worlds.map((world, index) => {
            const stats = worldCompletion(world.game);
            return (
              <button key={world.game} type="button" onClick={() => { setPanel('play'); setSelectedWorld(world.game); }} className={`relative overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${world.colorClass} p-4 text-left shadow-lg`}>
                <div className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/82 text-lg font-black text-slate-900 shadow">{index + 1}</div>
                <div className="relative overflow-hidden rounded-[1.5rem] border border-white/50">
                  <img src={worldArtwork[world.game]} alt={world.title} className="h-36 w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 to-transparent" />
                  <div className="absolute bottom-3 left-3 text-4xl">{worldEmoji[world.game]}</div>
                </div>
                <div className="mt-4 text-2xl font-black text-slate-950">{world.shortTitle}</div>
                <div className="mt-2 text-sm font-semibold text-slate-700">{world.description}</div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex gap-1 text-lg">{Array.from({ length: 3 }).map((_, starIndex) => <span key={`${world.game}-${starIndex}`}>{starIndex < getStarsForRatio(stats.ratio) ? '⭐' : '☆'}</span>)}</div>
                  <div className="rounded-full bg-white/85 px-3 py-2 text-xs font-black uppercase tracking-[0.15em] text-indigo-700 shadow">abrir</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );

  const playPanel = (
    <GlassPanel title="Escolha um mundo para jogar" subtitle="Cada mundo abre uma janela do jogo com objetivos, visual lúdico e fases grandes para a criança tocar sem dificuldade." badge="Launcher infantil" art={gameArt}>
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {worlds.map((world) => {
            const stats = worldCompletion(world.game);
            return (
              <button key={world.game} type="button" onClick={() => setSelectedWorld(world.game)} className={`group overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] p-4 text-left shadow-lg ${world.colorClass}`}>
                <div className="relative overflow-hidden rounded-[1.6rem] border border-white/45">
                  <img src={worldArtwork[world.game]} alt={world.title} className="h-36 w-full object-cover transition duration-500 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 to-transparent" />
                  <div className="absolute bottom-3 left-3 text-4xl">{worldEmoji[world.game]}</div>
                </div>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xl font-black text-slate-950">{world.shortTitle}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-800">{world.age}</div>
                  </div>
                  <div className="rounded-full bg-white/85 px-3 py-1 text-xs font-black text-indigo-700 shadow">{stats.done}/{stats.total}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="rounded-[2.2rem] bg-white/84 p-4 shadow-sm">
          {selectedWorld ? (
            <>
              <div className="overflow-hidden rounded-[1.8rem] border border-white/50">
                <img src={worldArtwork[selectedWorld]} alt={formatWorldName(selectedWorld)} className="h-52 w-full object-cover" />
              </div>
              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-500">Mundo selecionado</div>
                  <div className="mt-1 text-3xl font-black text-slate-950">{formatWorldName(selectedWorld)}</div>
                  <div className="mt-2 text-sm text-slate-700">Toque numa fase grande abaixo para abrir a janela do jogo.</div>
                </div>
                <button type="button" onClick={() => openPhase(worldPhaseOrder[selectedWorld][0])} className="rounded-full bg-[linear-gradient(135deg,#84cc16,#10b981)] px-4 py-3 text-sm font-black text-white shadow-lg">Primeira fase</button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {worldPhaseOrder[selectedWorld].map((phaseId, index) => {
                  const phase = phaseMap[phaseId];
                  const completed = activeProgress.completedPhases.includes(phaseId);
                  return (
                    <button key={phaseId} type="button" onClick={() => openPhase(phaseId)} className={`rounded-[1.6rem] border p-4 text-left shadow-sm ${completed ? 'border-emerald-200 bg-emerald-50' : 'border-indigo-100 bg-[linear-gradient(135deg,#eef2ff,#fff7ed)]'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-black uppercase tracking-[0.18em] text-indigo-500">Fase {index + 1}</div>
                        <div className="text-xl">{completed ? '✅' : worldEmoji[selectedWorld]}</div>
                      </div>
                      <div className="mt-2 text-lg font-black text-slate-950">{phase.title}</div>
                      <div className="mt-2 text-sm text-slate-700">{phase.description}</div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </GlassPanel>
  );

  const packsPanel = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {contentPacks.map((pack) => (
        <div key={pack.id} className={`rounded-[2rem] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] p-5 shadow-lg ${pack.accentClass}`}>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">{pack.ageLabel}</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{pack.title}</div>
          <div className="mt-2 text-sm font-semibold text-slate-800">{pack.description}</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {pack.featureBullets.slice(0, 3).map((bullet) => <span key={bullet} className="rounded-full bg-white/85 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-800">{bullet}</span>)}
          </div>
          <button type="button" onClick={() => openPhase(pack.phaseIds[0])} className="mt-5 rounded-full bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg">Abrir pack</button>
        </div>
      ))}
    </div>
  );

  const eventsPanel = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {seasonalEvents.map((event) => (
        <div key={event.id} className={`rounded-[2rem] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] p-5 text-white shadow-lg ${event.palette}`}>
          <div className="text-4xl">{event.emoji}</div>
          <div className="mt-3 text-2xl font-black">{event.title}</div>
          <div className="mt-2 text-sm font-semibold text-white/90">{event.subtitle}</div>
          <div className="mt-4 rounded-[1.4rem] bg-white/16 p-3 text-sm font-semibold">Meta: {event.targetCompletions} conclusões • {event.rewardLabel}</div>
          <button type="button" onClick={() => openPhase(worldPhaseOrder[event.world][0])} className="mt-4 rounded-full bg-white/90 px-4 py-3 text-sm font-black text-slate-900 shadow">Participar</button>
        </div>
      ))}
    </div>
  );

  const rewardsPanel = (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <div className="rounded-[2rem] bg-[linear-gradient(135deg,#fef3c7,#fdf2f8)] p-5 shadow-sm">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">Cofre encantado</div>
        <div className="mt-2 text-3xl font-black text-slate-950">{activeProgress.rewardsOpened} recompensas prontas</div>
        <div className="mt-3 h-4 overflow-hidden rounded-full bg-white/80">
          <div className="h-full rounded-full bg-[linear-gradient(135deg,#f59e0b,#ec4899)]" style={{ width: `${cap((activeProgress.stars / 2500) * 100, 6, 100)}%` }} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {['Baú dourado', 'Adesivos', 'Troféu estudioso', 'Mascote Estelinha'].map((item, index) => (
            <div key={item} className="rounded-[1.4rem] bg-white/82 p-4 shadow-sm">
              <div className="text-3xl">{['🧰','🎁','🏆','⭐'][index]}</div>
              <div className="mt-2 text-base font-black text-slate-950">{item}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[2rem] bg-[linear-gradient(135deg,#eef2ff,#ecfeff)] p-5 shadow-sm">
        <img src={rewardsArt} alt="Sala de recompensas" className="h-64 w-full rounded-[1.8rem] object-cover shadow-sm" />
        <button type="button" onClick={() => setToast('Recompensa aberta!')} className="mt-5 w-full rounded-[1.8rem] bg-[linear-gradient(135deg,#ef4444,#ec4899)] px-5 py-5 text-lg font-black text-white shadow-lg">Abrir recompensa agora</button>
      </div>
    </div>
  );

  const parentsPanel = (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] bg-white/84 p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">Tempo de uso</div>
          <div className="mt-2 text-4xl font-black text-slate-950">1h 25min</div>
          <div className="mt-2 text-sm text-slate-600">Recomendado: até 2h por dia.</div>
        </div>
        <div className="rounded-[2rem] bg-white/84 p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Mundo favorito</div>
          <div className="mt-2 text-4xl">{worldEmoji[activeProgress.favoriteWorld]}</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{formatWorldName(activeProgress.favoriteWorld)}</div>
        </div>
        <div className="rounded-[2rem] bg-white/84 p-5 shadow-sm md:col-span-2">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">Trilha sugerida</div>
          <div className="mt-2 text-2xl font-black text-slate-950">{activeTrack.title}</div>
          <div className="mt-2 text-sm text-slate-700">{activeTrack.description}</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {activeTrack.days.map((day) => (
              <div key={day.day} className="rounded-[1.4rem] bg-[linear-gradient(135deg,#eef2ff,#fff7ed)] p-3 shadow-sm">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">{day.day}</div>
                <div className="mt-1 text-base font-black text-slate-950">{day.title}</div>
                <div className="mt-1 text-sm text-slate-700">{day.goal}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-[2rem] bg-white/84 p-4 shadow-sm">
        <img src={parentsArt} alt="Painel dos pais" className="h-64 w-full rounded-[1.8rem] object-cover shadow-sm" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {['Áudio', 'Tempo de tela', 'Conteúdo por idade', 'Relatórios'].map((item) => (
            <button key={item} type="button" className="rounded-[1.4rem] bg-[linear-gradient(135deg,#eef2ff,#fff7ed)] px-4 py-4 text-sm font-black text-slate-900 shadow-sm">{item}</button>
          ))}
        </div>
      </div>
    </div>
  );

  const settingsPanel = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Áudio', value: audioEnabled ? 'Ligado' : 'Desligado', onClick: () => setAudioEnabled((value) => !value) },
        { label: 'Modo criança', value: 'Ativo', onClick: () => setToast('Modo criança já está ativo.') },
        { label: 'Catálogo', value: catalogStatus === 'remote' ? 'Remoto' : 'Local', onClick: () => setToast('Catálogo carregado com sucesso.') },
        { label: 'Segurança', value: 'Pais', onClick: () => setModalPanel('parents') },
      ].map((item) => (
        <button key={item.label} type="button" onClick={item.onClick} className="rounded-[2rem] bg-[linear-gradient(135deg,#eef2ff,#fff7ed)] p-5 text-left shadow-sm">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-indigo-500">{item.label}</div>
          <div className="mt-3 text-2xl font-black text-slate-950">{item.value}</div>
        </button>
      ))}
    </div>
  );

  const modalNodes: Record<ModalPanelKey, { title: string; node: React.ReactNode }> = {
    packs: { title: 'Coleções e packs', node: packsPanel },
    events: { title: 'Eventos especiais', node: eventsPanel },
    rewards: { title: 'Recompensas mágicas', node: rewardsPanel },
    parents: { title: 'Painel dos pais', node: parentsPanel },
    settings: { title: 'Configurações rápidas', node: settingsPanel },
  };

  const panelNode = panel === 'home' ? homePanel : panel === 'map' ? mapPanel : playPanel;

  return (
    <div className="premium-app min-h-screen bg-[radial-gradient(circle_at_top_left,#fff7ed_0%,#eef2ff_24%,#dbeafe_46%,#f5d0fe_74%,#fffdf7_100%)] text-slate-900">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-16 top-8 h-72 w-72 rounded-full bg-fuchsia-300/25 blur-3xl" />
        <div className="absolute right-4 top-20 h-96 w-96 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-80 w-80 rounded-full bg-yellow-200/20 blur-3xl" />
        <div className="v9-stars absolute inset-0 opacity-40" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-[1680px] gap-4 px-3 py-3 md:px-5 md:py-5">
        {sidebar}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {topBar}
          <div className="grid gap-4 md:grid-cols-[1fr_auto]">
            <div className="rounded-[2rem] bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-3">
                {quickPanels.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" onClick={() => setModalPanel(item.key)} className={`rounded-full bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${item.tone} px-4 py-3 text-sm font-black text-white shadow-lg`}>
                      <span className="inline-flex items-center gap-2"><Icon className="h-4 w-4" /> {item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="v9-mascot-card rounded-[2rem] bg-[linear-gradient(135deg,#7c3aed,#ec4899)] px-4 py-3 text-white shadow-lg backdrop-blur-xl">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-white/80">Dica da Estelinha</div>
              <div className="mt-1 text-sm font-semibold">Toque nos mundos grandes ou use o menu lateral para abrir janelas mágicas.</div>
            </div>
          </div>
          <div className="relative min-h-[calc(100vh-170px)]">
            <AnimatePresence mode="wait">{panelNode}</AnimatePresence>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              { key: 'home', label: 'Início', icon: Home, tone: 'from-fuchsia-500 to-violet-500' },
              { key: 'play', label: 'Jogar', icon: Play, tone: 'from-lime-500 to-emerald-500' },
              { key: 'map', label: 'Mapa', icon: Map, tone: 'from-sky-500 to-cyan-500' },
              { key: 'parents', label: 'Pais', icon: Users, tone: 'from-blue-500 to-cyan-500' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.key} type="button" onClick={() => openMenuItem(item.key as PanelKey)} className={`rounded-[1.8rem] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${item.tone} px-4 py-4 text-white shadow-lg`}>
                  <span className="flex items-center justify-center gap-2 text-sm font-black"><Icon className="h-5 w-5" /> {item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-slate-950/45 xl:hidden" onClick={() => setDrawerOpen(false)}>
            <motion.div initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} onClick={(event) => event.stopPropagation()} className="absolute left-0 top-0 h-full w-[320px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,244,255,0.98))] p-4 shadow-[0_30px_90px_rgba(15,23,42,0.32)]">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-lg font-black text-slate-950">Menu mágico</div>
                <button type="button" onClick={() => setDrawerOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid gap-3">
                {panelItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" onClick={() => openMenuItem(item.key)} className={`rounded-[1.5rem] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] px-4 py-4 text-left text-white shadow-lg ${item.tone}`}>
                      <div className="flex items-center gap-3"><Icon className="h-5 w-5" /><span className="font-black">{item.label}</span></div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalPanel && (
          <ModalShell title={modalNodes[modalPanel].title} onClose={() => setModalPanel(null)}>
            {modalNodes[modalPanel].node}
          </ModalShell>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPhaseId && (
          <ModalShell title={`${formatWorldName(phaseMap[selectedPhaseId].game)} • ${phaseMap[selectedPhaseId].title}`} onClose={() => setSelectedPhaseId(null)}>
            <GameModalContent phase={phaseMap[selectedPhaseId]} onClose={() => setSelectedPhaseId(null)} onWin={completePhase} />
          </ModalShell>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 22, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 22, scale: 0.94 }}
            className="fixed bottom-5 left-1/2 z-[70] w-[min(92vw,560px)] -translate-x-1/2 rounded-[1.8rem] bg-[linear-gradient(135deg,#1d4ed8,#7c3aed,#ec4899)] px-5 py-4 text-center text-white shadow-[0_24px_90px_rgba(76,29,149,0.42)]"
          >
            <div className="text-sm font-black uppercase tracking-[0.18em] text-white/80">Mensagem do jogo</div>
            <div className="mt-1 text-lg font-black">{toast}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
