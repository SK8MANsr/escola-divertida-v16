import type { ElementType } from 'react';
import { BookOpen, Gamepad2, Palette, Sparkles, Star, Zap } from 'lucide-react';

export type GameKey = 'memory' | 'alphabet' | 'math' | 'shape' | 'colors' | 'maze' | 'puzzle';
export type ShapeId = 'circle' | 'square' | 'triangle' | 'star' | 'diamond' | 'heart';
export type ColorBucketId = 'red' | 'blue' | 'yellow' | 'green';
export type AlphabetPoolTag =
  | 'animals'
  | 'food'
  | 'objects'
  | 'nature'
  | 'transport'
  | 'home'
  | 'mixed';

export type ChildProfile = {
  id: string;
  name: string;
  age: number;
  accent: string;
  avatar: string;
  buddy: string;
  mascotTheme: string;
  createdAt: string;
};

export type ParentSettings = {
  dailyLimitMinutes: number;
  breakReminderMinutes: number;
  audioEnabled: boolean;
  narrationEnabled: boolean;
};

export type DailyUsage = {
  date: string;
  usageByProfile: Record<string, number>;
};

export type PhaseProgress = {
  plays: number;
  completions: number;
  bestStars: number;
  bestScore: number;
  unlocked: boolean;
};

export type SingleGameProgress = {
  plays: number;
  completions: number;
  bestStars: number;
  lastStars: number;
  bestScore: number;
  phases: Record<string, PhaseProgress>;
};

export type ProfileProgress = {
  totalStars: number;
  totalCompletions: number;
  totalPlayTimeSeconds: number;
  bonusStars: number;
  unlockedRewards: string[];
  games: Record<GameKey, SingleGameProgress>;
};

export type SessionHistory = Record<string, string[]>;

export type DailyMissionKind = 'play' | 'complete' | 'world';

export type DailyMissionItem = {
  id: string;
  kind: DailyMissionKind;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardStars: number;
  completed: boolean;
  claimed: boolean;
  world?: GameKey;
};

export type DailyMissionState = {
  date: string;
  missions: DailyMissionItem[];
};

export type CloudSavePayload = {
  version: number;
  profiles: ChildProfile[];
  activeProfileId: string;
  progressMap: Record<string, ProfileProgress>;
  parentSettings: ParentSettings;
  dailyUsage: DailyUsage;
  sessionHistory?: SessionHistory;
  dailyMissionMap?: Record<string, DailyMissionState>;
  onboardingSeen?: Record<string, boolean>;
  seasonClaims?: Record<string, string[]>;
  varietyBonusClaims?: Record<string, string>;
  contentManifestVersion?: number;
};

export type SeasonalEvent = {
  id: string;
  title: string;
  subtitle: string;
  emoji: string;
  world: GameKey;
  targetCompletions: number;
  rewardLabel: string;
  rewardStars: number;
  monthRange: string;
  palette: string;
};

export type ParentWeeklyTrackDay = {
  day: string;
  title: string;
  screen: string;
  offline: string;
  goal: string;
};

export type ParentWeeklyTrack = {
  id: string;
  title: string;
  description: string;
  ageMin: number;
  ageMax: number;
  world?: GameKey;
  isActive: boolean;
  accentClass: string;
  days: ParentWeeklyTrackDay[];
};

export type DynamicContentBlueprint = {
  version: number;
  entities: {
    packs: string;
    packPhases: string;
    seasonalEvents: string;
    weeklyTracks: string;
  };
  note: string;
};

export type GameWorld = {
  game: GameKey;
  title: string;
  shortTitle: string;
  description: string;
  colorClass: string;
  icon: ElementType;
  age: string;
};

export type MemoryPhase = {
  id: string;
  game: 'memory';
  title: string;
  description: string;
  reward: string;
  pairCount: number;
  theme: keyof typeof memoryThemePools;
  movesFor3Stars: number;
  movesFor2Stars: number;
};

export type AlphabetQuestion = {
  emoji: string;
  word: string;
  letter: string;
  options: string[];
};

export type AlphabetPhase = {
  id: string;
  game: 'alphabet';
  title: string;
  description: string;
  reward: string;
  questionCount: number;
  poolTag: AlphabetPoolTag;
};

export type MathPhase = {
  id: string;
  game: 'math';
  title: string;
  description: string;
  reward: string;
  mode: 'count' | 'add' | 'subtract' | 'sequence';
  questionCount: number;
  maxValue: number;
};

export type ShapePhase = {
  id: string;
  game: 'shape';
  title: string;
  description: string;
  reward: string;
  pieceCount: number;
  shapeSet: 'basic' | 'extended';
};

export type ColorsPhase = {
  id: string;
  game: 'colors';
  title: string;
  description: string;
  reward: string;
  bucketCount: 2 | 3 | 4;
  itemCount: number;
};

export type MazePhase = {
  id: string;
  game: 'maze';
  title: string;
  description: string;
  reward: string;
  grid: string[];
  idealSteps: number;
};

export type PuzzleScene = {
  id: string;
  title: string;
  tiles: { id: number; emoji: string; label: string }[];
};

export type PuzzlePhase = {
  id: string;
  game: 'puzzle';
  title: string;
  description: string;
  reward: string;
  scene: PuzzleScene;
};

export type GamePhase = MemoryPhase | AlphabetPhase | MathPhase | ShapePhase | ColorsPhase | MazePhase | PuzzlePhase;

export const highlightPills = [
  'V12 com temporadas e trilhas semanais',
  '7 mundos jogáveis',
  '84 fases com progressão',
  'Packs, eventos e catálogo pronto para Supabase',
];

export const worlds: GameWorld[] = [
  { game: 'memory', title: 'Bosque da Memória', shortTitle: 'Memória', description: 'Temas variados, grades crescentes e rotação de símbolos.', colorClass: 'from-yellow-200 to-pink-200', icon: Star, age: '4–7 anos' },
  { game: 'alphabet', title: 'Cidade das Letras', shortTitle: 'Alfabetização', description: 'Vocabulário infantil, letras iniciais e mais rodadas.', colorClass: 'from-orange-200 to-amber-200', icon: BookOpen, age: '4–7 anos' },
  { game: 'math', title: 'Vale dos Números', shortTitle: 'Matemática', description: 'Contagem, somas, subtrações e sequências em muitas fases.', colorClass: 'from-cyan-200 to-blue-200', icon: Zap, age: '4–7 anos' },
  { game: 'shape', title: 'Ilha do Encaixe', shortTitle: 'Encaixe', description: 'Formas, coordenação motora e tabuleiros progressivos.', colorClass: 'from-fuchsia-200 to-rose-200', icon: Palette, age: '4–6 anos' },
  { game: 'colors', title: 'Jardim das Cores', shortTitle: 'Cores', description: 'Classificação visual com muitas combinações.', colorClass: 'from-emerald-200 to-lime-200', icon: Palette, age: '4–6 anos' },
  { game: 'maze', title: 'Caverna do Tesouro', shortTitle: 'Labirinto', description: 'Mapas diferentes, rotas mais longas e continuidade.', colorClass: 'from-emerald-200 to-teal-200', icon: Gamepad2, age: '5–7 anos' },
  { game: 'puzzle', title: 'Ateliê dos Puzzles', shortTitle: 'Quebra-cabeça', description: 'Muitas cenas e grades variadas para montar.', colorClass: 'from-violet-200 to-pink-200', icon: Sparkles, age: '5–7 anos' },
];

export const methodologyCards = [
  { title: 'Packs por idade e por tema', desc: 'Agora o conteúdo pode ser organizado em coleções prontas, como letras, números, animais, espaço e coordenação, facilitando jornadas mais claras.' },
  { title: 'Biblioteca escalável sem retrabalho', desc: 'Os packs agrupam fases já prontas e preparam o projeto para crescer com novas coleções sem reescrever a lógica central dos jogos.' },
  { title: 'Continuidade com curadoria pedagógica', desc: 'A criança pode seguir packs adequados à idade, ao tema favorito e ao objetivo pedagógico do momento.' },
  { title: 'Base comercial mais forte', desc: 'Agora o projeto não oferece apenas mundos e fases: ele também apresenta trilhas curadas, úteis para retenção, expansão e venda recorrente.' },
];

export const gameDescriptions: Record<GameKey, string> = {
  memory: 'Memória com muitos temas, pares variados e grades maiores.',
  alphabet: 'Alfabetização com várias coleções de palavras e fases mais longas.',
  math: 'Contagem, soma, subtração e sequência com progressão maior.',
  shape: 'Encaixe com mais peças, ritmos e combinações.',
  colors: 'Classificação por cor com dezenas de rodadas possíveis.',
  maze: 'Labirintos em vários formatos e tamanhos.',
  puzzle: 'Quebra-cabeças com muitas cenas e montagens.',
};

export const memoryThemePools = {
  animals: ['🐶', '🐱', '🦊', '🐸', '🐵', '🐼', '🦁', '🐰', '🐻', '🦉'],
  fruits: ['🍎', '🍌', '🍇', '🍉', '🍊', '🍓', '🥝', '🍒', '🍍', '🥥'],
  ocean: ['🐠', '🐙', '🦀', '🐳', '🐬', '🦑', '🐡', '🪼', '🐚', '🐢'],
  space: ['🌟', '🌙', '🪐', '🚀', '☄️', '👽', '🌍', '🛰️', '⭐', '🌌'],
  insects: ['🐞', '🦋', '🐝', '🪲', '🕷️', '🦗', '🐜', '🪰', '🪱', '🪳'],
  transport: ['🚗', '🚕', '🚌', '🚜', '🚂', '✈️', '🚲', '🛴', '🚀', '⛵'],
  dinos: ['🦖', '🦕', '🥚', '🌋', '🦴', '🌿', '☄️', '🪨', '🌴', '🦎'],
  garden: ['🌷', '🌻', '🌼', '🍄', '🌳', '🌈', '🌸', '🪻', '🌺', '🍀'],
  weather: ['☀️', '🌤️', '⛅', '🌧️', '⛈️', '🌈', '❄️', '🌪️', '🌙', '💧'],
  toys: ['🧸', '🚂', '🎈', '🪁', '🪀', '🛝', '🎠', '🎲', '🎨', '🪇'],
  farm: ['🐮', '🐷', '🐔', '🐑', '🐴', '🧑‍🌾', '🚜', '🌾', '🥚', '🐐'],
  music: ['🎵', '🎶', '🥁', '🎺', '🎸', '🎹', '🎤', '🪗', '🪘', '🎻'],
};

const alphabetBasePools: Record<Exclude<AlphabetPoolTag, 'mixed'>, AlphabetQuestion[]> = {
  animals: [
    { emoji: '🐶', word: 'Cachorro', letter: 'C', options: ['C', 'P', 'G'] },
    { emoji: '🐱', word: 'Gato', letter: 'G', options: ['G', 'M', 'S'] },
    { emoji: '🦁', word: 'Leão', letter: 'L', options: ['L', 'N', 'B'] },
    { emoji: '🐸', word: 'Sapo', letter: 'S', options: ['S', 'C', 'F'] },
    { emoji: '🐰', word: 'Coelho', letter: 'C', options: ['C', 'Q', 'B'] },
    { emoji: '🐵', word: 'Macaco', letter: 'M', options: ['M', 'J', 'T'] },
    { emoji: '🦊', word: 'Raposa', letter: 'R', options: ['R', 'L', 'P'] },
    { emoji: '🐻', word: 'Urso', letter: 'U', options: ['U', 'O', 'A'] },
  ],
  food: [
    { emoji: '🍌', word: 'Banana', letter: 'B', options: ['B', 'L', 'P'] },
    { emoji: '🍎', word: 'Maçã', letter: 'M', options: ['M', 'N', 'R'] },
    { emoji: '🍇', word: 'Uva', letter: 'U', options: ['U', 'A', 'I'] },
    { emoji: '🍉', word: 'Melancia', letter: 'M', options: ['M', 'H', 'V'] },
    { emoji: '🥕', word: 'Cenoura', letter: 'C', options: ['C', 'S', 'T'] },
    { emoji: '🍍', word: 'Abacaxi', letter: 'A', options: ['A', 'E', 'O'] },
    { emoji: '🍒', word: 'Cereja', letter: 'C', options: ['C', 'B', 'D'] },
    { emoji: '🥥', word: 'Coco', letter: 'C', options: ['C', 'F', 'J'] },
  ],
  objects: [
    { emoji: '🚗', word: 'Carro', letter: 'C', options: ['C', 'K', 'D'] },
    { emoji: '✈️', word: 'Avião', letter: 'A', options: ['A', 'P', 'O'] },
    { emoji: '🏠', word: 'Casa', letter: 'C', options: ['C', 'G', 'H'] },
    { emoji: '📚', word: 'Livro', letter: 'L', options: ['L', 'D', 'R'] },
    { emoji: '🎈', word: 'Balão', letter: 'B', options: ['B', 'F', 'T'] },
    { emoji: '🚲', word: 'Bicicleta', letter: 'B', options: ['B', 'V', 'S'] },
    { emoji: '🪁', word: 'Pipa', letter: 'P', options: ['P', 'G', 'Q'] },
    { emoji: '🎒', word: 'Mochila', letter: 'M', options: ['M', 'N', 'H'] },
  ],
  nature: [
    { emoji: '🌞', word: 'Sol', letter: 'S', options: ['S', 'C', 'L'] },
    { emoji: '🌙', word: 'Lua', letter: 'L', options: ['L', 'M', 'N'] },
    { emoji: '🌳', word: 'Árvore', letter: 'A', options: ['A', 'R', 'T'] },
    { emoji: '🌸', word: 'Flor', letter: 'F', options: ['F', 'V', 'P'] },
    { emoji: '🌈', word: 'Arco-íris', letter: 'A', options: ['A', 'I', 'E'] },
    { emoji: '⛅', word: 'Nuvem', letter: 'N', options: ['N', 'U', 'D'] },
    { emoji: '🍄', word: 'Cogumelo', letter: 'C', options: ['C', 'G', 'M'] },
    { emoji: '🌊', word: 'Onda', letter: 'O', options: ['O', 'U', 'I'] },
  ],
  transport: [
    { emoji: '🚂', word: 'Trem', letter: 'T', options: ['T', 'D', 'B'] },
    { emoji: '🚜', word: 'Trator', letter: 'T', options: ['T', 'C', 'G'] },
    { emoji: '🚌', word: 'Ônibus', letter: 'O', options: ['O', 'U', 'A'] },
    { emoji: '🚀', word: 'Foguete', letter: 'F', options: ['F', 'V', 'P'] },
    { emoji: '⛵', word: 'Barco', letter: 'B', options: ['B', 'R', 'D'] },
    { emoji: '🛴', word: 'Patinete', letter: 'P', options: ['P', 'Q', 'S'] },
    { emoji: '🚑', word: 'Ambulância', letter: 'A', options: ['A', 'E', 'I'] },
    { emoji: '🚓', word: 'Viatura', letter: 'V', options: ['V', 'B', 'W'] },
  ],
  home: [
    { emoji: '🛏️', word: 'Cama', letter: 'C', options: ['C', 'K', 'L'] },
    { emoji: '🪥', word: 'Escova', letter: 'E', options: ['E', 'I', 'F'] },
    { emoji: '🚿', word: 'Chuveiro', letter: 'C', options: ['C', 'J', 'S'] },
    { emoji: '🪑', word: 'Cadeira', letter: 'C', options: ['C', 'Q', 'L'] },
    { emoji: '🍽️', word: 'Prato', letter: 'P', options: ['P', 'B', 'R'] },
    { emoji: '🧸', word: 'Urso', letter: 'U', options: ['U', 'A', 'O'] },
    { emoji: '🕰️', word: 'Relógio', letter: 'R', options: ['R', 'L', 'N'] },
    { emoji: '🪟', word: 'Janela', letter: 'J', options: ['J', 'G', 'I'] },
  ],
};

export const alphabetPools: Record<AlphabetPoolTag, AlphabetQuestion[]> = {
  ...alphabetBasePools,
  mixed: Object.values(alphabetBasePools).flat(),
};

export const shapeLibrary = [
  { id: 'circle' as const, label: 'Círculo', color: '#F59E0B' },
  { id: 'square' as const, label: 'Quadrado', color: '#3B82F6' },
  { id: 'triangle' as const, label: 'Triângulo', color: '#10B981' },
  { id: 'star' as const, label: 'Estrela', color: '#EC4899' },
  { id: 'diamond' as const, label: 'Losango', color: '#8B5CF6' },
  { id: 'heart' as const, label: 'Coração', color: '#EF4444' },
];

export const colorItems = [
  { id: 'apple', emoji: '🍎', label: 'Maçã', color: 'red' as const },
  { id: 'car', emoji: '🚗', label: 'Carrinho', color: 'red' as const },
  { id: 'ladybug', emoji: '🐞', label: 'Joaninha', color: 'red' as const },
  { id: 'strawberry', emoji: '🍓', label: 'Morango', color: 'red' as const },
  { id: 'fish', emoji: '🐟', label: 'Peixe', color: 'blue' as const },
  { id: 'balloon', emoji: '🎈', label: 'Balão', color: 'blue' as const },
  { id: 'whale', emoji: '🐋', label: 'Baleia', color: 'blue' as const },
  { id: 'rain', emoji: '💧', label: 'Gota', color: 'blue' as const },
  { id: 'sun', emoji: '☀️', label: 'Sol', color: 'yellow' as const },
  { id: 'banana', emoji: '🍌', label: 'Banana', color: 'yellow' as const },
  { id: 'starshine', emoji: '⭐', label: 'Estrela', color: 'yellow' as const },
  { id: 'duck', emoji: '🐤', label: 'Patinho', color: 'yellow' as const },
  { id: 'frog', emoji: '🐸', label: 'Sapo', color: 'green' as const },
  { id: 'tree', emoji: '🌳', label: 'Árvore', color: 'green' as const },
  { id: 'leaf', emoji: '🍃', label: 'Folha', color: 'green' as const },
  { id: 'broccoli', emoji: '🥦', label: 'Brócolis', color: 'green' as const },
];

export const colorBuckets = [
  { id: 'red' as const, label: 'Vermelho', colorClass: 'bg-red-100 text-red-700' },
  { id: 'blue' as const, label: 'Azul', colorClass: 'bg-sky-100 text-sky-700' },
  { id: 'yellow' as const, label: 'Amarelo', colorClass: 'bg-yellow-100 text-yellow-700' },
  { id: 'green' as const, label: 'Verde', colorClass: 'bg-emerald-100 text-emerald-700' },
];

export const puzzleScenes: PuzzleScene[] = [
  { id: 'farm', title: 'Fazendinha feliz', tiles: [{ id: 0, emoji: '🌞', label: 'Sol' }, { id: 1, emoji: '🐮', label: 'Vaca' }, { id: 2, emoji: '🌾', label: 'Trigo' }, { id: 3, emoji: '🚜', label: 'Trator' }] },
  { id: 'space', title: 'Passeio espacial', tiles: [{ id: 0, emoji: '🚀', label: 'Foguete' }, { id: 1, emoji: '🌙', label: 'Lua' }, { id: 2, emoji: '🪐', label: 'Planeta' }, { id: 3, emoji: '👽', label: 'Alien' }] },
  { id: 'ocean', title: 'Fundo do mar', tiles: [{ id: 0, emoji: '🐠', label: 'Peixe' }, { id: 1, emoji: '🪸', label: 'Coral' }, { id: 2, emoji: '🐢', label: 'Tartaruga' }, { id: 3, emoji: '🐚', label: 'Concha' }, { id: 4, emoji: '🐙', label: 'Polvo' }, { id: 5, emoji: '🌊', label: 'Onda' }] },
  { id: 'park', title: 'Parque da aventura', tiles: [{ id: 0, emoji: '🎡', label: 'Roda-gigante' }, { id: 1, emoji: '🎈', label: 'Balão' }, { id: 2, emoji: '🧸', label: 'Urso' }, { id: 3, emoji: '🍿', label: 'Pipoca' }, { id: 4, emoji: '🎠', label: 'Carrossel' }, { id: 5, emoji: '🍭', label: 'Pirulito' }] },
  { id: 'dinoland', title: 'Vale dos dinossauros', tiles: [{ id: 0, emoji: '🦖', label: 'T-Rex' }, { id: 1, emoji: '🦕', label: 'Dino' }, { id: 2, emoji: '🥚', label: 'Ovo' }, { id: 3, emoji: '🌋', label: 'Vulcão' }] },
  { id: 'music', title: 'Banda da alegria', tiles: [{ id: 0, emoji: '🥁', label: 'Tambor' }, { id: 1, emoji: '🎸', label: 'Violão' }, { id: 2, emoji: '🎹', label: 'Piano' }, { id: 3, emoji: '🎤', label: 'Microfone' }, { id: 4, emoji: '🎶', label: 'Notas' }, { id: 5, emoji: '🎺', label: 'Trompete' }] },
  { id: 'garden', title: 'Jardim encantado', tiles: [{ id: 0, emoji: '🌷', label: 'Tulipa' }, { id: 1, emoji: '🦋', label: 'Borboleta' }, { id: 2, emoji: '🌈', label: 'Arco-íris' }, { id: 3, emoji: '🍄', label: 'Cogumelo' }] },
  { id: 'winter', title: 'Dia geladinho', tiles: [{ id: 0, emoji: '❄️', label: 'Neve' }, { id: 1, emoji: '⛄', label: 'Boneco' }, { id: 2, emoji: '🧣', label: 'Cachecol' }, { id: 3, emoji: '🧤', label: 'Luva' }, { id: 4, emoji: '🛷', label: 'Trenó' }, { id: 5, emoji: '🌨️', label: 'Nevasca' }] },
  { id: 'city', title: 'Cidade divertida', tiles: [{ id: 0, emoji: '🏠', label: 'Casa' }, { id: 1, emoji: '🚦', label: 'Sinal' }, { id: 2, emoji: '🏫', label: 'Escola' }, { id: 3, emoji: '🚲', label: 'Bike' }] },
  { id: 'forest', title: 'Trilha da floresta', tiles: [{ id: 0, emoji: '🦉', label: 'Coruja' }, { id: 1, emoji: '🌲', label: 'Pinheiro' }, { id: 2, emoji: '🦊', label: 'Raposa' }, { id: 3, emoji: '🍁', label: 'Folha' }, { id: 4, emoji: '🪵', label: 'Tronco' }, { id: 5, emoji: '🌰', label: 'Noz' }] },
  { id: 'beach', title: 'Praia colorida', tiles: [{ id: 0, emoji: '🏖️', label: 'Praia' }, { id: 1, emoji: '🪣', label: 'Balde' }, { id: 2, emoji: '🦀', label: 'Caranguejo' }, { id: 3, emoji: '🌴', label: 'Palmeira' }] },
  { id: 'circus', title: 'Circo brilhante', tiles: [{ id: 0, emoji: '🎪', label: 'Tenda' }, { id: 1, emoji: '🤹', label: 'Malabarista' }, { id: 2, emoji: '🎟️', label: 'Ingresso' }, { id: 3, emoji: '🦁', label: 'Leão' }, { id: 4, emoji: '🎈', label: 'Balão' }, { id: 5, emoji: '🥁', label: 'Rufar' }] },
];

const memoryPhaseSpecs = [
  { theme: 'animals', pairCount: 3, title: 'Animais do bosque', reward: 'Adesivo Patinhas' },
  { theme: 'fruits', pairCount: 4, title: 'Frutinhas brilhantes', reward: 'Medalha Frutal' },
  { theme: 'ocean', pairCount: 5, title: 'Mergulho no oceano', reward: 'Concha Dourada' },
  { theme: 'space', pairCount: 6, title: 'Missão espacial', reward: 'Estrela Cadente' },
  { theme: 'insects', pairCount: 4, title: 'Insetos mágicos', reward: 'Selo da Joaninha' },
  { theme: 'transport', pairCount: 5, title: 'Pista dos veículos', reward: 'Volante Dourado' },
  { theme: 'dinos', pairCount: 6, title: 'Dinossauros curiosos', reward: 'Ovo Pré-histórico' },
  { theme: 'garden', pairCount: 7, title: 'Jardim encantado', reward: 'Flor Rara' },
  { theme: 'weather', pairCount: 6, title: 'Tempo maluco', reward: 'Nuvem Feliz' },
  { theme: 'toys', pairCount: 7, title: 'Brinquedoteca', reward: 'Caixa Surpresa' },
  { theme: 'farm', pairCount: 8, title: 'Dia na fazenda', reward: 'Trator de Ouro' },
  { theme: 'music', pairCount: 8, title: 'Notas dançantes', reward: 'Medalha Musical' },
] as const;

const alphabetPhaseSpecs = [
  { poolTag: 'animals', questionCount: 4, title: 'Bichos falantes', reward: 'Selo do ABC Animal' },
  { poolTag: 'food', questionCount: 5, title: 'Frutas e letras', reward: 'Troféu da Banana' },
  { poolTag: 'objects', questionCount: 5, title: 'Objetos do dia', reward: 'Chave da Leitura' },
  { poolTag: 'nature', questionCount: 5, title: 'Natureza que fala', reward: 'Flor do Alfabeto' },
  { poolTag: 'transport', questionCount: 5, title: 'Transporte esperto', reward: 'Hélice de Letras' },
  { poolTag: 'home', questionCount: 5, title: 'Casa das palavrinhas', reward: 'Chave do Lar' },
  { poolTag: 'animals', questionCount: 6, title: 'Safari das iniciais', reward: 'Binóculo Dourado' },
  { poolTag: 'food', questionCount: 6, title: 'Cozinha das letras', reward: 'Colher do ABC' },
  { poolTag: 'objects', questionCount: 6, title: 'Oficina da leitura', reward: 'Caixa de Ferramentas' },
  { poolTag: 'nature', questionCount: 7, title: 'Trilha da floresta', reward: 'Folha de Cristal' },
  { poolTag: 'transport', questionCount: 7, title: 'Rota das palavras', reward: 'Passaporte Letrado' },
  { poolTag: 'mixed', questionCount: 8, title: 'Mistura inteligente', reward: 'Faixa Pequeno Leitor' },
] as const;

const mathPhaseSpecs = [
  { mode: 'count', questionCount: 4, maxValue: 5, title: 'Conta as estrelinhas', reward: 'Insígnia Contador' },
  { mode: 'add', questionCount: 4, maxValue: 6, title: 'Somas curtinhas', reward: 'Moeda da Soma' },
  { mode: 'subtract', questionCount: 5, maxValue: 8, title: 'Descobrir o que falta', reward: 'Escudo Numérico' },
  { mode: 'sequence', questionCount: 5, maxValue: 10, title: 'Sequência esperta', reward: 'Coroa dos Números' },
  { mode: 'count', questionCount: 5, maxValue: 7, title: 'Contagem do jardim', reward: 'Flor Contadora' },
  { mode: 'add', questionCount: 5, maxValue: 8, title: 'Soma colorida', reward: 'Arco da Soma' },
  { mode: 'subtract', questionCount: 6, maxValue: 10, title: 'Subtração leve', reward: 'Chave do Menos' },
  { mode: 'sequence', questionCount: 6, maxValue: 12, title: 'Padrões mágicos', reward: 'Ampulheta Numérica' },
  { mode: 'count', questionCount: 6, maxValue: 10, title: 'Conta sem medo', reward: 'Estrela Contadora' },
  { mode: 'add', questionCount: 6, maxValue: 10, title: 'Pontes da soma', reward: 'Ponte Dourada' },
  { mode: 'subtract', questionCount: 7, maxValue: 12, title: 'Missão do menos', reward: 'Meteorito Matemático' },
  { mode: 'sequence', questionCount: 7, maxValue: 15, title: 'Trilha dos números', reward: 'Troféu da Sequência' },
] as const;

const shapePhaseSpecs = [
  { pieceCount: 4, shapeSet: 'basic', title: 'Formas básicas', reward: 'Selo das Formas' },
  { pieceCount: 5, shapeSet: 'extended', title: 'Formas coloridas', reward: 'Medalha do Encaixe' },
  { pieceCount: 6, shapeSet: 'extended', title: 'Encaixe rápido', reward: 'Relâmpago Geométrico' },
  { pieceCount: 6, shapeSet: 'extended', title: 'Mestre das formas', reward: 'Taça da Coordenação' },
  { pieceCount: 4, shapeSet: 'basic', title: 'Ritmo das figuras', reward: 'Tambor da Forma' },
  { pieceCount: 5, shapeSet: 'extended', title: 'Desafio do coração', reward: 'Pingente do Coração' },
  { pieceCount: 6, shapeSet: 'extended', title: 'Peças do arco-íris', reward: 'Arco de Blocos' },
  { pieceCount: 6, shapeSet: 'extended', title: 'Corrida geométrica', reward: 'Medalha Relâmpago' },
  { pieceCount: 4, shapeSet: 'basic', title: 'Primeiro tabuleiro', reward: 'Adesivo Quadradinho' },
  { pieceCount: 5, shapeSet: 'extended', title: 'Formas na ilha', reward: 'Concha Geométrica' },
  { pieceCount: 6, shapeSet: 'extended', title: 'Super encaixe', reward: 'Cinturão das Peças' },
  { pieceCount: 6, shapeSet: 'extended', title: 'Final das figuras', reward: 'Cetro Geométrico' },
] as const;

const colorsPhaseSpecs = [
  { bucketCount: 2, itemCount: 6, title: 'Dois cestos felizes', reward: 'Adesivo da Tinta' },
  { bucketCount: 3, itemCount: 8, title: 'Trio colorido', reward: 'Pingente Colorido' },
  { bucketCount: 4, itemCount: 8, title: 'Jardim completo', reward: 'Flor de Arco-íris' },
  { bucketCount: 4, itemCount: 10, title: 'Classificação relâmpago', reward: 'Coroa Colorida' },
  { bucketCount: 2, itemCount: 8, title: 'Caça às cores', reward: 'Lupa Pintada' },
  { bucketCount: 3, itemCount: 9, title: 'Cestos dançantes', reward: 'Laço Brilhante' },
  { bucketCount: 4, itemCount: 12, title: 'Festival das tintas', reward: 'Pincel do Festival' },
  { bucketCount: 4, itemCount: 12, title: 'Mistura sem erro', reward: 'Troféu da Mistura' },
  { bucketCount: 2, itemCount: 10, title: 'Duelo de cores', reward: 'Faixa Veloz' },
  { bucketCount: 3, itemCount: 12, title: 'Caminho colorido', reward: 'Pedra Pintada' },
  { bucketCount: 4, itemCount: 14, title: 'Jardim supremo', reward: 'Buquê Brilhante' },
  { bucketCount: 4, itemCount: 16, title: 'Mestre da classificação', reward: 'Diamante Colorido' },
] as const;

const mazeGrids = [
  { title: 'Trilha do mapa', reward: 'Chave do Bosque', grid: ['#######', '#S....#', '#.###.#', '#...#T#', '#######'], idealSteps: 6 },
  { title: 'Caverna pequena', reward: 'Pedra Brilhante', grid: ['########', '#S#....#', '#.#.##.#', '#...##T#', '########'], idealSteps: 8 },
  { title: 'Passagem secreta', reward: 'Mapa do Tesouro', grid: ['#########', '#S......#', '#.#####.#', '#...#...#', '###.#.#T#', '#.......#', '#########'], idealSteps: 12 },
  { title: 'Corredor do tesouro', reward: 'Baú Dourado', grid: ['#########', '#S#.....#', '#.#.###.#', '#.#...#.#', '#.###.#.#', '#.....#T#', '#########'], idealSteps: 14 },
  { title: 'Volta da montanha', reward: 'Pedra do Pico', grid: ['#########', '#S....#T#', '###.#.#.#', '#...#...#', '#.#####.#', '#.......#', '#########'], idealSteps: 12 },
  { title: 'Rota do rio', reward: 'Gota Cristalina', grid: ['##########', '#S.......#', '#.######.#', '#.#....#.#', '#.#.##.#T#', '#...##...#', '##########'], idealSteps: 15 },
  { title: 'Sala dos ecos', reward: 'Eco Misterioso', grid: ['##########', '#S#......#', '#.#.####.#', '#.#....#.#', '#.####.#.#', '#......#T#', '##########'], idealSteps: 16 },
  { title: 'Coruja guardiã', reward: 'Pena da Coruja', grid: ['###########', '#S....#...#', '#.###.#.#.#', '#...#...#.#', '###.#####.#', '#.......#T#', '###########'], idealSteps: 18 },
  { title: 'Trilha congelante', reward: 'Floco Dourado', grid: ['###########', '#S#.......#', '#.#.#####.#', '#.#...#...#', '#.###.#.###', '#.....#..T#', '###########'], idealSteps: 18 },
  { title: 'Selva escondida', reward: 'Folha Esmeralda', grid: ['############', '#S...#.....#', '###.#.#.##.#', '#...#.#....#', '#.###.####.#', '#.....#...T#', '############'], idealSteps: 20 },
  { title: 'Ponte do castelo', reward: 'Escudo do Portal', grid: ['############', '#S.......#T#', '#.#####.#..#', '#.....#.#.##', '###.#.#.#..#', '#...#...#..#', '############'], idealSteps: 20 },
  { title: 'Mestre do labirinto', reward: 'Cetro do Tesouro', grid: ['############', '#S#........#', '#.#.######.#', '#.#.#....#.#', '#...#.##.#.#', '###.#....#T#', '############'], idealSteps: 22 },
] as const;

const puzzlePhaseSpecs = [
  { title: 'Fazendinha 2x2', reward: 'Adesivo da Fazenda', scene: puzzleScenes[0] },
  { title: 'Espaço 2x2', reward: 'Selo do Espaço', scene: puzzleScenes[1] },
  { title: 'Mar 3x2', reward: 'Concha Montada', scene: puzzleScenes[2] },
  { title: 'Parque 3x2', reward: 'Bilhete de Diversão', scene: puzzleScenes[3] },
  { title: 'Dinossauros 2x2', reward: 'Ovo Montado', scene: puzzleScenes[4] },
  { title: 'Banda 3x2', reward: 'Palheta Musical', scene: puzzleScenes[5] },
  { title: 'Jardim 2x2', reward: 'Borboleta de Cristal', scene: puzzleScenes[6] },
  { title: 'Inverno 3x2', reward: 'Cachecol Brilhante', scene: puzzleScenes[7] },
  { title: 'Cidade 2x2', reward: 'Placa da Cidade', scene: puzzleScenes[8] },
  { title: 'Floresta 3x2', reward: 'Medalha da Trilha', scene: puzzleScenes[9] },
  { title: 'Praia 2x2', reward: 'Balde Dourado', scene: puzzleScenes[10] },
  { title: 'Circo 3x2', reward: 'Ingresso Diamante', scene: puzzleScenes[11] },
] as const;

const makePhaseId = (game: GameKey, index: number) => `${game}-${index + 1}`;

const memoryPhases: MemoryPhase[] = memoryPhaseSpecs.map((spec, index) => ({
  id: makePhaseId('memory', index),
  game: 'memory',
  title: spec.title,
  description: `${spec.pairCount} pares com tema ${spec.theme} e dificuldade progressiva.`,
  reward: spec.reward,
  pairCount: spec.pairCount,
  theme: spec.theme,
  movesFor3Stars: spec.pairCount * 2 + 1,
  movesFor2Stars: spec.pairCount * 2 + 5,
}));

const alphabetPhases: AlphabetPhase[] = alphabetPhaseSpecs.map((spec, index) => ({
  id: makePhaseId('alphabet', index),
  game: 'alphabet',
  title: spec.title,
  description: `${spec.questionCount} perguntas com palavras do conjunto ${spec.poolTag === 'mixed' ? 'misturado' : spec.poolTag}.`,
  reward: spec.reward,
  questionCount: spec.questionCount,
  poolTag: spec.poolTag,
}));

const mathPhases: MathPhase[] = mathPhaseSpecs.map((spec, index) => ({
  id: makePhaseId('math', index),
  game: 'math',
  title: spec.title,
  description: `${spec.questionCount} desafios de ${spec.mode === 'count' ? 'contagem' : spec.mode === 'add' ? 'adição' : spec.mode === 'subtract' ? 'subtração' : 'sequência'} até ${spec.maxValue}.`,
  reward: spec.reward,
  mode: spec.mode,
  questionCount: spec.questionCount,
  maxValue: spec.maxValue,
}));

const shapePhases: ShapePhase[] = shapePhaseSpecs.map((spec, index) => ({
  id: makePhaseId('shape', index),
  game: 'shape',
  title: spec.title,
  description: `${spec.pieceCount} peças para encaixar com foco em coordenação e leitura visual.`,
  reward: spec.reward,
  pieceCount: spec.pieceCount,
  shapeSet: spec.shapeSet,
}));

const colorsPhases: ColorsPhase[] = colorsPhaseSpecs.map((spec, index) => ({
  id: makePhaseId('colors', index),
  game: 'colors',
  title: spec.title,
  description: `${spec.itemCount} objetos distribuídos em ${spec.bucketCount} cestos coloridos.`,
  reward: spec.reward,
  bucketCount: spec.bucketCount,
  itemCount: spec.itemCount,
}));

const mazePhases: MazePhase[] = mazeGrids.map((spec, index) => ({
  id: makePhaseId('maze', index),
  game: 'maze',
  title: spec.title,
  description: 'Encontre o tesouro escolhendo um bom caminho sem bater nas paredes.',
  reward: spec.reward,
  grid: [...spec.grid],
  idealSteps: spec.idealSteps,
}));

const puzzlePhases: PuzzlePhase[] = puzzlePhaseSpecs.map((spec, index) => ({
  id: makePhaseId('puzzle', index),
  game: 'puzzle',
  title: spec.title,
  description: `Monte a cena ${spec.scene.title.toLowerCase()} trocando peças de lugar.`,
  reward: spec.reward,
  scene: spec.scene,
}));

export const phases: Record<GameKey, GamePhase[]> = {
  memory: memoryPhases,
  alphabet: alphabetPhases,
  math: mathPhases,
  shape: shapePhases,
  colors: colorsPhases,
  maze: mazePhases,
  puzzle: puzzlePhases,
};

export const worldPhaseOrder: Record<GameKey, string[]> = Object.fromEntries(
  (Object.keys(phases) as GameKey[]).map((game) => [game, phases[game].map((phase) => phase.id)])
) as Record<GameKey, string[]>;

export const phaseMap = Object.values(phases).flat().reduce<Record<string, GamePhase>>((acc, phase) => {
  acc[phase.id] = phase;
  return acc;
}, {});

export type ContentPack = {
  id: string;
  title: string;
  ageLabel: string;
  recommendedAges: number[];
  themeLabel: string;
  description: string;
  accentClass: string;
  mascotTip: string;
  phaseIds: string[];
  featureBullets: string[];
};

const slicePhases = (game: GameKey, start: number, end: number) => worldPhaseOrder[game].slice(start - 1, end);

export const contentPacks: ContentPack[] = [
  {
    id: 'pack-primeiros-passos',
    title: 'Primeiros Passos',
    ageLabel: '4–5 anos',
    recommendedAges: [4, 5],
    themeLabel: 'Adaptação inicial',
    description: 'Coleção suave para começo de jornada, com foco em reconhecimento visual, memória curta, cores e encaixe simples.',
    accentClass: 'from-pink-300 to-orange-200',
    mascotTip: 'Ideal para começar sem sobrecarga: regras curtas, vitórias rápidas e muita confiança para a criança.',
    phaseIds: [...slicePhases('shape', 1, 4), ...slicePhases('colors', 1, 4), ...slicePhases('memory', 1, 2), ...slicePhases('alphabet', 1, 2)],
    featureBullets: ['coordenação motora fina', 'toques simples', 'feedback rápido', 'entrada suave no app'],
  },
  {
    id: 'pack-animais-fazenda',
    title: 'Animais e Fazenda',
    ageLabel: '4–6 anos',
    recommendedAges: [4, 5, 6],
    themeLabel: 'Natureza e bichinhos',
    description: 'Mistura memória, letras, quebra-cabeça e classificação com repertório de animais, fazenda e natureza.',
    accentClass: 'from-emerald-300 to-lime-200',
    mascotTip: 'Ótimo para crianças que se engajam mais quando reconhecem personagens e cenários do cotidiano.',
    phaseIds: ['memory-1', 'memory-7', 'memory-11', 'alphabet-1', 'alphabet-4', 'colors-1', 'puzzle-1', 'puzzle-10', 'math-1', 'shape-2', 'maze-1', 'maze-10'],
    featureBullets: ['reconhecimento de animais', 'vocabulário concreto', 'cenas familiares', 'atenção visual'],
  },
  {
    id: 'pack-letras-palavras',
    title: 'Letras e Palavras',
    ageLabel: '5–7 anos',
    recommendedAges: [5, 6, 7],
    themeLabel: 'Alfabetização',
    description: 'Trilha focada em reconhecimento de letras iniciais, palavras do cotidiano e leitura visual gradual.',
    accentClass: 'from-yellow-300 to-amber-200',
    mascotTip: 'Boa para momentos de estudo leve, com poucas frustrações e muitas respostas rápidas.',
    phaseIds: [...slicePhases('alphabet', 1, 12)],
    featureBullets: ['letra inicial', 'vocabulário infantil', 'resposta por escolha', 'continuidade alfabetizadora'],
  },
  {
    id: 'pack-numeros-contas',
    title: 'Números e Contas',
    ageLabel: '5–7 anos',
    recommendedAges: [5, 6, 7],
    themeLabel: 'Matemática lúdica',
    description: 'Coleção inteira do Vale dos Números, com contagem, adição, subtração e sequência em progressão contínua.',
    accentClass: 'from-cyan-300 to-sky-200',
    mascotTip: 'Excelente para construir segurança com números antes de exigir operações mais longas.',
    phaseIds: [...slicePhases('math', 1, 12)],
    featureBullets: ['contagem visual', 'adição ilustrada', 'subtração leve', 'sequência numérica'],
  },
  {
    id: 'pack-cores-formas',
    title: 'Cores e Formas',
    ageLabel: '4–5 anos',
    recommendedAges: [4, 5],
    themeLabel: 'Coordenação e classificação',
    description: 'Trilha dedicada a encaixe, classificação por cor e leitura visual de formas geométricas.',
    accentClass: 'from-fuchsia-300 to-pink-200',
    mascotTip: 'Perfeito para pré-leitores que aprendem melhor com arrastar, tocar e comparar elementos visuais.',
    phaseIds: [...slicePhases('shape', 1, 12), ...slicePhases('colors', 1, 6)],
    featureBullets: ['encaixe guiado', 'formas geométricas', 'classificação por cor', 'coordenação visual'],
  },
  {
    id: 'pack-aventura-espacial',
    title: 'Aventura Espacial',
    ageLabel: '5–7 anos',
    recommendedAges: [5, 6, 7],
    themeLabel: 'Espaço e descoberta',
    description: 'Mistura espaço, rotas, contagem e puzzles para crianças que gostam de universo, foguetes e exploração.',
    accentClass: 'from-indigo-400 to-sky-300',
    mascotTip: 'Uma boa coleção para sustentar engajamento longo com um tema muito forte e fantasioso.',
    phaseIds: ['memory-4', 'alphabet-6', 'math-4', 'math-8', 'maze-3', 'maze-8', 'puzzle-2', 'puzzle-8', 'colors-8', 'shape-7'],
    featureBullets: ['tema espacial', 'missões com fantasia', 'raciocínio leve', 'puzzles temáticos'],
  },
  {
    id: 'pack-logica-e-rotas',
    title: 'Lógica e Rotas',
    ageLabel: '6–7 anos',
    recommendedAges: [6, 7],
    themeLabel: 'Raciocínio e estratégia leve',
    description: 'Coleção com labirintos, sequências e desafios que pedem mais planejamento sem sair da linguagem infantil.',
    accentClass: 'from-teal-300 to-emerald-200',
    mascotTip: 'Ideal para quando a criança já busca um pouco mais de desafio e gosta de pensar antes de agir.',
    phaseIds: [...slicePhases('maze', 1, 12), ...slicePhases('math', 9, 12)],
    featureBullets: ['percepção espacial', 'tomada de decisão', 'sequência', 'planejamento simples'],
  },
  {
    id: 'pack-puzzles-e-cenas',
    title: 'Puzzles e Cenas',
    ageLabel: '5–7 anos',
    recommendedAges: [5, 6, 7],
    themeLabel: 'Montagem e percepção',
    description: 'Trilha dedicada a quebra-cabeças com diferentes cenas, grades e temas visuais para montar por toque.',
    accentClass: 'from-violet-300 to-fuchsia-200',
    mascotTip: 'Perfeito para sessões mais calmas e concentradas, trabalhando observação e organização visual.',
    phaseIds: [...slicePhases('puzzle', 1, 12)],
    featureBullets: ['cenas variadas', 'montagem por troca', 'observação detalhada', 'muita variedade visual'],
  },
  {
    id: 'pack-festa-da-memoria',
    title: 'Festa da Memória',
    ageLabel: '4–7 anos',
    recommendedAges: [4, 5, 6, 7],
    themeLabel: 'Memória e atenção',
    description: 'Todos os temas do Bosque da Memória em uma única coleção, com pares crescentes e repertório visual amplo.',
    accentClass: 'from-rose-300 to-yellow-200',
    mascotTip: 'Excelente para repetir com prazer: muda o tema, muda o volume de pares e a sensação de novidade permanece.',
    phaseIds: [...slicePhases('memory', 1, 12)],
    featureBullets: ['muitos temas', 'pares progressivos', 'atenção e foco', 'rodadas rápidas'],
  },
  {
    id: 'pack-completo-por-idade-7',
    title: 'Desafio 7 Anos',
    ageLabel: '7 anos',
    recommendedAges: [7],
    themeLabel: 'Continuidade avançada',
    description: 'Seleção mais forte para crianças próximas dos 7 anos, misturando leitura, números, estratégia leve e montagem.',
    accentClass: 'from-slate-300 to-indigo-200',
    mascotTip: 'Funciona bem quando a criança já quer sentir progressão mais clara, metas e repertório mais amplo.',
    phaseIds: ['alphabet-10', 'alphabet-11', 'alphabet-12', 'math-9', 'math-10', 'math-11', 'math-12', 'maze-9', 'maze-10', 'maze-11', 'maze-12', 'puzzle-10', 'puzzle-11', 'puzzle-12'],
    featureBullets: ['leitura visual mais madura', 'sequência mais longa', 'labirintos maiores', 'quebra-cabeças mais densos'],
  },
];

export const contentPackMap = Object.fromEntries(contentPacks.map((pack) => [pack.id, pack])) as Record<string, ContentPack>;

export const rewardMilestones = [
  { threshold: 6, label: 'Primeiros Passos' },
  { threshold: 12, label: 'Explorador Curioso' },
  { threshold: 20, label: 'Mestre das Missões' },
  { threshold: 30, label: 'Colecionador de Estrelas' },
  { threshold: 42, label: 'Campeão da Escola Divertida' },
  { threshold: 60, label: 'Guardião dos Mundos' },
  { threshold: 84, label: 'Super Jogador' },
  { threshold: 120, label: 'Aventureiro Brilhante' },
  { threshold: 168, label: 'Lenda da Escola Divertida' },
  { threshold: 210, label: 'Mestre Supremo dos Mundos' },
];

export const ageTracks = [
  { age: '4 anos', content: 'cores, formas, toques simples, encaixe, memórias curtas e primeiras missões objetivas' },
  { age: '5 anos', content: 'memória, letras iniciais, contagem, classificação visual e primeiras sequências' },
  { age: '6 anos', content: 'somas leves, puzzles maiores, labirintos médios e mais autonomia nas escolhas' },
  { age: '7 anos', content: 'leitura visual mais forte, sequência, estratégia leve, mapas longos e objetivos encadeados' },
];

export const safetyItems = [
  'Tempo de uso configurável para cada sessão infantil.',
  'Sem anúncios na experiência principal.',
  'Botões grandes e leitura visual forte para pré-leitores.',
  'Cloud save opcional via Netlify + Supabase.',
  'Base pronta para histórico, sequência e novos relatórios quando o Supabase entrar na próxima etapa.',
  'Efeitos sonoros controláveis pelos pais.',
  'Mapa com progressão gradual e desbloqueio saudável.',
  'Packs por idade e por tema ajudam a escolher conteúdo sem exposição caótica.',
];

export const testimonials = [
  { name: 'Equipe Pedagógica', role: 'Curadoria por idade', text: 'Os packs deixam o conteúdo mais útil para pais e educadores, porque permitem direcionar fases por idade, tema e objetivo pedagógico.' },
  { name: 'Equipe UX Infantil', role: 'Escolha sem confusão', text: 'A biblioteca ficou mais organizada: a criança continua vendo mundos e fases, mas os adultos agora podem acionar trilhas prontas com muito mais clareza.' },
  { name: 'Equipe Produto', role: 'Escala sustentável', text: 'A V12 amplia o encanto com temporadas, recompensas por mundo, mascote personalizável e uma arquitetura de conteúdo já desenhada para sincronização futura.' },
];

export const faqData = [
  { q: 'O que a V12 melhora na experiência?', a: 'Ela adiciona temporadas, recompensas visuais por mundo, mais personalização do mascote, trilhas semanais para pais e a base de catálogo pronta para a próxima etapa com Supabase.' },
  { q: 'As 84 fases continuam existindo?', a: 'Sim. A V12 mantém as 84 fases e preserva mundos, packs, mapa, perfis, recompensas e missões diárias.' },
  { q: 'Os pais conseguem acompanhar melhor agora?', a: 'Sim. A nova leitura traz sequência de dias, mundo favorito, metas visíveis, passaporte dos mundos e foco sugerido de forma mais rápida.' },
  { q: 'O projeto continua pronto para deploy?', a: 'Sim. O pacote continua preparado para Netlify, com cloud save opcional por Netlify Function + Supabase.' },
];


export const avatarOptions = [
  { emoji: '🦊', label: 'Raposa esperta' },
  { emoji: '🐼', label: 'Panda gentil' },
  { emoji: '🦄', label: 'Unicórnio mágico' },
  { emoji: '🐯', label: 'Tigrinho valente' },
  { emoji: '🚀', label: 'Foguete veloz' },
  { emoji: '🌈', label: 'Arco-íris alegre' },
  { emoji: '🦁', label: 'Leão confiante' },
  { emoji: '🌟', label: 'Estrela brilhante' },
];

export const buddyOptions = [
  { emoji: '⭐', label: 'Estelinha' },
  { emoji: '🦋', label: 'Borboleta amiga' },
  { emoji: '🐻', label: 'Ursinho guia' },
  { emoji: '🐧', label: 'Pinguim aventureiro' },
  { emoji: '🐢', label: 'Tartaruga calma' },
  { emoji: '🐤', label: 'Passarinho cantor' },
  { emoji: '🐼', label: 'Panda companheiro' },
  { emoji: '🪐', label: 'Planeta curioso' },
];

export const mascotThemeOptions = [
  { id: 'classic', emoji: '✨', label: 'Clássica brilhante', desc: 'A Estelinha aparece como guia acolhedora e luminosa.' },
  { id: 'space', emoji: '🚀', label: 'Exploradora espacial', desc: 'Mensagens com clima de viagem entre mundos.' },
  { id: 'garden', emoji: '🌸', label: 'Jardim encantado', desc: 'Tom delicado e afetivo para crianças menores.' },
  { id: 'magic', emoji: '🪄', label: 'Mágica colorida', desc: 'Falas mais festivas e cheias de surpresa.' },
];

export const parentWeeklyTracks: ParentWeeklyTrack[] = [
  {
    id: 'weekly-track-primeiros-passos',
    title: 'Semana dos Primeiros Passos',
    description: 'Roteiro leve para crianças menores, com foco em adaptação, confiança e brincadeiras curtas.',
    ageMin: 4,
    ageMax: 5,
    world: 'shape',
    isActive: true,
    accentClass: 'from-pink-300 to-orange-200',
    days: [
      { day: 'Seg', title: 'Formas amigas', screen: 'Jogar 1 ou 2 fases de Encaixe por 10 minutos.', offline: 'Procurem círculos, quadrados e triângulos pela casa.', goal: 'Fortalecer coordenação e reconhecimento de formas.' },
      { day: 'Ter', title: 'Cores que encantam', screen: 'Separar objetos por cor no Jardim das Cores.', offline: 'Montar montinhos de brinquedos ou roupas por cor.', goal: 'Estimular classificação visual e vocabulário.' },
      { day: 'Qua', title: 'Memória curtinha', screen: 'Jogar uma fase rápida do Bosque da Memória.', offline: 'Esconder dois pares de objetos iguais e pedir para encontrar.', goal: 'Exercitar atenção e memória de trabalho.' },
      { day: 'Qui', title: 'Letras do cotidiano', screen: 'Brincar 1 fase da Cidade das Letras.', offline: 'Falar palavras que comecem com a letra do nome da criança.', goal: 'Ampliar linguagem sem pressão.' },
      { day: 'Sex', title: 'Mistura divertida', screen: 'Escolher o jogo favorito da semana e repetir com confiança.', offline: 'Desenhar a brincadeira favorita vivida no app.', goal: 'Consolidar vínculo positivo com o aprendizado.' },
    ],
  },
  {
    id: 'weekly-track-descobertas',
    title: 'Semana das Descobertas',
    description: 'Trilha equilibrada para 5 a 6 anos, misturando letras, números e aventura leve.',
    ageMin: 5,
    ageMax: 6,
    world: 'alphabet',
    isActive: true,
    accentClass: 'from-amber-300 to-yellow-200',
    days: [
      { day: 'Seg', title: 'Letras em ação', screen: 'Jogar 2 fases da Cidade das Letras.', offline: 'Procurar palavras em embalagens ou livros infantis.', goal: 'Trabalhar consciência fonológica e vocabulário.' },
      { day: 'Ter', title: 'Contagem com alegria', screen: 'Jogar 1 ou 2 fases do Vale dos Números.', offline: 'Contar frutas, passos ou brinquedos.', goal: 'Fixar contagem e raciocínio inicial.' },
      { day: 'Qua', title: 'Rota do tesouro', screen: 'Explorar um labirinto curtinho.', offline: 'Criar uma trilha com almofadas no chão.', goal: 'Estimular orientação espacial.' },
      { day: 'Qui', title: 'Puzzle calmo', screen: 'Montar uma cena no Ateliê dos Puzzles.', offline: 'Recortar uma figura simples em 4 partes para remontar.', goal: 'Exercitar organização visual e persistência.' },
      { day: 'Sex', title: 'Pack da semana', screen: 'Abrir um pack recomendado e concluir a próxima fase livre.', offline: 'Conversar sobre qual jogo foi mais divertido e por quê.', goal: 'Criar autonomia com rotina saudável.' },
    ],
  },
  {
    id: 'weekly-track-desafio',
    title: 'Semana do Desafio Curioso',
    description: 'Trilha para 6 a 7 anos com mais continuidade, estratégia leve e maior autonomia.',
    ageMin: 6,
    ageMax: 7,
    world: 'maze',
    isActive: true,
    accentClass: 'from-indigo-300 to-sky-200',
    days: [
      { day: 'Seg', title: 'Meta da fase', screen: 'Concluir a próxima fase recomendada do perfil.', offline: 'Falar qual estratégia ajudou a vencer o desafio.', goal: 'Estimular metacognição infantil.' },
      { day: 'Ter', title: 'Labirinto e rota', screen: 'Jogar 2 fases da Caverna do Tesouro.', offline: 'Criar um mapa simples em papel com início e fim.', goal: 'Fortalecer planejamento e orientação espacial.' },
      { day: 'Qua', title: 'Números com lógica', screen: 'Jogar fases de soma, subtração ou sequência.', offline: 'Inventar continhas com brinquedos ou lápis.', goal: 'Dar segurança à matemática básica.' },
      { day: 'Qui', title: 'Puzzle com atenção', screen: 'Montar uma cena mais longa no Ateliê dos Puzzles.', offline: 'Recontar a cena montada usando imaginação.', goal: 'Estimular linguagem, foco e observação.' },
      { day: 'Sex', title: 'Fechamento da semana', screen: 'Usar o modo surpresa ou o mundo favorito para terminar a semana.', offline: 'Celebrar a conquista com desenho ou história curta.', goal: 'Associar esforço a recompensa e continuidade.' },
    ],
  },
];

export const seasonalEvents: SeasonalEvent[] = [
  { id: 'event-stars', title: 'Temporada das Estrelas', subtitle: 'Complete fases de Memória para acender o céu da aventura.', emoji: '🌟', world: 'memory', targetCompletions: 4, rewardLabel: 'Selo Estrelas do Bosque', rewardStars: 4, monthRange: 'evento temático', palette: 'from-indigo-500 to-fuchsia-500' },
  { id: 'event-letters', title: 'Festival das Letras', subtitle: 'Brilhe na Cidade das Letras com rodadas extras de alfabetização.', emoji: '🔤', world: 'alphabet', targetCompletions: 4, rewardLabel: 'Selo Voz das Letras', rewardStars: 4, monthRange: 'evento temático', palette: 'from-orange-500 to-amber-500' },
  { id: 'event-colors', title: 'Semana Colorida', subtitle: 'Separe, combine e pinte o Jardim das Cores com mais ritmo.', emoji: '🎨', world: 'colors', targetCompletions: 4, rewardLabel: 'Selo Jardim Colorido', rewardStars: 4, monthRange: 'evento temático', palette: 'from-emerald-500 to-lime-500' },
  { id: 'event-puzzle', title: 'Feira dos Puzzles', subtitle: 'Monte cenas especiais e ganhe um prêmio ilustrado.', emoji: '🧩', world: 'puzzle', targetCompletions: 4, rewardLabel: 'Selo Mestre dos Puzzles', rewardStars: 5, monthRange: 'evento temático', palette: 'from-violet-500 to-pink-500' },
];

export const dynamicContentBlueprint: DynamicContentBlueprint = {
  version: 2,
  entities: {
    packs: 'content_packs',
    packPhases: 'content_pack_phases',
    seasonalEvents: 'seasonal_events',
    weeklyTracks: 'parent_weekly_tracks',
  },
  note: 'A V13 já consegue ler packs, eventos e trilhas semanais dinamicamente via Netlify Functions + Supabase, com fallback local e base pronta para um painel admin simples.',
};

export const profileAccentPalette = ['from-pink-400 to-rose-400', 'from-sky-400 to-indigo-400', 'from-emerald-400 to-teal-400', 'from-yellow-400 to-orange-400'];
