import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, BookOpen } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useTypingStore } from '@/stores/typingStore';
import { splitToParagraphs } from '@/utils/epub';
import { addFurigana } from '@/utils/furigana';
import { romajiToHiraganaConvert, isValidRomaji } from '@/utils/romaji';

export default function ReaderPage() {
  const navigate = useNavigate();
  const {
    jpBook,
    zhBook,
    alignments,
    currentChapterIndex,
    setCurrentChapter,
    setProgress,
  } = useBookStore();

  const {
    isActive,
    typedText,
    remainingText,
    currentCharIndex,
    errors,
    startTime,
    startTyping,
    processInput,
    backspace,
    reset,
  } = useTypingStore();

  const [showFurigana, setShowFurigana] = useState(true);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  const [inputBuffer, setInputBuffer] = useState('');

  const typingRef = useRef<HTMLDivElement>(null);
  const zhRef = useRef<HTMLDivElement>(null);

  // 获取当前章节内容
  const jpChapter = jpBook?.chapters[currentChapterIndex];
  const zhChapter = zhBook?.chapters[currentChapterIndex];

  // 获取段落
  const jpParagraphs = splitToParagraphs(jpChapter?.content || '');
  const zhParagraphs = splitToParagraphs(zhChapter?.content || '');

  // 根据对齐结果建立映射（支持部分匹配）
  const alignmentMap = useMemo(() => {
    const map = new Map<number, number>();
    alignments.forEach((a) => map.set(a.jpIndex, a.zhIndex));
    return map;
  }, [alignments]);

  // 当前日文段落
  const currentJpParagraph = jpParagraphs[currentParagraphIndex] || '';
  const currentZhParagraph = alignmentMap.has(currentParagraphIndex)
    ? zhParagraphs[alignmentMap.get(currentParagraphIndex)!] || ''
    : '';

  // 计算 WPM
  const calculateWPM = useCallback(() => {
    if (!startTime || currentCharIndex === 0) return 0;
    const minutes = (Date.now() - startTime) / 60000;
    return Math.round(currentCharIndex / minutes);
  }, [startTime, currentCharIndex]);

  // 计算正确率
  const calculateAccuracy = useCallback(() => {
    if (currentCharIndex === 0) return 100;
    return Math.round(((currentCharIndex - errors) / currentCharIndex) * 100);
  }, [currentCharIndex, errors]);

  // 处理键盘输入
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isActive) {
        // 开始打字
        startTyping(currentJpParagraph);
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        backspace();
        setInputBuffer('');
        return;
      }

      if (e.key === ' ' || e.key === '　') {
        e.preventDefault();
        // 空格表示确认当前输入
        if (inputBuffer.length > 0) {
          // 将罗马音转换为假名（暂不处理匹配逻辑）
          romajiToHiraganaConvert(inputBuffer);
          setInputBuffer('');
        }
        return;
      }

      // 普通字符输入
      if (e.key.length === 1 && isValidRomaji(e.key)) {
        e.preventDefault();
        const newBuffer = inputBuffer + e.key.toLowerCase();
        setInputBuffer(newBuffer);

        // 尝试匹配
        const result = processInput(e.key.toLowerCase());
        if (result.isComplete) {
          // 段落完成，移到下一段
          setTimeout(() => {
            if (currentParagraphIndex < jpParagraphs.length - 1) {
              setCurrentParagraphIndex((prev) => prev + 1);
              setProgress(jpChapter?.id || '', 0);
              reset();
            } else if (currentChapterIndex < (jpBook?.chapters.length || 0) - 1) {
              // 进入下一章
              setCurrentChapter(currentChapterIndex + 1);
              setCurrentParagraphIndex(0);
              reset();
            }
          }, 500);
        }
      }
    },
    [
      isActive,
      inputBuffer,
      currentJpParagraph,
      currentParagraphIndex,
      jpParagraphs.length,
      currentChapterIndex,
      jpChapter?.id,
      jpBook,
      startTyping,
      processInput,
      backspace,
      reset,
      setCurrentChapter,
      setProgress,
    ]
  );

  // 监听键盘事件
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 滚动同步
  useEffect(() => {
    if (zhRef.current) {
      // 简单的滚动同步
      zhRef.current.scrollTop = currentParagraphIndex * 100;
    }
  }, [currentParagraphIndex]);

  // 聚焦输入区域
  useEffect(() => {
    typingRef.current?.focus();
  }, []);

  if (!jpBook || !zhBook) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-700 mb-4">请先导入书籍</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-indigo-900 text-white rounded-lg hover:bg-indigo-800"
          >
            返回导入页
          </button>
        </div>
      </div>
    );
  }

  // 渲染带注音的文本
  const renderFuriganaText = (text: string) => {
    if (!showFurigana) {
      return <span>{text}</span>;
    }

    const tokens = addFurigana(text);
    return (
      <span>
        {tokens.map((token, i) => (
          <ruby key={i} className="relative">
            {token.kanji}
            {token.furigana && (
              <rt className="text-xs text-sakura-400 font-normal -translate-y-1/2">
                {token.furigana}
              </rt>
            )}
          </ruby>
        ))}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-cream-50 flex flex-col">
      {/* Header */}
      <header className="bg-indigo-900 text-white py-3 sticky top-0 z-10">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/align')}
                className="flex items-center gap-2 hover:text-indigo-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                返回
              </button>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                <span className="font-semibold">{jpChapter?.title || '阅读'}</span>
              </div>
            </div>

            {/* Chapter Navigation */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (currentChapterIndex > 0) {
                    setCurrentChapter(currentChapterIndex - 1);
                    setCurrentParagraphIndex(0);
                    reset();
                  }
                }}
                disabled={currentChapterIndex === 0}
                className="p-2 hover:bg-indigo-800 rounded-lg disabled:opacity-50"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="text-sm">
                第 {currentChapterIndex + 1} / {jpBook.chapters.length} 章
              </span>
              <button
                onClick={() => {
                  if (currentChapterIndex < jpBook.chapters.length - 1) {
                    setCurrentChapter(currentChapterIndex + 1);
                    setCurrentParagraphIndex(0);
                    reset();
                  }
                }}
                disabled={currentChapterIndex >= jpBook.chapters.length - 1}
                className="p-2 hover:bg-indigo-800 rounded-lg disabled:opacity-50"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Furigana Toggle */}
            <button
              onClick={() => setShowFurigana(!showFurigana)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-800 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {showFurigana ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              <span className="text-sm">{showFurigana ? '隐藏注音' : '显示注音'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Split View */}
      <main className="flex-1 container mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
          {/* Japanese Typing Area */}
          <div
            ref={typingRef}
            tabIndex={0}
            className="bg-white rounded-xl shadow-lg p-8 overflow-hidden focus:outline-none focus:ring-2 focus:ring-sakura-400"
          >
            <div className="h-full flex flex-col">
              <h2 className="text-lg font-semibold text-indigo-900 mb-4 font-noto-serif">
                {jpChapter?.title || '日语原文'}
              </h2>

              <div className="flex-1 overflow-y-auto">
                {/* Typed Text */}
                <p className="text-xl leading-relaxed font-noto-sans text-ink-900">
                  {typedText}
                </p>

                {/* Current Character with Input */}
                {remainingText && (
                  <span className="relative inline-block">
                    <span className="text-xl font-noto-sans text-indigo-900 border-b-2 border-sakura-400">
                      {remainingText[0]}
                    </span>
                    {inputBuffer && (
                      <span className="absolute -bottom-5 left-0 text-xs text-sakura-400 font-mono">
                        {inputBuffer}
                      </span>
                    )}
                  </span>
                )}

                {/* Remaining Text */}
                <p className="text-xl leading-relaxed font-noto-sans text-ink-900 inline">
                  {remainingText.slice(1)}
                </p>
              </div>

              {/* Furigana Display */}
              {showFurigana && currentJpParagraph && (
                <div className="mt-4 p-4 bg-cream-50 rounded-lg text-lg leading-relaxed font-noto-sans">
                  {renderFuriganaText(currentJpParagraph)}
                </div>
              )}

              {/* Input Hint */}
              <div className="mt-4 text-center text-sm text-ink-700">
                {!isActive ? '开始输入罗马音以开始阅读...' : '继续输入以完成阅读'}
              </div>
            </div>
          </div>

          {/* Chinese Translation Area */}
          <div
            ref={zhRef}
            className="bg-white rounded-xl shadow-lg p-8 overflow-hidden"
          >
            <h2 className="text-lg font-semibold text-sakura-400 mb-4">
              {zhChapter?.title || '中文译文'}
            </h2>

            <div className="h-full overflow-y-auto">
              <p className="text-lg leading-relaxed text-ink-900">
                {currentZhParagraph || (
                  <span className="text-gray-400 italic">此段落暂无中文翻译，可继续练习打字</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Stats Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 sticky bottom-0">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-900">{calculateWPM()}</div>
              <div className="text-xs text-ink-700">WPM</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-900">{calculateAccuracy()}%</div>
              <div className="text-xs text-ink-700">正确率</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-500">{errors}</div>
              <div className="text-xs text-ink-700">错误</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-900">
                {currentParagraphIndex + 1}/{jpParagraphs.length}
              </div>
              <div className="text-xs text-ink-700">段落</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
