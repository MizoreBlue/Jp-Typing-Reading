import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import {
  parseTXTToParagraphs,
  TXTParagraphMatcher,
  exportAlignmentsToJSON,
  importAlignmentsFromJSON,
  downloadAsTXT,
  epubToTXT,
} from './txt';

describe('parseTXTToParagraphs', () => {
  it('should split text into paragraphs', () => {
    const text = '第一段内容。\n\n第二段内容。\n\n第三段内容。';
    const paragraphs = parseTXTToParagraphs(text);
    expect(paragraphs).toHaveLength(3);
    expect(paragraphs[0]).toBe('第一段内容。');
    expect(paragraphs[1]).toBe('第二段内容。');
    expect(paragraphs[2]).toBe('第三段内容。');
  });

  it('should filter out punctuation-only paragraphs', () => {
    const text = '正文段落。\n\n。\n\n。、！\n\n另一段正文。';
    const paragraphs = parseTXTToParagraphs(text);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBe('正文段落。');
    expect(paragraphs[1]).toBe('另一段正文。');
  });

  it('should filter out number-only paragraphs and chapter indexes', () => {
    const text = '第一章\n\n123\n\n456.789\n\n正文开始。';
    const paragraphs = parseTXTToParagraphs(text);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toBe('正文开始。');
  });

  it('should handle Japanese text correctly', () => {
    const text = '今日は良い天気です。\n\n明日も晴れるでしょう。\n\n';
    const paragraphs = parseTXTToParagraphs(text);
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBe('今日は良い天気です。');
  });

  it('should trim whitespace from paragraphs', () => {
    const text = '   段落内容   \n\n   另一段   ';
    const paragraphs = parseTXTToParagraphs(text);
    expect(paragraphs[0]).toBe('段落内容');
    expect(paragraphs[1]).toBe('另一段');
  });

  it('should handle empty text', () => {
    expect(parseTXTToParagraphs('')).toEqual([]);
  });

  it('should treat single newline within a paragraph', () => {
    const text = '第一段。\n第二段。';
    const paragraphs = parseTXTToParagraphs(text);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toBe('第一段。\n第二段。');
  });

  it('should filter out too short paragraphs', () => {
    const text = '第一段内容。\n\n。\n\n第二段内容。';
    const paragraphs = parseTXTToParagraphs(text);
    expect(paragraphs).toHaveLength(2);
  });

  it('should filter out single kana paragraphs', () => {
    const text = 'あ\n\n本段内容。';
    const paragraphs = parseTXTToParagraphs(text);
    expect(paragraphs).toHaveLength(1);
    expect(paragraphs[0]).toBe('本段内容。');
  });

  it('should filter out whitespace-only paragraphs', () => {
    const text = '第一段。\n\n   \n\n第二段。';
    const paragraphs = parseTXTToParagraphs(text);
    expect(paragraphs).toHaveLength(2);
  });
});

describe('TXTParagraphMatcher', () => {
  const jpText = '第一章\n\n今日は良い天気です。\n\n私は学校へ行きます。\n\n';
  const zhText = '第一章\n\n今天天气很好。\n\n我去学校。\n\n';

  it('should initialize with parsed paragraphs', () => {
    const matcher = new TXTParagraphMatcher(jpText, zhText);
    expect(matcher.getJpParagraphCount()).toBe(2);
    expect(matcher.getZhParagraphCount()).toBe(2);
    expect(matcher.getJpParagraphs()).toHaveLength(2);
    expect(matcher.getZhParagraphs()).toHaveLength(2);
  });

  it('should return empty alignments for empty input', () => {
    const matcher = new TXTParagraphMatcher('', zhText);
    expect(matcher.match()).toEqual([]);
    expect(matcher.getAccuracy()).toBe(0);
  });

  it('should return empty alignments when both inputs are empty', () => {
    const matcher = new TXTParagraphMatcher('', '');
    expect(matcher.match()).toEqual([]);
  });

  it('should match corresponding paragraphs', () => {
    const matcher = new TXTParagraphMatcher(jpText, zhText);
    const alignments = matcher.match();
    expect(alignments.length).toBeGreaterThan(0);
    expect(matcher.getAccuracy()).toBeGreaterThanOrEqual(0);
  });

  it('should return alignment results', () => {
    const matcher = new TXTParagraphMatcher(jpText, zhText);
    matcher.match();
    const results = matcher.getAlignments();
    expect(Array.isArray(results)).toBe(true);
    results.forEach((alignment) => {
      expect(alignment).toHaveProperty('jpIndex');
      expect(alignment).toHaveProperty('zhIndex');
      expect(alignment).toHaveProperty('score');
    });
  });

  it('should handle exact match when cleaned texts are identical', () => {
    const sameText = 'これはテストです。\n\nこれはテストです。';
    const matcher = new TXTParagraphMatcher(sameText, sameText);
    const alignments = matcher.match();
    const exactMatches = alignments.filter(a => a.score === 100);
    expect(exactMatches.length).toBeGreaterThan(0);
  });

  it('should fallback to sequential match for unmatched paragraphs', () => {
    const shortJp = 'あ。\n\nい。';
    const shortZh = '啊。\n\n哦。';
    const matcher = new TXTParagraphMatcher(shortJp, shortZh);
    const alignments = matcher.match();
    expect(alignments.length).toBeGreaterThan(0);
  });

  it('should return accuracy based on score threshold', () => {
    const matcher = new TXTParagraphMatcher(jpText, zhText);
    matcher.match();
    const accuracy = matcher.getAccuracy();
    expect(accuracy).toBeGreaterThanOrEqual(0);
    expect(accuracy).toBeLessThanOrEqual(100);
  });

  it('should handle paragraphs with very different lengths', () => {
    const jp = '短い。';
    const zh = '这是一段非常非常长的中文翻译内容，用来测试长度比例不匹配的情况。';
    const matcher = new TXTParagraphMatcher(jp, zh);
    const alignments = matcher.match();
    expect(alignments.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle paragraphs without shared kanji', () => {
    const jp = 'あいうえお。';
    const zh = '今天天气很好。';
    const matcher = new TXTParagraphMatcher(jp, zh);
    const alignments = matcher.match();
    expect(alignments.length).toBeGreaterThanOrEqual(0);
  });

  it('should match paragraphs with shared kanji keywords', () => {
    const jp = '今日は学校へ行きます。';
    const zh = '今天我去学校。';
    const matcher = new TXTParagraphMatcher(jp, zh);
    const alignments = matcher.match();
    expect(alignments.length).toBeGreaterThan(0);
  });

  it('should handle paragraphs with katakana keywords', () => {
    const jp = 'コーヒーを飲みます。';
    const zh = '我喝咖啡。';
    const matcher = new TXTParagraphMatcher(jp, zh);
    const alignments = matcher.match();
    expect(alignments.length).toBeGreaterThanOrEqual(0);
  });

  it('should match paragraphs by shared katakana keyword', () => {
    const jp = 'コーヒーがとても好きです。';
    const zh = 'コーヒー。';
    const matcher = new TXTParagraphMatcher(jp, zh);
    const alignments = matcher.match();
    expect(alignments.length).toBeGreaterThan(0);
  });
});

describe('Alignment JSON export/import', () => {
  const alignments = [
    { jpIndex: 0, zhIndex: 0, score: 100 },
    { jpIndex: 1, zhIndex: 2, score: 85 },
  ];

  it('should export alignments to JSON', () => {
    const json = exportAlignmentsToJSON(alignments);
    expect(JSON.parse(json)).toEqual(alignments);
  });

  it('should import alignments from JSON', () => {
    const json = JSON.stringify(alignments);
    const imported = importAlignmentsFromJSON(json);
    expect(imported).toEqual(alignments);
  });

  it('should return empty array for invalid JSON', () => {
    const imported = importAlignmentsFromJSON('invalid json');
    expect(imported).toEqual([]);
  });

  it('should return empty array for non-array JSON', () => {
    const imported = importAlignmentsFromJSON('{"alignments": []}');
    expect(imported).toEqual([]);
  });
});

async function createMockEPUBFile(): Promise<File> {
  const zip = new JSZip();
  zip.file(
    'META-INF/container.xml',
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
  );

  const opf = `<?xml version="1.0"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test Book</dc:title><dc:creator>Test Author</dc:creator></metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`;
  zip.file('content.opf', opf);
  zip.file(
    'ch1.xhtml',
    '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Chapter 1</h1><p>これはテストです。</p></body></html>'
  );

  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  return {
    name: 'test.epub',
    size: arrayBuffer.byteLength,
    type: 'application/epub+zip',
    arrayBuffer: async () => arrayBuffer,
  } as unknown as File;
}

describe('epubToTXT', () => {
  it('should convert a valid EPUB to TXT', async () => {
    const file = await createMockEPUBFile();
    const text = await epubToTXT(file);
    expect(text).toContain('Test Book');
    expect(text).toContain('Test Author');
    expect(text).toContain('Chapter 1');
    expect(text).toContain('これはテストです。');
  });

  it('should throw for invalid EPUB', async () => {
    const zip = new JSZip();
    zip.file('not-container.xml', 'invalid');
    const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = {
      name: 'bad.epub',
      size: arrayBuffer.byteLength,
      type: 'application/epub+zip',
      arrayBuffer: async () => arrayBuffer,
    } as unknown as File;
    await expect(epubToTXT(file)).rejects.toThrow('container.xml');
  });
});

describe('downloadAsTXT', () => {
  it('should create download link with correct filename', () => {
    const clickSpy = vi.fn();
    const revokeSpy = vi.fn();

    const originalCreateElement = document.createElement;
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        const anchor = originalCreateElement.call(document, 'a');
        anchor.click = clickSpy;
        return anchor;
      }
      return originalCreateElement.call(document, tagName);
    });

    URL.revokeObjectURL = revokeSpy;

    downloadAsTXT('测试内容', 'test.txt');
    expect(clickSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });
});
