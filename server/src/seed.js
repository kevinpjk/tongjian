import { db } from './db.js';

const count = db.prepare('SELECT COUNT(*) AS c FROM streams').get().c;
if (count > 0) {
  console.log('Database already has streams — seed skipped. Delete server/data/tongjian.db to reseed.');
  process.exit(0);
}

const insStream = db.prepare(
  'INSERT INTO streams (name_en, name_zh, color, description_en, description_zh, sort_order) VALUES (?,?,?,?,?,?)'
);
const insEvent = db.prepare(
  `INSERT INTO events (stream_id, title_en, title_zh, description_en, description_zh,
   year_start, year_end, tags, importance, source_note) VALUES (?,?,?,?,?,?,?,?,?,?)`
);
const insConn = db.prepare(
  'INSERT INTO connections (event_a, event_b, description_en, description_zh) VALUES (?,?,?,?)'
);

const china = insStream.run(
  'Chinese History',
  '中国历史',
  '#A63A2B',
  'From the Shang dynasty through the imperial era.',
  '自商代至帝制时代。',
  1
).lastInsertRowid;
const rome = insStream.run(
  'Roman History',
  '罗马历史',
  '#3F5573',
  'Kingdom, Republic and Empire of Rome.',
  '罗马王政、共和与帝国时代。',
  2
).lastInsertRowid;
const india = insStream.run(
  'Indian History',
  '印度历史',
  '#B07A2E',
  'From the Vedic period through the Gupta golden age.',
  '自吠陀时期至笈多王朝黄金时代。',
  3
).lastInsertRowid;

const E = (stream, en, zh, den, dzh, y0, y1, tags, imp, src = 'Seed data') =>
  insEvent.run(stream, en, zh, den, dzh, y0, y1, JSON.stringify(tags), imp, src).lastInsertRowid;

// ——— China ———
E(china, 'Shang dynasty', '商朝',
  'Earliest Chinese dynasty with contemporary written records; oracle bone script emerges.',
  '中国最早有同时代文字记载的王朝，甲骨文出现。', -1600, -1046, ['politics', 'culture'], 5);
E(china, 'Zhou conquest of Shang', '武王克商',
  'King Wu of Zhou defeats the Shang at Muye; the Mandate of Heaven doctrine takes shape.',
  '周武王于牧野之战灭商，“天命”观念由此成形。', -1046, null, ['politics', 'war'], 4);
const confucius = E(china, 'Life of Confucius', '孔子在世',
  'Confucius teaches ethics, ritual and governance; his thought shapes East Asia for two millennia.',
  '孔子讲学，论仁与礼，其思想影响东亚两千余年。', -551, -479, ['culture', 'religion'], 5);
const qin = E(china, 'Qin unification of China', '秦统一六国',
  'Qin Shi Huang unifies the Warring States, standardizes script, weights and measures.',
  '秦始皇统一六国，书同文、车同轨，统一度量衡。', -221, null, ['politics', 'war'], 5);
const hanSilk = E(china, "Zhang Qian's missions & the Silk Road", '张骞通西域与丝绸之路',
  "Zhang Qian's embassies to the Western Regions open the routes later called the Silk Road.",
  '张骞出使西域，凿空之旅开启后世所谓丝绸之路。', -138, -115, ['exploration', 'economics'], 5);
const hanPaper = E(china, 'Cai Lun improves papermaking', '蔡伦改进造纸术',
  'Cai Lun presents an improved papermaking process to the Han court; paper spreads across Eurasia over centuries.',
  '蔡伦改进造纸术并奏于汉廷，纸张其后数百年间传遍欧亚。', 105, null, ['technology'], 4);
const buddhismChina = E(china, 'Buddhism reaches Han China', '佛教传入汉地',
  'Buddhist monks and texts arrive via Central Asia; the White Horse Temple tradition dates to this era.',
  '佛教经中亚传入，白马寺传说即出于此时。', 68, null, ['religion', 'culture'], 4, 'Traditional date');
E(china, 'Fall of the Han dynasty', '汉朝灭亡',
  'The Han collapses into the Three Kingdoms after decades of rebellion and warlordism.',
  '黄巾之乱与军阀割据后，汉亡而三国鼎立。', 220, null, ['politics', 'war'], 4);
E(china, 'Tang dynasty', '唐朝',
  "A cosmopolitan golden age: Chang'an becomes one of the world's largest cities.",
  '开放而繁盛的黄金时代，长安为当时世界最大都市之一。', 618, 907, ['politics', 'culture', 'art'], 5);

// ——— Rome ———
E(rome, 'Traditional founding of Rome', '罗马建城（传说）',
  'Legendary founding of Rome by Romulus; the date anchors the Roman calendar (ab urbe condita).',
  '传说罗慕路斯建城，罗马纪年以此为元。', -753, null, ['politics', 'culture'], 3, 'Traditional date');
E(rome, 'Roman Republic established', '罗马共和国建立',
  'The last king is expelled; consuls and the Senate govern Rome.',
  '末代国王被逐，执政官与元老院共治罗马。', -509, null, ['politics'], 5);
E(rome, 'Punic Wars', '布匿战争',
  'Three wars with Carthage give Rome mastery of the western Mediterranean.',
  '与迦太基的三次战争使罗马称霸西地中海。', -264, -146, ['war', 'politics'], 4);
const caesar = E(rome, 'Assassination of Julius Caesar', '恺撒遇刺',
  'Caesar is killed on the Ides of March; the Republic gives way to the Principate.',
  '恺撒于三月十五日遇刺，共和制走向元首制。', -44, null, ['politics'], 4);
const augustus = E(rome, 'Augustus and the Pax Romana', '奥古斯都与罗马和平',
  'Octavian becomes Augustus; two centuries of relative stability and Mediterranean-wide trade begin.',
  '屋大维称奥古斯都，开启约两百年的相对安定与环地中海贸易。', -27, 180, ['politics', 'economics'], 5);
const romeSilk = E(rome, 'Roman craze for Chinese silk', '罗马的丝绸风尚',
  'Silk from Han China reaches Rome via intermediaries; the Senate periodically decries the luxury drain of coin eastward.',
  '汉地丝绸经中间商传至罗马，元老院屡叹金钱东流之奢。', -50, 200, ['economics', 'culture'], 3);
const constantine = E(rome, 'Edict of Milan', '米兰敕令',
  'Constantine legalizes Christianity across the empire.',
  '君士坦丁颁令，基督教在帝国全境合法化。', 313, null, ['religion', 'politics'], 4);
E(rome, 'Fall of the Western Roman Empire', '西罗马帝国灭亡',
  'Odoacer deposes Romulus Augustulus, the conventional end of the Western Empire.',
  '奥多亚塞废黜罗慕路斯·奥古斯都路斯，史家惯以此为西罗马之终。', 476, null, ['politics', 'war'], 5);

// ——— India ———
E(india, 'Composition of the Rigveda', '《梨俱吠陀》成书',
  'The oldest Vedic hymns are composed and transmitted orally in Sanskrit.',
  '最古老的吠陀颂诗以梵语口传成形。', -1500, -1200, ['religion', 'culture'], 4, 'Approximate dates');
const buddha = E(india, 'Life of the Buddha', '佛陀在世',
  'Siddhartha Gautama teaches in the Ganges plain; Buddhism begins.',
  '悉达多·乔达摩于恒河流域说法，佛教由此发端。', -563, -483, ['religion'], 5, 'Traditional dates; scholarship varies');
const ashoka = E(india, "Ashoka's embrace of Buddhism", '阿育王皈依佛教',
  'After the Kalinga war, Ashoka patronizes Buddhism and sends missions abroad — a key step in its spread to Central and East Asia.',
  '羯陵伽之战后阿育王护持佛法并遣使四方，为佛教传向中亚与东亚之关键。', -260, null, ['religion', 'politics'], 5);
E(india, 'Maurya Empire', '孔雀王朝',
  'Chandragupta Maurya unifies most of the subcontinent; Kautilya\'s Arthashastra describes its statecraft.',
  '旃陀罗笈多统一次大陆大部，《政事论》述其治术。', -321, -185, ['politics'], 4);
const guptaZero = E(india, 'Gupta golden age & the decimal zero', '笈多王朝与十进位零号',
  'Under the Guptas, mathematicians formalize decimal place value and zero; Kalidasa writes classical Sanskrit drama.',
  '笈多时代数学家确立十进位值与零，迦梨陀娑写下梵语古典戏剧。', 320, 550, ['science', 'art', 'culture'], 5);
E(india, 'Faxian travels to India', '法显西行',
  'The Chinese monk Faxian journeys to India for Buddhist scriptures and records Gupta society.',
  '东晋高僧法显赴天竺求法，记录笈多社会风貌。', 399, 412, ['religion', 'exploration'], 3);

// ——— Cross-stream connections ———
insConn.run(
  hanSilk,
  romeSilk,
  "Zhang Qian's missions opened the overland routes that carried Han silk west; within a century it was a coveted luxury in Rome — two empires linked by trade without ever meeting.",
  '张骞凿空开辟陆上商路，汉地丝绸西传，不出百年即为罗马贵族竞逐之奢侈品——两大帝国借贸易相连而未尝相见。'
);
insConn.run(
  confucius,
  buddha,
  'Confucius and the Buddha were near contemporaries — part of the "Axial Age" in which foundational ethical systems appeared independently across Eurasia.',
  '孔子与佛陀几乎同时在世，同属“轴心时代”——伦理思想体系在欧亚各地独立涌现的时期。'
);
insConn.run(
  ashoka,
  buddhismChina,
  "Ashoka's missionary policy pushed Buddhism into Central Asia, from which it reached Han China three centuries later.",
  '阿育王的弘法政策使佛教深入中亚，三百年后经此传入汉地。'
);
insConn.run(
  caesar,
  qin,
  'Within two centuries, both ends of Eurasia saw republics/feudal orders replaced by centralized autocracy — Qin unification and the end of the Roman Republic invite comparison.',
  '两百年间，欧亚两端先后由分封/共和走向中央集权——秦之一统与罗马共和之终结堪相对照。'
);

console.log('Seeded 3 streams, 23 events, 4 connections.');
console.log(`Streams: china=${china}, rome=${rome}, india=${india}`);
