import JSZip from 'jszip';
import type { EPUBBook, Chapter } from '@/types';

export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  TOC = 'toc',
  FRONTMATTER = 'frontmatter',
  BACKMATTER = 'backmatter',
  OTHER = 'other',
}

function detectContentType(html: string, href: string): ContentType {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.bmp', '.webp'];
  if (imageExtensions.some(ext => href.toLowerCase().endsWith(ext))) {
    return ContentType.IMAGE;
  }

  const hasImages = /<img[^>]*>/gi.test(html);
  const hasImageTags = /<image[^>]*>/gi.test(html);
  
  const textContentLength = html.replace(/<[^>]+>/g, '').trim().length;
  if ((hasImages || hasImageTags) && textContentLength < 100) {
    return ContentType.IMAGE;
  }

  const tocKeywords = ['目次', 'contents', 'table of contents', 'toc', 'chapter list', '章节目录'];
  const lowerHtml = html.toLowerCase();
  if (tocKeywords.some(kw => lowerHtml.includes(kw))) {
    return ContentType.TOC;
  }

  const frontmatterKeywords = [
    '版权', 'copyright', '著作者', 'author', 
    '発行', 'publisher', '出版社', 
    'はじめに', '序', '前言', '序言', '序章',
    'あらすじ', '概要', '简介', '简介',
    '目次', 'contents',
    '版权所有', '著作权', 'reserved',
    '出版', '発売', '発行所',
    '編集', 'editor', '翻訳', 'translation',
    '装画', 'イラスト', 'illustrator',
    '監修', 'supervisor', '企画', 'producer',
    '表紙', 'cover', 'ジャケット'
  ];
  if (frontmatterKeywords.some(kw => lowerHtml.includes(kw))) {
    return ContentType.FRONTMATTER;
  }

  const backmatterKeywords = ['あとがき', '後記', '后记', '跋', '附录', '付録', '索引', '参考文献', 'reference'];
  if (backmatterKeywords.some(kw => lowerHtml.includes(kw))) {
    return ContentType.BACKMATTER;
  }

  return ContentType.TEXT;
}

function shouldSkipContent(contentType: ContentType): boolean {
  return contentType === ContentType.IMAGE || contentType === ContentType.TOC;
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

export async function parseEPUB(file: File): Promise<EPUBBook> {
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
  const language = detectLanguage(opfXml) || 'ja';

  let chapters = await extractChapters(zip, opfXml, opfDir);

  // 兜底：如果按 spine 未解析出章节，直接扫描 XHTML/HTML 内容文件
  if (chapters.length === 0) {
    chapters = await extractChaptersFromFiles(zip);
  }

  return {
    id: `book-${Date.now()}`,
    title,
    author,
    language,
    chapters,
    addedAt: Date.now(),
  };
}

async function extractChaptersFromFiles(zip: JSZip): Promise<Chapter[]> {
  const chapters: Chapter[] = [];
  let order = 0;

  const contentFiles = Object.keys(zip.files)
    .filter((path) => {
      const lower = path.toLowerCase();
      return (lower.endsWith('.xhtml') || lower.endsWith('.html')) && !lower.includes('nav') && !lower.includes('toc');
    })
    .sort();

  for (const path of contentFiles) {
    const content = await zip.file(path)?.async('text');
    if (!content) continue;

    const text = extractTextFromHtml(content);
    if (text.trim().length > 0) {
      chapters.push({
        id: `chapter-${order}`,
        title: extractChapterTitle(content) || `Chapter ${order + 1}`,
        content: text,
        order: order++,
      });
    }
  }

  return chapters;
}

function extractXmlValue(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`));
  return match ? match[1].trim() : null;
}

function detectLanguage(opfXml: string): 'ja' | 'zh' | null {
  const langMatch = opfXml.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
  if (langMatch) {
    const lang = langMatch[1].toLowerCase();
    if (lang.startsWith('ja')) return 'ja';
    if (lang.startsWith('zh')) return 'zh';
  }
  return null;
}

async function extractChapters(
  zip: JSZip,
  opfXml: string,
  opfDir: string
): Promise<Chapter[]> {
  const manifestItems: Record<string, string> = {};
  // 支持 id/href 任意顺序，并解码 URL 编码
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

  const chapters: Chapter[] = [];
  let order = 0;

  for (const id of spineIds) {
    const href = manifestItems[id];
    if (!href) continue;

    const fullPath = resolveEPUBPath(opfDir, href);
    const content = await zip.file(fullPath)?.async('text');

    if (content) {
      const contentType = detectContentType(content, href);
      
      if (shouldSkipContent(contentType)) {
        console.log(`Skipping content: ${href} (${contentType})`);
        continue;
      }

      const title = extractChapterTitle(content) || `Chapter ${order + 1}`;
      const text = extractTextFromHtml(content);

      if (text.trim().length > 0) {
        chapters.push({
          id: `chapter-${order}`,
          title,
          content: text,
          order: order++,
        });
      }
    }
  }

  return chapters;
}

function extractChapterTitle(html: string): string | null {
  const titleMatch = html.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleTagMatch) {
    return titleTagMatch[1].trim();
  }
  
  return null;
}

function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  text = text.replace(/<img[^>]*>[\s\S]*?<\/img>/gi, '');
  text = text.replace(/<img[^>]*\/?>/gi, '');
  
  text = text.replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, '');
  text = text.replace(/<picture[^>]*>[\s\S]*?<\/picture>/gi, '');

  text = text.replace(/<\/(p|div|br|h[1-6]|li|tr|blockquote|section|article|header|footer|nav|aside)/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');

  text = text.replace(/<[^>]+>/g, '');

  text = decodeHtmlEntities(text);

  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\u3000/g, ' ');
  text = text.replace(/\u00A0/g, ' ');
  text = text.replace(/\u2003/g, ' ');
  text = text.replace(/\u2002/g, ' ');
  text = text.trim();

  return text;
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': '\u2018',
    '&rsquo;': '\u2019',
    '&sbquo;': '\u201A',
    '&bdquo;': '\u201E',
    '&dagger;': '†',
    '&Dagger;': '‡',
    '&permil;': '‰',
    '&lsaquo;': '‹',
    '&rsaquo;': '›',
    '&oline;': '‾',
    '&euro;': '€',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&laquo;': '«',
    '&raquo;': '»',
    '&deg;': '°',
    '&plusmn;': '±',
    '&times;': '×',
    '&divide;': '÷',
    '&sup2;': '²',
    '&sup3;': '³',
    '&sup1;': '¹',
    '&frac14;': '¼',
    '&frac12;': '½',
    '&frac34;': '¾',
    '&micro;': 'µ',
    '&middot;': '·',
    '&cent;': '¢',
    '&pound;': '£',
    '&yen;': '¥',
    '&sect;': '§',
    '&para;': '¶',
    '&ordf;': 'ª',
    '&ordm;': 'º',
    '&iexcl;': '¡',
    '&curren;': '¤',
    '&not;': '¬',
    '&shy;': '',
    '&macr;': '¯',
    '&acute;': '´',
    '&cedil;': '¸',
    '&uml;': '¨',
    '&circ;': '^',
    '&tilde;': '˜',
    '&aring;': 'å',
    '&aelig;': 'æ',
    '&oeuml;': 'œ',
    '&iquest;': '¿',
    '&Agrave;': 'À',
    '&Aacute;': 'Á',
    '&Acirc;': 'Â',
    '&Atilde;': 'Ã',
    '&Auml;': 'Ä',
    '&Aring;': 'Å',
    '&AElig;': 'Æ',
    '&Ccedil;': 'Ç',
    '&Egrave;': 'È',
    '&Eacute;': 'É',
    '&Ecirc;': 'Ê',
    '&Euml;': 'Ë',
    '&Igrave;': 'Ì',
    '&Iacute;': 'Í',
    '&Icirc;': 'Î',
    '&Iuml;': 'Ï',
    '&ETH;': 'Ð',
    '&Ntilde;': 'Ñ',
    '&Ograve;': 'Ò',
    '&Oacute;': 'Ó',
    '&Ocirc;': 'Ô',
    '&Otilde;': 'Õ',
    '&Ouml;': 'Ö',
    '&Oslash;': 'Ø',
    '&OElig;': 'Œ',
    '&Ugrave;': 'Ù',
    '&Uacute;': 'Ú',
    '&Ucirc;': 'Û',
    '&Uuml;': 'Ü',
    '&Yacute;': 'Ý',
    '&THORN;': 'Þ',
    '&szlig;': 'ß',
    '&agrave;': 'à',
    '&aacute;': 'á',
    '&acirc;': 'â',
    '&atilde;': 'ã',
    '&auml;': 'ä',
    '&ccedil;': 'ç',
    '&egrave;': 'è',
    '&eacute;': 'é',
    '&ecirc;': 'ê',
    '&euml;': 'ë',
    '&igrave;': 'ì',
    '&iacute;': 'í',
    '&icirc;': 'î',
    '&iuml;': 'ï',
    '&eth;': 'ð',
    '&ntilde;': 'ñ',
    '&ograve;': 'ò',
    '&oacute;': 'ó',
    '&ocirc;': 'ô',
    '&otilde;': 'õ',
    '&ouml;': 'ö',
    '&oslash;': 'ø',
    '&oelig;': 'œ',
    '&ugrave;': 'ù',
    '&uacute;': 'ú',
    '&ucirc;': 'û',
    '&uuml;': 'ü',
    '&yacute;': 'ý',
    '&thorn;': 'þ',
    '&yuml;': 'ÿ',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'gi'), char);
  }

  result = result.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return result;
}

export function splitToParagraphs(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  return paragraphs.filter(paragraph => {
    if (/^[。、，！？；：\.\,\!\?\;\:\-\(\)\[\]【】「」『』《》<>『』「」（）＜＞＋－＝＿＄％＆＠＃￥]+$/.test(paragraph)) {
      return false;
    }
    
    if (/^[\d。、，！？；：\.\,\!\?\;\:\-\(\)\[\]（）＜＞]+$/.test(paragraph)) {
      return false;
    }
    
    if (/^[IVXLCDMivxlcdm。、，！？；：\.\,\!\?\;\:\-\(\)\[\]]+$/.test(paragraph)) {
      return false;
    }
    
    if (/^[一二三四五六七八九十百千万亿零。、，！？；：\.\,\!\?\;\:\-\(\)\[\]]+$/.test(paragraph)) {
      return false;
    }
    
    if (/^[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9faf\u3000-\u303f]{0,1}$/.test(paragraph)) {
      return false;
    }
    
    if (/^[a-zA-Z。、，！？；：\.\,\!\?\;\:\-\(\)\[\]]{0,1}$/.test(paragraph)) {
      return false;
    }
    
    if (/^[\s\n\r\t]+$/.test(paragraph)) {
      return false;
    }
    
    if (/^[=]+$/.test(paragraph)) {
      return false;
    }
    
    if (/^[-~—]+$/.test(paragraph)) {
      return false;
    }
    
    return true;
  });
}

export async function isValidEPUB(file: File): Promise<boolean> {
  if (!file.name.toLowerCase().endsWith('.epub')) {
    return false;
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    const hasContainer = zip.file('META-INF/container.xml') !== null;
    return hasContainer;
  } catch {
    return false;
  }
}

export function getChapterPreview(text: string, maxLength: number = 100): string {
  return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
}
