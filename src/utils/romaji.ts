// 罗马音到假名的映射表
const romajiToHiragana: Record<string, string> = {
  // 基本母音
  'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',
  // K 行
  'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
  // S 行
  'sa': 'さ', 'si': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
  'shi': 'し', 'sha': 'しゃ', 'shu': 'しゅ', 'she': 'しぇ', 'sho': 'しょ',
  // T 行
  'ta': 'た', 'ti': 'ち', 'tu': 'つ', 'te': 'て', 'to': 'と',
  'chi': 'ち', 'cha': 'ちゃ', 'chu': 'ちゅ', 'che': 'ちぇ', 'cho': 'ちょ',
  'tsa': 'つ',
  // N 行
  'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
  // H 行
  'ha': 'は', 'hi': 'ひ', 'hu': 'ふ', 'he': 'へ', 'ho': 'ほ',
  'fu': 'ふ',
  // M 行
  'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
  // Y 行
  'ya': 'や', 'yi': 'い', 'yu': 'ゆ', 'ye': 'え', 'yo': 'よ',
  // R 行
  'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
  // W 行
  'wa': 'わ', 'wi': 'うぃ', 'wu': 'う', 'we': 'うぇ', 'wo': 'を',
  // V 行（外来语）
  'va': 'う゛ぁ', 'vi': 'う゛ぃ', 'vu': 'う゛', 've': 'う゛ぇ', 'vo': 'う゛ぉ',
  // G 行
  'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
  // Z 行
  'za': 'ざ', 'zi': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
  'ji': 'じ',
  // D 行
  'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',
  'dzi': 'ぢ', 'dzu': 'づ',
  // B 行
  'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
  // P 行
  'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
  // 小假名
  'xa': 'ぁ', 'xi': 'ぃ', 'xu': 'ぅ', 'xe': 'ぇ', 'xo': 'ぉ',
  'xtu': 'っ', 'ltsu': 'っ',
  // 拨音
  'n': 'ん',
  // 长音
  '-': 'ー',
};

// 拗音映射
const youon: Record<string, string> = {
  'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',
  'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',
  'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',
  'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',
  'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',
  'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',
  'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',
  'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',
  'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ',
  'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',
  'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',
  'zya': 'じゃ', 'zyu': 'じゅ', 'zyo': 'じょ',
  'dya': 'ぢゃ', 'dyu': 'ぢゅ', 'dyo': 'ぢょ',
};

/**
 * 罗马音转换为假名
 */
export function romajiToHiraganaConvert(romaji: string): string {
  let result = '';
  let i = 0;
  const input = romaji.toLowerCase();

  while (i < input.length) {
    // 尝试匹配3个字符的组合（拗音及 chi/shi/tsu 等）
    if (i + 2 < input.length) {
      const tri = input.slice(i, i + 3);
      const triMapped = youon[tri] || romajiToHiragana[tri];
      if (triMapped) {
        result += triMapped;
        i += 3;
        continue;
      }
    }

    // 拨音 n 的特殊处理：当 n 后无字符或为非元音时，输出 ん
    if (input[i] === 'n') {
      const next = input[i + 1];
      if (i + 1 >= input.length || !'aiueo'.includes(next)) {
        result += 'ん';
        i++;
        continue;
      }
    }

    // 尝试匹配促音（っ）：当前字符与下一个字符相同且为可促音化的辅音
    if (
      i + 1 < input.length &&
      input[i] === input[i + 1] &&
      'ktpshcmyrgwzdbp'.includes(input[i])
    ) {
      result += 'っ';
      i++;
      continue;
    }

    // 尝试匹配长音
    if (input[i] === '-') {
      result += 'ー';
      i++;
      continue;
    }

    // 尝试匹配基本音（2个字符）
    if (i + 1 < input.length) {
      const duo = input.slice(i, i + 2);
      if (romajiToHiragana[duo]) {
        result += romajiToHiragana[duo];
        i += 2;
        continue;
      }
    }

    // 匹配单个字符
    const single = input[i];
    if (romajiToHiragana[single]) {
      result += romajiToHiragana[single];
    } else {
      result += single;
    }
    i++;
  }

  return result;
}

/**
 * 验证罗马音输入是否有效
 */
export function isValidRomaji(char: string): boolean {
  const c = char.toLowerCase();
  return /^[a-z]$/.test(c) || c === '-';
}
