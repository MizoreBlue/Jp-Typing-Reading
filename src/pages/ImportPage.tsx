import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Upload, ArrowRight, Trash2, FileText } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { parseEPUB, isValidEPUB, splitToParagraphs } from '@/utils/epub';
import { alignParagraphs } from '@/utils/aligner';

export default function ImportPage() {
  const navigate = useNavigate();
  const { jpBook, zhBook, setJPBook, setZHBook, setAlignments, reset } = useBookStore();

  const [jpFile, setJpFile] = useState<File | null>(null);
  const [zhFile, setZhFile] = useState<File | null>(null);
  const [jpPreview, setJpPreview] = useState<string | null>(null);
  const [zhPreview, setZhPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (type: 'jp' | 'zh', file: File) => {
      setError(null);

      // 验证文件格式
      const valid = await isValidEPUB(file);
      if (!valid) {
        setError(`${type === 'jp' ? '日语' : '中文'}EPUB 文件无效`);
        return;
      }

      try {
        const book = await parseEPUB(file);

        if (type === 'jp') {
          setJpFile(file);
          await setJPBook(book);
          const paragraphs = splitToParagraphs(book.chapters[0]?.content || '');
          setJpPreview(`${book.title} - ${paragraphs.length} 段落`);
        } else {
          setZhFile(file);
          await setZHBook(book);
          const paragraphs = splitToParagraphs(book.chapters[0]?.content || '');
          setZhPreview(`${book.title} - ${paragraphs.length} 段落`);
        }
      } catch (err) {
        setError(`解析 EPUB 失败: ${err instanceof Error ? err.message : '未知错误'}`);
      }
    },
    [setJPBook, setZHBook]
  );

  const handleDrop = useCallback(
    (type: 'jp' | 'zh') => (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(type, file);
    },
    [handleFileSelect]
  );

  const handleStartAlignment = useCallback(async () => {
    if (!jpBook || !zhBook) return;

    setIsLoading(true);
    try {
      // 获取第一章的段落进行对齐
      const jpParagraphs = splitToParagraphs(jpBook.chapters[0]?.content || '');
      const zhParagraphs = splitToParagraphs(zhBook.chapters[0]?.content || '');

      const alignments = alignParagraphs(jpParagraphs, zhParagraphs);
      await setAlignments(alignments);

      navigate('/align');
    } catch (err) {
      setError(`对齐失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  }, [jpBook, zhBook, setAlignments, navigate]);

  const handleClear = useCallback(() => {
    reset();
    setJpFile(null);
    setZhFile(null);
    setJpPreview(null);
    setZhPreview(null);
    setError(null);
  }, [reset]);

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="bg-indigo-900 text-white py-8">
        <div className="container mx-auto px-6">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold font-noto-serif">JP-Typing-Reader</h1>
              <p className="text-sm text-indigo-200">双语轻小说打字阅读器</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* File Upload Area */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* Japanese EPUB */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              jpFile
                ? 'border-sakura-400 bg-sakura-400/10'
                : 'border-indigo-300 hover:border-indigo-500 bg-white'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop('jp')}
          >
            <input
              type="file"
              accept=".epub"
              onChange={(e) => e.target.files?.[0] && handleFileSelect('jp', e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className={`w-12 h-12 mx-auto mb-4 ${jpFile ? 'text-sakura-400' : 'text-indigo-400'}`} />
            <h3 className="text-lg font-semibold mb-2">
              {jpFile ? '日语 EPUB 已选择' : '上传日语原文 EPUB'}
            </h3>
            {jpPreview ? (
              <p className="text-sm text-ink-700">{jpPreview}</p>
            ) : (
              <p className="text-sm text-ink-700">拖拽文件或点击选择</p>
            )}
            {jpFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setJpFile(null);
                  setJpPreview(null);
                  setJPBook(null);
                }}
                className="mt-4 text-sm text-red-500 hover:text-red-700"
              >
                移除文件
              </button>
            )}
          </div>

          {/* Chinese EPUB */}
          <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              zhFile
                ? 'border-sakura-400 bg-sakura-400/10'
                : 'border-indigo-300 hover:border-indigo-500 bg-white'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop('zh')}
          >
            <input
              type="file"
              accept=".epub"
              onChange={(e) => e.target.files?.[0] && handleFileSelect('zh', e.target.files[0])}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className={`w-12 h-12 mx-auto mb-4 ${zhFile ? 'text-sakura-400' : 'text-indigo-400'}`} />
            <h3 className="text-lg font-semibold mb-2">
              {zhFile ? '中文 EPUB 已选择' : '上传中文译文 EPUB'}
            </h3>
            {zhPreview ? (
              <p className="text-sm text-ink-700">{zhPreview}</p>
            ) : (
              <p className="text-sm text-ink-700">拖拽文件或点击选择</p>
            )}
            {zhFile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setZhFile(null);
                  setZhPreview(null);
                  setZHBook(null);
                }}
                className="mt-4 text-sm text-red-500 hover:text-red-700"
              >
                移除文件
              </button>
            )}
          </div>
        </div>

        {/* TXT Match Link */}
        <div className="mt-8 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-indigo-600" />
              <div>
                <h3 className="font-semibold text-indigo-900">使用 TXT 文件进行段落匹配</h3>
                <p className="text-sm text-indigo-700">如果你有日语和中文的 TXT 文件，可以直接导入并匹配段落</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/txt-match')}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              打开 TXT 匹配
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-6 py-3 border border-ink-700 rounded-lg hover:bg-ink-700/5 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            清空选择
          </button>
          <button
            onClick={handleStartAlignment}
            disabled={(!jpFile && !jpBook) || (!zhFile && !zhBook) || isLoading}
            className={`flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all ${
              ((jpFile || jpBook) && (zhFile || zhBook) && !isLoading)
                ? 'bg-indigo-900 text-white hover:bg-indigo-800'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isLoading ? '处理中...' : '开始对齐与阅读'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Book List */}
        {(jpBook || zhBook) && (
          <div className="mt-12">
            <h2 className="text-xl font-bold mb-4">已导入书籍</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {jpBook && (
                <div className="p-4 bg-white rounded-lg border border-indigo-200">
                  <h3 className="font-semibold text-indigo-900">日语原文</h3>
                  <p className="text-lg">{jpBook.title}</p>
                  <p className="text-sm text-ink-700">作者: {jpBook.author}</p>
                  <p className="text-sm text-ink-700">章节: {jpBook.chapters.length}</p>
                </div>
              )}
              {zhBook && (
                <div className="p-4 bg-white rounded-lg border border-sakura-400/50">
                  <h3 className="font-semibold text-sakura-400">中文译文</h3>
                  <p className="text-lg">{zhBook.title}</p>
                  <p className="text-sm text-ink-700">作者: {zhBook.author}</p>
                  <p className="text-sm text-ink-700">章节: {zhBook.chapters.length}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
