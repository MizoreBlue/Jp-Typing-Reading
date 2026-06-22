import type { RubyText, Token } from '@/types';

// 简单的汉字到假名映射（常用字）
const commonKanjiReadings: Record<string, string[]> = {
  '日': ['に', 'ひ', 'じる', 'び'],
  '本': ['ほん', 'もと'],
  '人': ['ひと', 'じん', 'にん'],
  '月': ['つき', 'げつ', 'づき'],
  '火': ['ひ', 'か'],
  '水': ['みず', 'すい'],
  '木': ['き', 'もく', 'こ'],
  '金': ['かね', 'きん'],
  '土': ['つち', 'ど'],
  '一': ['いち', 'ひと'],
  '二': ['に', 'ふた'],
  '三': ['さん', 'み'],
  '四': ['よん', 'し', 'よ'],
  '五': ['ご'],
  '六': ['ろく', 'む'],
  '七': ['なな', 'しち'],
  '八': ['はち', 'や'],
  '九': ['きゅう', 'く'],
  '十': ['じゅう', 'と'],
  '大': ['おお', 'だい'],
  '小': ['ちい', 'こ', 'しょう'],
  '中': ['なか', 'ちゅう'],
  '上': ['うえ', 'じょう'],
  '下': ['した', 'か', 'げ'],
  '左': ['ひだり', 'さ'],
  '右': ['みぎ', 'う'],
  '前': ['まえ', 'ぜん'],
  '後': ['あと', 'ご'],
  '今': ['いま', 'こん'],
  '古': ['ふる', 'こ'],
  '新': ['あたら', 'しん'],
  '長': ['なが', 'ちょう'],
  '高': ['たか', 'こう'],
  '白': ['しろ', 'はく'],
  '黒': ['くろ', 'こく'],
  '山': ['やま', 'さん'],
  '川': ['かわ', 'せん'],
  '田': ['た', 'でん'],
  '海': ['うみ', 'かい'],
  '空': ['そら', 'くう'],
  '風': ['かぜ', 'ふう'],
  '雨': ['あめ', 'う'],
  '雪': ['ゆき', 'せつ'],
  '花': ['はな', 'か'],
  '鳥': ['とり', 'ちょう'],
  '魚': ['さかな', 'ぎょ'],
  '犬': ['いぬ', 'けん'],
  '猫': ['ねこ', 'びょう'],
  '友': ['とも', 'ゆう'],
  '愛': ['あい', 'め'],
  '学': ['まな', 'がく'],
  '校': ['こう', 'が'],
  '生': ['い', 'なま', 'せい'],
  '先': ['さき', 'せん'],
  '時': ['とき', 'じ'],
  '年': ['とし', 'ねん'],
  '何': ['なに', 'なん'],
  '誰': ['だれ', 'た'],
  '言': ['い', 'げん'],
  '見': ['み', 'けん'],
  '聞': ['き', 'ぶん'],
  '読': ['よ', 'どく'],
  '書': ['か', 'しょ'],
  '話': ['はな', 'わ'],
  '行': ['い', 'こう'],
  '来': ['く', 'らい'],
  '出': ['で', 'しゅつ'],
  '入': ['はい', 'にゅう'],
  '会': ['あ', 'かい'],
  '作': ['つく', 'さ'],
  '買': ['か', 'ばい'],
  '食': ['た', 'しょく'],
  '飲': ['の', 'いん'],
  '寝': ['ね', 'しん'],
  '起': ['お', 'き'],
  '歩': ['ある', 'ほ'],
  '走': ['はし', 'そう'],
  '飛': ['と', 'ひ'],
  '手': ['て', 'しゅ'],
  '足': ['あし', 'そく'],
  '体': ['からだ', 'たい'],
  '目': ['め', 'もく'],
  '耳': ['みみ', 'じ'],
  '口': ['くち', 'こう'],
  '顔': ['かお', 'がん'],
  '心': ['こころ', 'しん'],
  '私': ['わたし', 'し'],
  '君': ['きみ', 'くん'],
  '彼': ['かれ', 'ひ'],
  '彼女': ['かのじょ'],
  '世界': ['せかい'],
  '日本': ['にほん'],
  '中国': ['ちゅうごく'],
  '米国': ['べいこく'],
  '社会': ['しゃかい'],
  '政治': ['せいじ'],
  '経済': ['けいざい'],
  '会社': ['かいしゃ'],
  '生活': ['せいかつ'],
  '問題': ['もんだい'],
  '方法': ['ほうほう'],
  '理由': ['りゆう'],
  '結果': ['けっか'],
  '意味': ['いみ'],
};

// 片假名到平假名的映射
const katakanaToHiragana: Record<string, string> = {
  'ア': 'あ', 'イ': 'い', 'ウ': 'う', 'エ': 'え', 'オ': 'お',
  'カ': 'か', 'キ': 'き', 'ク': 'く', 'ケ': 'け', 'コ': 'こ',
  'サ': 'さ', 'シ': 'し', 'ス': 'す', 'セ': 'せ', 'ソ': 'そ',
  'タ': 'た', 'チ': 'ち', 'ツ': 'つ', 'テ': 'て', 'ト': 'と',
  'ナ': 'な', 'ニ': 'に', 'ヌ': 'ぬ', 'ネ': 'ね', 'ノ': 'の',
  'ハ': 'は', 'ヒ': 'ひ', 'フ': 'ふ', 'ヘ': 'へ', 'ホ': 'ほ',
  'マ': 'ま', 'ミ': 'み', 'ム': 'む', 'メ': 'め', 'モ': 'も',
  'ヤ': 'や', 'ユ': 'ゆ', 'ヨ': 'よ',
  'ラ': 'ら', 'リ': 'り', 'ル': 'る', 'レ': 'れ', 'ロ': 'ろ',
  'ワ': 'わ', 'ヲ': 'を', 'ン': 'ん',
  'ガ': 'が', 'ギ': 'ぎ', 'グ': 'ぐ', 'ゲ': 'げ', 'ゴ': 'ご',
  'ザ': 'ざ', 'ジ': 'じ', 'ズ': 'ず', 'ゼ': 'ぜ', 'ゾ': 'ぞ',
  'ダ': 'だ', 'ヂ': 'ぢ', 'ヅ': 'づ', 'デ': 'で', 'ド': 'ど',
  'バ': 'ば', 'ビ': 'び', 'ブ': 'ぶ', 'ベ': 'べ', 'ボ': 'ぼ',
  'パ': 'ぱ', 'ピ': 'ぴ', 'プ': 'ぷ', 'ペ': 'ぺ', 'ポ': 'ぽ',
  'ヴァ': 'う゛ぁ', 'ヴィ': 'う゛ぃ', 'ヴェ': 'う゛ぇ', 'ヴォ': 'う゛ぉ',
  'ッ': 'っ', 'ー': 'ー',
};

/**
 * 将片假名转换为平假名
 */
function convertKatakanaToHiragana(text: string): string {
  let result = '';
  let i = 0;
  while (i < text.length) {
    // 尝试匹配2个字符的片假名
    if (i + 1 < text.length) {
      const duo = text.slice(i, i + 2);
      const mapped = katakanaToHiragana[duo];
      if (mapped) {
        result += mapped;
        i += 2;
        continue;
      }
    }
    // 单个字符
    const single = text[i];
    const mapped = katakanaToHiragana[single];
    result += mapped || single;
    i++;
  }
  return result;
}

type CharType = 'kanji' | 'hiragana' | 'katakana' | 'other';

function getCharType(char: string): CharType {
  if (/[\u4e00-\u9faf]/.test(char)) return 'kanji';
  if (/[\u3040-\u309f]/.test(char)) return 'hiragana';
  if (/[\u30a0-\u30ff]/.test(char)) return 'katakana';
  return 'other';
}

/**
 * 对连续汉字序列使用最长匹配进行分词
 */
function tokenizeKanjiSequence(surface: string): Token[] {
  const result: Token[] = [];
  let remaining = surface;

  while (remaining.length > 0) {
    let matched = false;
    // 优先匹配更长的已知词
    for (let len = remaining.length; len > 0; len--) {
      const sub = remaining.slice(0, len);
      if (commonKanjiReadings[sub]) {
        result.push({
          surface: sub,
          reading: commonKanjiReadings[sub][0],
          pos: 'kanji',
        });
        remaining = remaining.slice(len);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // 无法识别的汉字，按单字切分
      result.push({
        surface: remaining[0],
        reading: '',
        pos: 'kanji',
      });
      remaining = remaining.slice(1);
    }
  }

  return result;
}

/**
 * 简单的分词器 - 将日文文本分割成 tokens
 * 注意：这是一个基础实现，真正的分词需要 kuromoji.js
 */
export function simpleTokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let current = '';
  let currentType: CharType = 'other';

  const pushToken = (surface: string, type: CharType) => {
    if (surface.length === 0) return;

    if (type === 'kanji') {
      tokens.push(...tokenizeKanjiSequence(surface));
      return;
    }

    const reading = type === 'katakana'
      ? convertKatakanaToHiragana(surface)
      : surface;

    tokens.push({
      surface,
      reading,
      pos: 'other',
    });
  };

  for (const char of text) {
    const charType = getCharType(char);

    if (current.length === 0 || currentType === charType) {
      current += char;
      currentType = charType;
    } else {
      pushToken(current, currentType);
      current = char;
      currentType = charType;
    }
  }

  pushToken(current, currentType);
  return tokens;
}

/**
 * 为文本添加注音，返回 RubyText 数组
 */
export function addFurigana(text: string): RubyText[] {
  const tokens = simpleTokenize(text);
  const result: RubyText[] = [];

  for (const token of tokens) {
    if (token.reading && token.reading !== token.surface) {
      result.push({
        kanji: token.surface,
        furigana: token.reading,
      });
    } else {
      // 非汉字或无法注音的字符
      result.push({
        kanji: token.surface,
        furigana: '',
      });
    }
  }

  return result;
}

/**
 * 获取单个汉字的读音
 */
export function getKanjiReading(kanji: string): string | null {
  return commonKanjiReadings[kanji]?.[0] || null;
}

/**
 * 检查字符是否为汉字
 */
export function isKanji(char: string): boolean {
  return /[\u4e00-\u9faf]/.test(char);
}

/**
 * 检查字符是否为假名
 */
export function isHiragana(char: string): boolean {
  return /[\u3040-\u309f]/.test(char);
}

/**
 * 检查字符是否为片假名
 */
export function isKatakana(char: string): boolean {
  return /[\u30a0-\u30ff]/.test(char);
}
