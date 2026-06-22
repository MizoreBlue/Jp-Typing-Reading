import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseEPUB } from './epub';

async function createMockEPUBFile(
  overrides?: {
    opfPath?: string;
    opfContent?: string;
    files?: Record<string, string>;
  }
): Promise<File> {
  const zip = new JSZip();
  const opfPath = overrides?.opfPath ?? 'content.opf';
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="${opfPath}" media-type="application/oebps-package+xml"/></rootfiles></container>`
  );

  const opf =
    overrides?.opfContent ??
    `<?xml version="1.0"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test Book</dc:title><dc:creator>Test Author</dc:creator></metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`;

  zip.file(opfPath, opf);

  const defaultFiles: Record<string, string> = {
    'ch1.xhtml':
      '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Chapter 1</h1><p>これはテストです。</p></body></html>',
  };
  const files = overrides?.files ?? defaultFiles;
  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }

  const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
  return {
    name: 'test.epub',
    size: arrayBuffer.byteLength,
    type: 'application/epub+zip',
    arrayBuffer: async () => arrayBuffer,
  } as unknown as File;
}

describe('parseEPUB', () => {
  it('should parse a valid EPUB and extract chapters', async () => {
    const file = await createMockEPUBFile();
    const book = await parseEPUB(file);
    expect(book.title).toBe('Test Book');
    expect(book.author).toBe('Test Author');
    expect(book.chapters.length).toBeGreaterThan(0);
    expect(book.chapters[0].content).toContain('これはテストです。');
  });

  it('should support manifest items with attributes in reverse order', async () => {
    const opf = `<?xml version="1.0"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Reverse</dc:title></metadata>
  <manifest>
    <item href="ch1.xhtml" id="ch1" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`;
    const file = await createMockEPUBFile({ opfContent: opf });
    const book = await parseEPUB(file);
    expect(book.chapters.length).toBeGreaterThan(0);
    expect(book.chapters[0].content).toContain('これはテストです。');
  });

  it('should decode URL-encoded hrefs and resolve nested paths', async () => {
    const opf = `<?xml version="1.0"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Nested</dc:title></metadata>
  <manifest>
    <item id="ch1" href="Text/chapter%201.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`;
    const file = await createMockEPUBFile({
      opfPath: 'OEBPS/content.opf',
      opfContent: opf,
      files: {
        'OEBPS/Text/chapter 1.xhtml':
          '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>ネストされた章です。</p></body></html>',
      },
    });
    const book = await parseEPUB(file);
    expect(book.chapters.length).toBeGreaterThan(0);
    expect(book.chapters[0].content).toContain('ネストされた章です。');
  });

  it('should fallback to scanning HTML files when spine is empty', async () => {
    const opf = `<?xml version="1.0"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>No Spine</dc:title></metadata>
  <manifest>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine></spine>
</package>`;
    const file = await createMockEPUBFile({ opfContent: opf });
    const book = await parseEPUB(file);
    expect(book.chapters.length).toBeGreaterThan(0);
    expect(book.chapters[0].content).toContain('これはテストです。');
  });

  it('should skip image-only and TOC files in fallback scan', async () => {
    const opf = `<?xml version="1.0"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Filtered</dc:title></metadata>
  <manifest></manifest>
  <spine></spine>
</package>`;
    const file = await createMockEPUBFile({
      opfContent: opf,
      files: {
        'toc.xhtml':
          '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>目次</h1><p>Chapter 1</p></body></html>',
        'nav.xhtml':
          '<html xmlns="http://www.w3.org/1999/xhtml"><body><nav>TOC</nav></body></html>',
        'body.xhtml':
          '<html xmlns="http://www.w3.org/1999/xhtml"><body><p>実際の本文です。</p></body></html>',
      },
    });
    const book = await parseEPUB(file);
    expect(book.chapters.length).toBe(1);
    expect(book.chapters[0].content).toContain('実際の本文です。');
  });
});
