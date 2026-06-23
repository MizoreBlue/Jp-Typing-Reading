import type { AlignmentPair } from '@/types';

export function alignParagraphs(
  jpParagraphs: string[],
  zhParagraphs: string[]
): AlignmentPair[] {
  if (jpParagraphs.length === 0 || zhParagraphs.length === 0) {
    console.warn('段落对齐失败：输入段落为空', { jpLen: jpParagraphs.length, zhLen: zhParagraphs.length });
    return [];
  }

  const alignments: AlignmentPair[] = [];
  const usedJp = new Set<number>();
  const usedZh = new Set<number>();

  const jpFeatures = jpParagraphs.map(p => extractFeatures(p));
  const zhFeatures = zhParagraphs.map(p => extractFeatures(p));

  console.log(`开始对齐：日语段落 ${jpParagraphs.length} 个，中文段落 ${zhParagraphs.length} 个`);

  // 策略0: 精确匹配（完全相同的文本内容）
  for (let i = 0; i < jpParagraphs.length; i++) {
    if (usedJp.has(i)) continue;

    const jpClean = jpParagraphs[i].replace(/[。、，！？；：\.\,\!\?\;\:\-\(\)\[\]【】「」『』《》\s]/g, '');

    for (let j = 0; j < zhParagraphs.length; j++) {
      if (usedZh.has(j)) continue;

      const zhClean = zhParagraphs[j].replace(/[。、，！？；：\.\,\!\?\;\:\-\(\)\[\]【】「」『』《》\s]/g, '');

      if (jpClean.length > 0 && jpClean === zhClean) {
        alignments.push({ jpIndex: i, zhIndex: j, score: 100 });
        usedJp.add(i);
        usedZh.add(j);
        console.log(`策略0精确匹配: JP[${i}] → ZH[${j}]`);
        break;
      }
    }
  }

  // 策略1: 长度比例匹配（优化日语-中文比例）
  for (let i = 0; i < jpParagraphs.length; i++) {
    if (usedJp.has(i)) continue;

    const jpLen = jpParagraphs[i].length;

    for (let j = 0; j < zhParagraphs.length; j++) {
      if (usedZh.has(j)) continue;

      const zhLen = zhParagraphs[j].length;
      const lenRatio = zhLen / jpLen;

      if (lenRatio >= 0.9 && lenRatio <= 3.5) {
        const score = calculateAlignmentScore(jpParagraphs[i], zhParagraphs[j], jpFeatures[i], zhFeatures[j]);
        if (score >= 55) {
          alignments.push({ jpIndex: i, zhIndex: j, score });
          usedJp.add(i);
          usedZh.add(j);
          console.log(`策略1长度匹配: JP[${i}] → ZH[${j}], 分数: ${score.toFixed(1)}`);
          break;
        }
      }
    }
  }

  // 策略2: 标点符号匹配（扩展日语标点）
  for (let i = 0; i < jpParagraphs.length; i++) {
    if (usedJp.has(i)) continue;

    const jpPunct = extractPunctuation(jpParagraphs[i]);

    for (let j = 0; j < zhParagraphs.length; j++) {
      if (usedZh.has(j)) continue;

      const zhPunct = extractPunctuation(zhParagraphs[j]);
      const punctScore = calculatePunctuationScore(jpPunct, zhPunct);

      if (punctScore >= 50) {
        const score = calculateAlignmentScore(jpParagraphs[i], zhParagraphs[j], jpFeatures[i], zhFeatures[j]);
        if (score >= 35) {
          alignments.push({ jpIndex: i, zhIndex: j, score: (score + punctScore) / 2 });
          usedJp.add(i);
          usedZh.add(j);
          console.log(`策略2标点匹配: JP[${i}] → ZH[${j}], 分数: ${((score + punctScore) / 2).toFixed(1)}`);
          break;
        }
      }
    }
  }

  // 策略3: 数字匹配（专有名词、日期等）
  for (let i = 0; i < jpParagraphs.length; i++) {
    if (usedJp.has(i)) continue;

    const jpNumbers = extractNumbers(jpParagraphs[i]);

    if (jpNumbers.length === 0) continue;

    for (let j = 0; j < zhParagraphs.length; j++) {
      if (usedZh.has(j)) continue;

      const zhNumbers = extractNumbers(zhParagraphs[j]);
      const matchCount = jpNumbers.filter(n => zhNumbers.includes(n)).length;

      if (matchCount >= 1) {
        const score = calculateAlignmentScore(jpParagraphs[i], zhParagraphs[j], jpFeatures[i], zhFeatures[j]);
        if (score >= 25) {
          alignments.push({ jpIndex: i, zhIndex: j, score: score + 20 });
          usedJp.add(i);
          usedZh.add(j);
          console.log(`策略3数字匹配: JP[${i}] → ZH[${j}], 分数: ${(score + 20).toFixed(1)}`);
          break;
        }
      }
    }
  }

  // 策略4: 关键词匹配（汉字、片假名、罗马字）
  for (let i = 0; i < jpParagraphs.length; i++) {
    if (usedJp.has(i)) continue;

    const jpKeywords = extractKeywords(jpParagraphs[i]);

    if (jpKeywords.length === 0) continue;

    for (let j = 0; j < zhParagraphs.length; j++) {
      if (usedZh.has(j)) continue;

      const zhKeywords = extractKeywords(zhParagraphs[j]);
      const matchCount = jpKeywords.filter(k => zhKeywords.includes(k)).length;

      if (matchCount >= 1) {
        const score = calculateAlignmentScore(jpParagraphs[i], zhParagraphs[j], jpFeatures[i], zhFeatures[j]);
        if (score >= 20) {
          alignments.push({ jpIndex: i, zhIndex: j, score: score + 30 });
          usedJp.add(i);
          usedZh.add(j);
          console.log(`策略4关键词匹配: JP[${i}] → ZH[${j}], 分数: ${(score + 30).toFixed(1)}, 匹配关键词: ${matchCount}`);
          break;
        }
      }
    }
  }

  // 策略5: 汉字匹配（日语和中文共享汉字）
  for (let i = 0; i < jpParagraphs.length; i++) {
    if (usedJp.has(i)) continue;

    const jpKanji = extractKanji(jpParagraphs[i]);

    if (jpKanji.length < 2) continue;

    for (let j = 0; j < zhParagraphs.length; j++) {
      if (usedZh.has(j)) continue;

      const zhKanji = extractKanji(zhParagraphs[j]);
      
      let matchCount = 0;
      for (const kanji of jpKanji) {
        if (zhKanji.includes(kanji)) {
          matchCount++;
        }
      }

      if (matchCount >= Math.min(2, jpKanji.length)) {
        const score = calculateAlignmentScore(jpParagraphs[i], zhParagraphs[j], jpFeatures[i], zhFeatures[j]);
        if (score >= 20) {
          alignments.push({ jpIndex: i, zhIndex: j, score: score + 25 });
          usedJp.add(i);
          usedZh.add(j);
          console.log(`策略5汉字匹配: JP[${i}] → ZH[${j}], 分数: ${(score + 25).toFixed(1)}, 匹配汉字: ${matchCount}`);
          break;
        }
      }
    }
  }

  // 策略6: 贪心匹配（降低阈值，处理剩余段落）
  for (let i = 0; i < jpParagraphs.length; i++) {
    if (usedJp.has(i)) continue;

    let bestScore = 0;
    let bestJ = -1;

    for (let j = 0; j < zhParagraphs.length; j++) {
      if (usedZh.has(j)) continue;

      const score = calculateAlignmentScore(jpParagraphs[i], zhParagraphs[j], jpFeatures[i], zhFeatures[j]);
      if (score > bestScore) {
        bestScore = score;
        bestJ = j;
      }
    }

    if (bestJ >= 0 && bestScore >= 10) {
      alignments.push({ jpIndex: i, zhIndex: bestJ, score: bestScore });
      usedJp.add(i);
      usedZh.add(bestJ);
      console.log(`策略6贪心匹配: JP[${i}] → ZH[${bestJ}], 分数: ${bestScore.toFixed(1)}`);
    }
  }

  // 策略7: 顺序匹配（处理完全无法匹配的段落，按顺序关联）
  const unusedJp = jpParagraphs
    .map((_, i) => i)
    .filter(i => !usedJp.has(i));
  const unusedZh = zhParagraphs
    .map((_, i) => i)
    .filter(i => !usedZh.has(i));

  const minLen = Math.min(unusedJp.length, unusedZh.length);
  for (let k = 0; k < minLen; k++) {
    alignments.push({
      jpIndex: unusedJp[k],
      zhIndex: unusedZh[k],
      score: 5,
    });
    console.log(`策略7顺序匹配: JP[${unusedJp[k]}] → ZH[${unusedZh[k]}]`);
  }

  const sortedAlignments = alignments.sort((a, b) => a.jpIndex - b.jpIndex);
  
  console.log(`对齐完成：共匹配 ${sortedAlignments.length} 对，日语剩余 ${jpParagraphs.length - usedJp.size} 个，中文剩余 ${zhParagraphs.length - usedZh.size} 个`);

  return sortedAlignments;
}

interface TextFeatures {
  length: number;
  kanjiCount: number;
  hiraganaCount: number;
  katakanaCount: number;
  punctuationCount: number;
  hasNumbers: boolean;
  hasKatakana: boolean;
}

function extractFeatures(text: string): TextFeatures {
  let kanjiCount = 0;
  let hiraganaCount = 0;
  let katakanaCount = 0;
  let punctuationCount = 0;
  let hasNumbers = false;
  let hasKatakana = false;

  for (const char of text) {
    if (/[\u4e00-\u9faf]/.test(char)) {
      kanjiCount++;
    } else if (/[\u3040-\u309f]/.test(char)) {
      hiraganaCount++;
    } else if (/[\u30a0-\u30ff]/.test(char)) {
      katakanaCount++;
      hasKatakana = true;
    } else if (/[。？！、，；：""''（）【】《》「」『』…—–・｛｝＜＞｟｠\.\,\!\?\;\:\(\)\[\]<>]/.test(char)) {
      punctuationCount++;
    } else if (/[\d]/.test(char)) {
      hasNumbers = true;
    }
  }

  return {
    length: text.length,
    kanjiCount,
    hiraganaCount,
    katakanaCount,
    punctuationCount,
    hasNumbers,
    hasKatakana,
  };
}

function calculateAlignmentScore(jp: string, zh: string, jpFeatures?: TextFeatures, zhFeatures?: TextFeatures): number {
  let score = 0;

  // 长度评分（权重：25%）
  const lenRatio = zh.length / Math.max(jp.length, 1);
  if (lenRatio >= 0.5 && lenRatio <= 4.0) {
    const idealRatio = 1.4;
    const diff = Math.abs(lenRatio - idealRatio);
    const lenScore = Math.max(0, 100 - diff * 30);
    score += lenScore * 0.25;
  }

  // 标点评分（权重：25%）
  const jpPunct = extractPunctuation(jp);
  const zhPunct = extractPunctuation(zh);
  score += calculatePunctuationScore(jpPunct, zhPunct) * 0.25;

  // 数字评分（权重：15%）
  const jpNumbers = extractNumbers(jp);
  const zhNumbers = extractNumbers(zh);
  if (jpNumbers.length > 0 || zhNumbers.length > 0) {
    const matchRatio = jpNumbers.filter(n => zhNumbers.includes(n)).length / Math.max(jpNumbers.length, zhNumbers.length, 1);
    score += matchRatio * 15;
  }

  // 关键词评分（权重：20%）
  const jpKeywords = extractKeywords(jp);
  const zhKeywords = extractKeywords(zh);
  if (jpKeywords.length > 0 || zhKeywords.length > 0) {
    const matchRatio = jpKeywords.filter(k => zhKeywords.includes(k)).length / Math.max(jpKeywords.length, zhKeywords.length, 1);
    score += matchRatio * 20;
  }

  // 字符密度评分（权重：15%）
  if (jpFeatures && zhFeatures) {
    const jpKanjiRatio = jpFeatures.kanjiCount / Math.max(jpFeatures.length, 1);
    const zhKanjiRatio = zhFeatures.kanjiCount / Math.max(zhFeatures.length, 1);
    
    const kanjiSimilarity = 1 - Math.abs(jpKanjiRatio - zhKanjiRatio);
    score += kanjiSimilarity * 15;
  }

  return Math.min(100, Math.max(0, score));
}

function calculatePunctuationScore(punct1: string[], punct2: string[]): number {
  if (punct1.length === 0 && punct2.length === 0) return 50;
  if (punct1.length === 0 || punct2.length === 0) return 0;

  const set1 = new Set(punct1);
  const set2 = new Set(punct2);
  let matches = 0;

  const punctuationMap: Record<string, string[]> = {
    '。': ['。', '！'],
    '？': ['？', '?'],
    '！': ['！'],
    '、': ['、', '，'],
    '，': ['，', '、'],
    '；': ['；', ';'],
    '：': ['：', ':'],
    '「': ['「', '『', '"', '“'],
    '」': ['」', '』', '"', '”'],
    '『': ['『', '「', '"'],
    '』': ['』', '」', '"'],
    '（': ['（', '(', '【'],
    '）': ['）', ')', '】'],
    '【': ['【', '(', '（'],
    '】': ['】', ')', '）'],
    '…': ['…', '...', '。。。'],
    '—': ['—', '–', '-'],
    '・': ['・', '、', '.'],
    '｛': ['｛', '{'],
    '｝': ['｝', '}'],
    '＜': ['＜', '<'],
    '＞': ['＞', '>'],
    '｟': ['｟', '['],
    '｠': ['｠', ']'],
  };

  for (const p of set1) {
    if (set2.has(p)) {
      matches++;
    } else if (punctuationMap[p]) {
      for (const equivalent of punctuationMap[p]) {
        if (set2.has(equivalent)) {
          matches++;
          break;
        }
      }
    }
  }

  const unionSize = new Set([...set1, ...set2]).size;
  return (matches / unionSize) * 100;
}

function extractPunctuation(text: string): string[] {
  const punctRegex = /[。？！、，；：""''（）【】《》「」『』…—–・｛｝＜＞｟｠\.\,\!\?\;\:\(\)\[\]<>]/g;
  const matches = text.match(punctRegex);
  return matches || [];
}

function extractNumbers(text: string): string[] {
  const numberRegex = /\d+(?:\.\d+)?/g;
  return text.match(numberRegex) || [];
}

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  
  const kanjiMatches = text.match(/[\u4e00-\u9faf]{2,}/g);
  if (kanjiMatches) {
    keywords.push(...kanjiMatches);
  }

  const katakanaMatches = text.match(/[\u30a0-\u30ff]{2,}/g);
  if (katakanaMatches) {
    keywords.push(...katakanaMatches);
  }

  const romajiMatches = text.match(/[a-zA-Z]{3,}/g);
  if (romajiMatches) {
    keywords.push(...romajiMatches.map(k => k.toLowerCase()));
  }

  return keywords;
}

function extractKanji(text: string): string[] {
  const kanji: string[] = [];
  const seen = new Set<string>();
  
  for (const char of text) {
    if (/[\u4e00-\u9faf]/.test(char) && !seen.has(char)) {
      kanji.push(char);
      seen.add(char);
    }
  }
  
  return kanji;
}

export function calculateAlignmentAccuracy(alignments: AlignmentPair[]): number {
  if (alignments.length === 0) return 0;
  const validAlignments = alignments.filter(a => a.score >= 50);
  return (validAlignments.length / alignments.length) * 100;
}

export function exportAlignmentsToJSON(alignments: AlignmentPair[]): string {
  return JSON.stringify(alignments, null, 2);
}

export function importAlignmentsFromJSON(json: string): AlignmentPair[] {
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.map(a => ({
        jpIndex: Number(a.jpIndex),
        zhIndex: Number(a.zhIndex),
        score: Number(a.score) || 100,
      }));
    }
    return [];
  } catch {
    return [];
  }
}
