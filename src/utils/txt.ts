import JSZip from 'jszip';
import type { AlignmentPair, EPUBBook } from '@/types';

/**
 * 从 EPUB 文件提取文本内容并转换为 TXT 格式
 */
export async function epubToTXT(file: File, options?: {
  includeFrontMatter?: boolean;
  includeBackMatter?: boolean;
  includeChapterTitles?: boolean;
}): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) {
    throw new Error('无效的 EPUB 文件：找不到 container.xml');
  }

  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfPathMatch) {
    throw new Error('无效的 EPUB 文件：无法解析 OPF 路径');
  }
  const opfPath = opfPathMatch[1];
  const opfDir = opfPath.split('/').slice(0, -1).join('/');

  const opfXml = await zip.file(opfPath)?.async('text');
  if (!opfXml) {
    throw new Error('无效的 EPUB 文件：找不到 OPF 文件');
  }

  const title = extractXmlValue(opfXml, 'dc:title') || file.name.replace('.epub', '');
  const author = extractXmlValue(opfXml, 'dc:creator') || '未知作者';

  const { includeFrontMatter = true, includeBackMatter = true, includeChapterTitles = true } = options || {};

  const chapters = await extractChaptersForTXT(zip, opfXml, opfDir, { includeFrontMatter, includeBackMatter, includeChapterTitles });

  let txtContent = '';
  
  // 添加书名和作者
  txtContent += `《${title}》\n`;
  txtContent += `作者：${author}\n`;
  txtContent += '\n';

  // 添加各章节内容
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    if (chapter.title && includeChapterTitles) {
      txtContent += `\n【${chapter.title}】\n\n`;
    }
    txtContent += chapter.content + '\n\n';
  }

  return txtContent.trim();
}

function resolveEPUBPath(opfDir: string, href: string): string {
  const parts = (opfDir ? `${opfDir}/${href}` : href).split('/');
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  return resolved.join('/');
}

async function extractChaptersForTXT(
  zip: JSZip,
  opfXml: string,
  opfDir: string,
  options: { includeFrontMatter: boolean; includeBackMatter: boolean; includeChapterTitles: boolean }
): Promise<{ title: string; content: string }[]> {
  const manifestItems: Record<string, string> = {};
  const itemMatches = opfXml.matchAll(/<item\b[^>]*>/gi);
  for (const itemMatch of itemMatches) {
    const itemTag = itemMatch[0];
    const idMatch = itemTag.match(/\bid="([^"]+)"/i);
    const hrefMatch = itemTag.match(/\bhref="([^"]+)"/i);
    if (idMatch && hrefMatch) {
      manifestItems[idMatch[1]] = decodeURIComponent(hrefMatch[1]);
    }
  }

  const spineIds: string[] = [];
  const spineMatches = opfXml.matchAll(/<itemref[^>]+idref="([^"]+)"[^>]*>/gi);
  for (const match of spineMatches) {
    spineIds.push(match[1]);
  }

  const chapters: { title: string; content: string }[] = [];

  for (const id of spineIds) {
    const href = manifestItems[id];
    if (!href) continue;

    const fullPath = resolveEPUBPath(opfDir, href);
    const content = await zip.file(fullPath)?.async('text');

    if (content) {
      const contentType = detectContentTypeForTXT(content, href);
      
      // 根据选项决定是否跳过
      if (contentType === 'image') continue;
      if (contentType === 'toc') continue;
      if (contentType === 'frontmatter' && !options.includeFrontMatter) continue;
      if (contentType === 'backmatter' && !options.includeBackMatter) continue;

      const title = extractChapterTitle(content);
      const text = extractTextFromHtml(content);

      if (text.trim().length > 0) {
        chapters.push({
          title: title || '',
          content: text.trim(),
        });
      }
    }
  }

  return chapters;
}

function detectContentTypeForTXT(html: string, href: string): 'text' | 'image' | 'toc' | 'frontmatter' | 'backmatter' {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.bmp', '.webp'];
  if (imageExtensions.some(ext => href.toLowerCase().endsWith(ext))) {
    return 'image';
  }

  const hasImages = /<img[^>]*>/gi.test(html);
  const textContentLength = html.replace(/<[^>]+>/g, '').trim().length;
  if (hasImages && textContentLength < 100) {
    return 'image';
  }

  const tocKeywords = ['目次', 'contents', 'table of contents', 'toc', 'chapter list', '章节目录'];
  if (tocKeywords.some(kw => html.toLowerCase().includes(kw))) {
    return 'toc';
  }

  const frontmatterKeywords = ['版权', 'copyright', '著作者', 'author', '発行', 'publisher', '出版社', 'はじめに', '序', '前言', '概要'];
  if (frontmatterKeywords.some(kw => html.toLowerCase().includes(kw))) {
    return 'frontmatter';
  }

  const backmatterKeywords = ['あとがき', '後記', '后记', '附录', '付録'];
  if (backmatterKeywords.some(kw => html.toLowerCase().includes(kw))) {
    return 'backmatter';
  }

  return 'text';
}

function extractXmlValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`));
  return match ? match[1].trim() : null;
}

function extractChapterTitle(html: string): string | null {
  const titleMatch = html.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  return null;
}

function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<img[^>]*>[\s\S]*?<\/img>/gi, '');
  text = text.replace(/<img[^>]*\/?>/gi, '');
  text = text.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');

  text = text.replace(/<\/(p|div|br|h[1-6]|li|tr|blockquote|section|article|header|footer|nav|aside)/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  text = text.replace(/<[^>]+>/g, '');

  text = decodeHtmlEntities(text);

  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\u3000/g, ' ');
  text = text.replace(/\u00A0/g, ' ');
  text = text.trim();

  return text;
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
    '&#39;': "'", '&apos;': "'", '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
    '&ldquo;': '"', '&rdquo;': '"', '&lsquo;': '\u2018', '&rsquo;': '\u2019',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }

  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return result;
}

/**
 * 从 TXT 文本创建 EPUBBook（用于阅读/打字练习）
 */
export function createBookFromTXT(
  text: string,
  language: 'ja' | 'zh',
  filename?: string
): EPUBBook {
  const title = filename
    ? filename.replace(/\.txt$/i, '').replace(/_[^_]+$/, '')
    : language === 'ja'
    ? '日语 TXT'
    : '中文 TXT';

  return {
    id: `txt-${language}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    author: '未知作者',
    language,
    chapters: [
      {
        id: 'chapter-0',
        title: '正文',
        content: text,
        order: 0,
      },
    ],
    addedAt: Date.now(),
  };
}

/**
 * 下载文本为 TXT 文件
 */
export function downloadAsTXT(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 尝试多种编码读取 TXT 文件
 */
export async function readTXTFileWithEncoding(file: File): Promise<{ text: string; encoding: string }> {
  const encodings = ['utf-8', 'gbk', 'gb2312', 'big5'];

  for (const encoding of encodings) {
    try {
      const text = await readTXTFileWithEncodingInternal(file, encoding);
      // 简单判断：如果解码后出现大量乱码特征，则尝试下一个编码
      if (!hasGarbledCharacters(text)) {
        return { text, encoding };
      }
    } catch (err) {
      console.warn(`使用编码 ${encoding} 读取失败:`, err);
    }
  }

  // 默认返回 UTF-8 结果
  const text = await readTXTFileWithEncodingInternal(file, 'utf-8');
  return { text, encoding: 'utf-8' };
}

function readTXTFileWithEncodingInternal(file: File, encoding: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('读取结果不是文本格式'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('读取失败'));
    reader.readAsText(file, encoding);
  });
}

/**
 * 检查文本是否包含明显的乱码特征
 */
function hasGarbledCharacters(text: string): boolean {
  // 常见乱码字符集合
  const garbledPattern = /[�\ufffd[\u0000-\u0008][\u000b-\u000c][\u000e-\u001f]]/g;
  const garbledMatches = text.match(garbledPattern);
  if (!garbledMatches) return false;

  const garbledRatio = garbledMatches.length / text.length;
  return garbledRatio > 0.01; // 乱码字符超过1%认为解码失败
}

/**
 * 解析 TXT 为段落数组
 */
export function parseTXTToParagraphs(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return paragraphs.filter(paragraph => {
    // 过滤只有标点的段落
    if (/^[。、，！？；：\.\,\!\?\;\:\-\(\)\[\]【】「」『』《》<>『』「」（）＜＞＋－＝＿]+$/.test(paragraph)) {
      return false;
    }
    
    // 过滤只有数字和标点的段落
    if (/^[\d。、，！？；：\.\,\!\?\;\:\-\(\)\[\]（）＜＞]+$/.test(paragraph)) {
      return false;
    }
    
    // 过滤只有罗马数字的段落
    if (/^[IVXLCDMivxlcdm。、，！？；：\.\,\!\?\;\:\-\(\)\[\]]+$/.test(paragraph)) {
      return false;
    }
    
    // 过滤只有中文数字的段落
    if (/^[一二三四五六七八九十百千万亿零。、，！？；：\.\,\!\?\;\:\-\(\)\[\]]+$/.test(paragraph)) {
      return false;
    }
    
    // 过滤只有单个日文字符的段落
    if (/^[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf\u3000-\u303f]{0,1}$/.test(paragraph)) {
      return false;
    }
    
    // 过滤只有空白字符的段落
    if (/^[\s\n\r\t]+$/.test(paragraph)) {
      return false;
    }
    
    return true;
  });
}

/**
 * 日语-中文 TXT 段落匹配器
 */
export class TXTParagraphMatcher {
  private jpParagraphs: string[];
  private zhParagraphs: string[];
  private alignments: AlignmentPair[] = [];

  constructor(jpText: string, zhText: string) {
    this.jpParagraphs = parseTXTToParagraphs(jpText);
    this.zhParagraphs = parseTXTToParagraphs(zhText);
  }

  /**
   * 获取日语段落数
   */
  getJpParagraphCount(): number {
    return this.jpParagraphs.length;
  }

  /**
   * 获取中文段落数
   */
  getZhParagraphCount(): number {
    return this.zhParagraphs.length;
  }

  /**
   * 获取日语段落
   */
  getJpParagraphs(): string[] {
    return this.jpParagraphs;
  }

  /**
   * 获取中文段落
   */
  getZhParagraphs(): string[] {
    return this.zhParagraphs;
  }

  /**
   * 执行段落匹配
   */
  match(): AlignmentPair[] {
    if (this.jpParagraphs.length === 0 || this.zhParagraphs.length === 0) {
      console.warn('段落匹配失败：输入段落为空', { 
        jpLen: this.jpParagraphs.length, 
        zhLen: this.zhParagraphs.length 
      });
      return [];
    }

    console.log(`开始匹配：日语段落 ${this.jpParagraphs.length} 个，中文段落 ${this.zhParagraphs.length} 个`);

    const alignments: AlignmentPair[] = [];
    const usedJp = new Set<number>();
    const usedZh = new Set<number>();

    // 策略0: 精确匹配
    for (let i = 0; i < this.jpParagraphs.length; i++) {
      if (usedJp.has(i)) continue;

      const jpClean = this.cleanText(this.jpParagraphs[i]);

      for (let j = 0; j < this.zhParagraphs.length; j++) {
        if (usedZh.has(j)) continue;

        const zhClean = this.cleanText(this.zhParagraphs[j]);

        if (jpClean.length > 5 && jpClean === zhClean) {
          alignments.push({ jpIndex: i, zhIndex: j, score: 100 });
          usedJp.add(i);
          usedZh.add(j);
          break;
        }
      }
    }

    // 策略1: 长度比例匹配
    for (let i = 0; i < this.jpParagraphs.length; i++) {
      if (usedJp.has(i)) continue;

      const jpLen = this.jpParagraphs[i].length;

      for (let j = 0; j < this.zhParagraphs.length; j++) {
        if (usedZh.has(j)) continue;

        const zhLen = this.zhParagraphs[j].length;
        const lenRatio = zhLen / Math.max(jpLen, 1);

        if (lenRatio >= 0.9 && lenRatio <= 3.5) {
          const score = this.calculateScore(this.jpParagraphs[i], this.zhParagraphs[j]);
          if (score >= 55) {
            alignments.push({ jpIndex: i, zhIndex: j, score });
            usedJp.add(i);
            usedZh.add(j);
            break;
          }
        }
      }
    }

    // 策略2: 关键词匹配
    for (let i = 0; i < this.jpParagraphs.length; i++) {
      if (usedJp.has(i)) continue;

      const jpKeywords = this.extractKeywords(this.jpParagraphs[i]);
      if (jpKeywords.length === 0) continue;

      for (let j = 0; j < this.zhParagraphs.length; j++) {
        if (usedZh.has(j)) continue;

        const zhKeywords = this.extractKeywords(this.zhParagraphs[j]);
        const matchCount = jpKeywords.filter(k => zhKeywords.includes(k)).length;

        if (matchCount >= 1) {
          const score = this.calculateScore(this.jpParagraphs[i], this.zhParagraphs[j]);
          if (score >= 20) {
            alignments.push({ jpIndex: i, zhIndex: j, score: score + 30 });
            usedJp.add(i);
            usedZh.add(j);
            break;
          }
        }
      }
    }

    // 策略3: 汉字匹配
    for (let i = 0; i < this.jpParagraphs.length; i++) {
      if (usedJp.has(i)) continue;

      const jpKanji = this.extractKanji(this.jpParagraphs[i]);
      if (jpKanji.length < 2) continue;

      for (let j = 0; j < this.zhParagraphs.length; j++) {
        if (usedZh.has(j)) continue;

        const zhKanji = this.extractKanji(this.zhParagraphs[j]);
        
        let matchCount = 0;
        for (const kanji of jpKanji) {
          if (zhKanji.includes(kanji)) {
            matchCount++;
          }
        }

        if (matchCount >= Math.min(2, jpKanji.length)) {
          const score = this.calculateScore(this.jpParagraphs[i], this.zhParagraphs[j]);
          if (score >= 20) {
            alignments.push({ jpIndex: i, zhIndex: j, score: score + 25 });
            usedJp.add(i);
            usedZh.add(j);
            break;
          }
        }
      }
    }

    // 策略4: 贪心匹配
    for (let i = 0; i < this.jpParagraphs.length; i++) {
      if (usedJp.has(i)) continue;

      let bestScore = 0;
      let bestJ = -1;

      for (let j = 0; j < this.zhParagraphs.length; j++) {
        if (usedZh.has(j)) continue;

        const score = this.calculateScore(this.jpParagraphs[i], this.zhParagraphs[j]);
        if (score > bestScore) {
          bestScore = score;
          bestJ = j;
        }
      }

      if (bestJ >= 0 && bestScore >= 10) {
        alignments.push({ jpIndex: i, zhIndex: bestJ, score: bestScore });
        usedJp.add(i);
        usedZh.add(bestJ);
      }
    }

    // 策略5: 顺序匹配（处理剩余段落）
    const unusedJp = this.jpParagraphs
      .map((_, i) => i)
      .filter(i => !usedJp.has(i));
    const unusedZh = this.zhParagraphs
      .map((_, i) => i)
      .filter(i => !usedZh.has(i));

    const minLen = Math.min(unusedJp.length, unusedZh.length);
    for (let k = 0; k < minLen; k++) {
      alignments.push({
        jpIndex: unusedJp[k],
        zhIndex: unusedZh[k],
        score: 5,
      });
    }

    this.alignments = alignments.sort((a, b) => a.jpIndex - b.jpIndex);
    
    console.log(`匹配完成：共匹配 ${this.alignments.length} 对`);
    
    return this.alignments;
  }

  /**
   * 获取匹配结果
   */
  getAlignments(): AlignmentPair[] {
    return this.alignments;
  }

  /**
   * 获取匹配准确率
   */
  getAccuracy(): number {
    if (this.alignments.length === 0) return 0;
    const validAlignments = this.alignments.filter(a => a.score >= 50);
    return (validAlignments.length / this.alignments.length) * 100;
  }

  private cleanText(text: string): string {
    return text.replace(/[。、，！？；：\.\,\!\?\;\:\-\(\)\[\]【】「」『』《》\s]/g, '');
  }

  private calculateScore(jp: string, zh: string): number {
    let score = 0;

    // 长度评分
    const lenRatio = zh.length / Math.max(jp.length, 1);
    if (lenRatio >= 0.5 && lenRatio <= 4.0) {
      const idealRatio = 1.4;
      const diff = Math.abs(lenRatio - idealRatio);
      score += Math.max(0, 100 - diff * 30) * 0.25;
    }

    // 标点评分
    const jpPunct = this.extractPunctuation(jp);
    const zhPunct = this.extractPunctuation(zh);
    score += this.calculatePunctuationScore(jpPunct, zhPunct) * 0.25;

    // 关键词评分
    const jpKeywords = this.extractKeywords(jp);
    const zhKeywords = this.extractKeywords(zh);
    if (jpKeywords.length > 0 || zhKeywords.length > 0) {
      const matchRatio = jpKeywords.filter(k => zhKeywords.includes(k)).length / 
        Math.max(jpKeywords.length, zhKeywords.length, 1);
      score += matchRatio * 20;
    }

    // 汉字密度评分
    const jpKanjiCount = (jp.match(/[\u4e00-\u9faf]/g) || []).length;
    const zhKanjiCount = (zh.match(/[\u4e00-\u9faf]/g) || []).length;
    const jpKanjiRatio = jpKanjiCount / Math.max(jp.length, 1);
    const zhKanjiRatio = zhKanjiCount / Math.max(zh.length, 1);
    score += (1 - Math.abs(jpKanjiRatio - zhKanjiRatio)) * 15;

    return Math.min(100, Math.max(0, score));
  }

  private calculatePunctuationScore(punct1: string[], punct2: string[]): number {
    if (punct1.length === 0 && punct2.length === 0) return 50;
    if (punct1.length === 0 || punct2.length === 0) return 0;

    const set1 = new Set(punct1);
    const set2 = new Set(punct2);
    let matches = 0;

    for (const p of set1) {
      if (set2.has(p)) {
        matches++;
      }
    }

    const unionSize = new Set([...set1, ...set2]).size;
    return (matches / unionSize) * 100;
  }

  private extractPunctuation(text: string): string[] {
    const punctRegex = /[。？！、，；：""''（）【】《》「」『』…—–\.\,\!\?\;\:\(\)\[\]<>]/g;
    return text.match(punctRegex) || [];
  }

  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    
    // 提取连续汉字
    const kanjiMatches = text.match(/[\u4e00-\u9faf]{2,}/g);
    if (kanjiMatches) {
      keywords.push(...kanjiMatches);
    }

    // 提取片假名
    const katakanaMatches = text.match(/[\u30a0-\u30ff]{2,}/g);
    if (katakanaMatches) {
      keywords.push(...katakanaMatches);
    }

    return keywords;
  }

  private extractKanji(text: string): string[] {
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
}

/**
 * 导出对齐结果为 JSON
 */
export function exportAlignmentsToJSON(alignments: AlignmentPair[]): string {
  return JSON.stringify(alignments, null, 2);
}

/**
 * 从 JSON 导入对齐结果
 */
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
