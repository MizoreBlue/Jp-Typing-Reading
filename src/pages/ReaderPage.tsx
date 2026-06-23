import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, BookOpen, BookMarked } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useTypingStore } from '@/stores/typingStore';
import { useVocabStore } from '@/stores/vocabStore';
import { splitToParagraphs } from '@/utils/epub';
import { addFurigana, isKanji } from '@/utils/furigana';
import { romajiToHiraganaConvert, isValidRomaji, toRomaji } from '@/utils/romaji';

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
    remainingText,
    currentCharIndex,
    isCorrect,
    errors,
    startTime,
    startTyping,
    processInput,
    backspace,
    reset,
  } = useTypingStore();

  const { addWrongWord } = useVocabStore();

  const [showFurigana, setShowFurigana] = useState(true);
  const [currentParagraphIndex, setCurrentParagraphIndex] = useState(0);
  // 罗马音输入缓冲，用于累积转换
  const [romajiBuffer, setRomajiBuffer] = useState('');

  const typingRef = useRef<HTMLDivElement>(null);
  const zhRef = useRef<HTMLDivElement>(null);
  // 用于跟踪段落完成后的 timeout，避免切换时触发旧的
  const nextParagraphTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 获取当前章节内容（useMemo 缓存，避免每次渲染都重算）
  const jpChapter = jpBook?.chapters[currentChapterIndex];
  const zhChapter = zhBook?.chapters[currentChapterIndex];

  // Bug 8 修复: 用 useMemo 缓存段落列表，splitToParagraphs 是计算密集型函数
  const jpParagraphs = useMemo(
    () => splitToParagraphs(jpChapter?.content || ''),
    [jpChapter?.content]
  );
  const zhParagraphs = useMemo(
    () => splitToParagraphs(zhChapter?.content || ''),
    [zhChapter?.content]
  );

  // 根据对齐结果建立映射（支持多对多对齐）
  const alignmentMap = useMemo(() => {
    const map = new Map<number, number[]>();
    alignments.forEach((a) => {
      if (!map.has(a.jpIndex)) map.set(a.jpIndex, []);
      if (!map.get(a.jpIndex)!.includes(a.zhIndex)) {
        map.get(a.jpIndex)!.push(a.zhIndex);
      }
    });
    return map;
  }, [alignments]);

  // 当前日文段落
  const currentJpParagraph = jpParagraphs[currentParagraphIndex] || '';

  // 对当前日语段落进行分词并生成注音信息
  const currentJpTokens = useMemo(() => {
    if (!currentJpParagraph) return [];
    return addFurigana(currentJpParagraph);
  }, [currentJpParagraph]);

  // 生成目标平假名和标点的序列（跳过无读音的未知汉字，避免打字卡死）
  const currentJpTargetReading = useMemo(() => {
    return currentJpTokens
      .map((t) => {
        if (t.furigana) return t.furigana;
        // 未知汉字（无读音）不纳入打字目标，用户无需输入
        if (isKanji(t.kanji)) return '';
        return t.kanji;
      })
      .join('');
  }, [currentJpTokens]);

  // 建立 Token 的读音区间与罗马音
  const currentTokensWithIndices = useMemo(() => {
    let currentPos = 0;
    return currentJpTokens.map((token) => {
      // 与 currentJpTargetReading 保持一致：未知汉字读音为空，不占打字区间
      let reading: string;
      if (token.furigana) {
        reading = token.furigana;
      } else if (isKanji(token.kanji)) {
        reading = '';
      } else {
        reading = token.kanji;
      }
      const start = currentPos;
      const end = currentPos + reading.length;
      currentPos = end;
      
      const isKana = /[\u3040-\u309f\u30a0-\u30ff]/.test(reading);
      const romaji = isKana ? toRomaji(reading) : reading;

      return {
        ...token,
        reading,
        start,
        end,
        romaji,
      };
    });
  }, [currentJpTokens]);

  // 获取对应的多重中文段落
  const currentZhParagraphs = useMemo(() => {
    const zhIndices = alignmentMap.get(currentParagraphIndex);
    if (!zhIndices) return [];
    return zhIndices.map(idx => zhParagraphs[idx] || '').filter(Boolean);
  }, [alignmentMap, currentParagraphIndex, zhParagraphs]);

  // 计算 WPM（以字符数/分钟计）
  const calculateWPM = useCallback(() => {
    if (!startTime || currentCharIndex === 0) return 0;
    const minutes = (Date.now() - startTime) / 60000;
    return Math.round(currentCharIndex / minutes);
  }, [startTime, currentCharIndex]);

  // 计算正确率（正确字符数 / 总输入次数）
  const calculateAccuracy = useCallback(() => {
    const total = currentCharIndex + errors;
    if (total === 0) return 100;
    return Math.round((currentCharIndex / total) * 100);
  }, [currentCharIndex, errors]);

  // 切换到下一段落
  const goToNextParagraph = useCallback(() => {
    if (nextParagraphTimer.current) {
      clearTimeout(nextParagraphTimer.current);
      nextParagraphTimer.current = null;
    }

    if (currentParagraphIndex < jpParagraphs.length - 1) {
      // Bug 5 修复: 保存当前段落索引（而不是 0）
      setProgress(jpChapter?.id || '', currentParagraphIndex + 1);
      setCurrentParagraphIndex((prev) => prev + 1);
      setRomajiBuffer('');
      reset();
    } else if (currentChapterIndex < (jpBook?.chapters.length || 0) - 1) {
      // 进入下一章
      setProgress(jpChapter?.id || '', 0);
      setCurrentChapter(currentChapterIndex + 1);
      setCurrentParagraphIndex(0);
      setRomajiBuffer('');
      reset();
    }
  }, [
    currentParagraphIndex,
    jpParagraphs.length,
    currentChapterIndex,
    jpChapter?.id,
    jpBook,
    setCurrentChapter,
    setProgress,
    reset,
  ]);

  // 处理键盘输入 —— Bug 1 核心修复：罗马音缓冲→假名→与 remainingText 比对
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 忽略修饰键组合
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        // 优先清空罗马音缓冲，再回退已输入字符
        if (romajiBuffer.length > 0) {
          setRomajiBuffer(romajiBuffer.slice(0, -1));
        } else {
          backspace();
        }
        return;
      }

      // 如果是非日文字符，且用户输入了相同的字符（标点、英文、数字等）
      if (remainingText.length > 0) {
        const nextChar = remainingText[0];
        const isKana = /[\u3040-\u309f\u30a0-\u30ff]/.test(nextChar);
        if (!isKana && e.key === nextChar) {
          e.preventDefault();
          // 清空可能残留的罗马音缓冲，避免状态错乱
          if (romajiBuffer) setRomajiBuffer('');
          const result = processInput(nextChar);
          if (result.isComplete) {
            nextParagraphTimer.current = setTimeout(goToNextParagraph, 500);
          }
          return;
        }
      }

      if (e.key === ' ' || e.key === '　') {
        e.preventDefault();
        if (remainingText.length > 0) {
          const nextChar = remainingText[0];
          const isKana = /[\u3040-\u309f\u30a0-\u30ff]/.test(nextChar);
          if (!isKana) {
            // 非日文字符（标点、空格、数字等）直接匹配确认
            if (romajiBuffer) setRomajiBuffer('');
            const result = processInput(nextChar);
            if (result.isComplete) {
              nextParagraphTimer.current = setTimeout(goToNextParagraph, 500);
            }
          }
        }
        return;
      }

      // 普通单字符罗马音输入
      if (e.key.length === 1 && isValidRomaji(e.key)) {
        e.preventDefault();

        const newBuffer = romajiBuffer + e.key.toLowerCase();

        // 将累积的罗马音转换为假名
        const converted = romajiToHiraganaConvert(newBuffer);

        // 获取当前期待的下一个字符
        const effectiveRemaining = isActive ? remainingText : currentJpTargetReading;

        // 段落已无剩余字符时，忽略后续输入，避免误记错误
        if (effectiveRemaining.length === 0) {
          setRomajiBuffer('');
          return;
        }

        if (converted === newBuffer) {
          // 罗马音尚未完整转换（如只输入了 'k'、'sh'），继续缓冲等待更多输入
          setRomajiBuffer(newBuffer);
          if (!isActive) {
            startTyping(currentJpTargetReading);
          }
          return;
        }

        // 若打字尚未开始，先初始化
        if (!isActive) {
          startTyping(currentJpTargetReading);
        }

        // 如果转换结果的第一个字符与期待字符匹配
        if (converted.length > 0 && converted[0] === effectiveRemaining[0]) {
          let allSuccess = true;
          let isComplete = false;
          for (const ch of converted) {
            const result = processInput(ch);
            if (!result.success) {
              allSuccess = false;
              break;
            }
            if (result.isComplete) {
              isComplete = true;
              break;
            }
          }

          if (allSuccess) {
            setRomajiBuffer('');
            if (isComplete) {
              nextParagraphTimer.current = setTimeout(goToNextParagraph, 500);
            }
          } else {
            // 转换后仍不匹配，记录错词
            const currentWord = effectiveRemaining.slice(0, 3);
            if (currentWord) {
              const activeToken = currentTokensWithIndices.find(t => t.end > currentCharIndex);
              addWrongWord(activeToken?.kanji || currentWord, activeToken?.reading || currentWord);
            }
            setRomajiBuffer('');
          }
        } else {
          // 转换后与期待字符不匹配，记为错误
          processInput(converted[0] || newBuffer[0]);
          const currentWord = effectiveRemaining.slice(0, 3);
          if (currentWord) {
            const activeToken = currentTokensWithIndices.find(t => t.end > currentCharIndex);
            addWrongWord(activeToken?.kanji || currentWord, activeToken?.reading || currentWord);
          }
          setRomajiBuffer('');
        }
      }
    },
    [
      isActive,
      romajiBuffer,
      remainingText,
      currentJpTargetReading,
      currentTokensWithIndices,
      currentCharIndex,
      startTyping,
      processInput,
      backspace,
      goToNextParagraph,
      addWrongWord,
    ]
  );

  // 监听键盘事件
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 段落/章节切换时清理状态
  useEffect(() => {
    setRomajiBuffer('');
    reset();
    // 清理旧的 timer
    if (nextParagraphTimer.current) {
      clearTimeout(nextParagraphTimer.current);
      nextParagraphTimer.current = null;
    }
  }, [currentParagraphIndex, currentChapterIndex, reset]);

  // 当前段落无可打字内容（如全部为未知汉字）时，自动跳到下一段
  useEffect(() => {
    if (currentJpParagraph && currentJpTargetReading.length === 0) {
      const timer = setTimeout(goToNextParagraph, 300);
      return () => clearTimeout(timer);
    }
  }, [currentJpTargetReading, currentJpParagraph, goToNextParagraph]);

  // 滚动同步（中文区随日文进度滚动）
  useEffect(() => {
    if (zhRef.current) {
      zhRef.current.scrollTop = currentParagraphIndex * 100;
    }
  }, [currentParagraphIndex]);

  // 聚焦输入区域
  useEffect(() => {
    typingRef.current?.focus();
  }, []);

  // Bug 4 修复: 只需要 jpBook，无 zhBook 时允许进入（中文区显示占位）
  if (!jpBook) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-700 mb-4">请先导入日语书籍</p>
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
              <rt className="text-xs text-sakura-400 font-normal">
                {token.furigana}
              </rt>
            )}
          </ruby>
        ))}
      </span>
    );
  };

  // 渲染打字区：汉字上方假名，下方罗马音拼写指引（词对齐）
  const renderTypingArea = () => {
    const activeTokenIdx = currentTokensWithIndices.findIndex((t) => t.end > currentCharIndex);

    return (
      <div className="flex flex-wrap gap-x-4 gap-y-6 text-2xl leading-loose font-noto-sans select-none justify-start items-end">
        {currentTokensWithIndices.map((token, tokenIdx) => {
          const isCompleted = tokenIdx < activeTokenIdx || activeTokenIdx === -1;
          const isActiveToken = tokenIdx === activeTokenIdx;
          const isNotStarted = tokenIdx > activeTokenIdx;

          let surfaceElement: React.ReactNode;
          let furiganaElement: React.ReactNode;
          let romajiElement: React.ReactNode;

          if (isCompleted) {
            surfaceElement = <span className="text-green-600 font-medium">{token.kanji}</span>;
            if (token.furigana) {
              furiganaElement = <span className="text-green-500 text-xs font-normal">{token.furigana}</span>;
            }
            romajiElement = <span className="text-green-400 text-xs font-mono">{token.romaji}</span>;
          } else if (isNotStarted) {
            surfaceElement = <span className="text-ink-900 opacity-40">{token.kanji}</span>;
            if (token.furigana) {
              furiganaElement = <span className="text-ink-700 opacity-30 text-xs font-normal">{token.furigana}</span>;
            }
            romajiElement = <span className="text-ink-700 opacity-20 text-xs font-mono">{token.romaji}</span>;
          } else {
            const typedInToken = currentCharIndex - token.start;

            // 1. 假名（Furigana）
            if (token.furigana) {
              const typedFurigana = token.furigana.slice(0, typedInToken);
              const activeFurigana = token.furigana[typedInToken];
              const remainingFurigana = token.furigana.slice(typedInToken + 1);

              furiganaElement = (
                <span className="text-xs font-normal">
                  <span className="text-green-500 font-medium">{typedFurigana}</span>
                  {activeFurigana && (
                    <span className={`border-b-2 font-semibold ${isCorrect ? 'text-indigo-900 border-sakura-400 animate-pulse' : 'text-red-500 border-red-400'}`}>
                      {activeFurigana}
                    </span>
                  )}
                  <span className="text-ink-700 opacity-40">{remainingFurigana}</span>
                </span>
              );
            }

            // 2. 汉字面层
            if (token.kanji.length === token.reading.length) {
              const typedKanji = token.kanji.slice(0, typedInToken);
              const activeKanji = token.kanji[typedInToken];
              const remainingKanji = token.kanji.slice(typedInToken + 1);

              surfaceElement = (
                <span>
                  <span className="text-green-600 font-medium">{typedKanji}</span>
                  {activeKanji && (
                    <span className={`border-b-2 font-bold ${isCorrect ? 'text-indigo-900 border-indigo-400' : 'text-red-500 border-red-400'}`}>
                      {activeKanji}
                    </span>
                  )}
                  <span className="text-ink-900 opacity-40">{remainingKanji}</span>
                </span>
              );
            } else {
              const ratio = typedInToken / token.reading.length;
              const kanjiCompletedCount = Math.floor(ratio * token.kanji.length);
              
              const typedKanji = token.kanji.slice(0, kanjiCompletedCount);
              const remainingKanji = token.kanji.slice(kanjiCompletedCount);

              surfaceElement = (
                <span className="border-b border-dashed border-indigo-300">
                  <span className="text-green-600 font-medium">{typedKanji}</span>
                  <span className={`font-bold ${isCorrect ? 'text-indigo-900' : 'text-red-500'}`}>{remainingKanji}</span>
                </span>
              );
            }

            // 3. 罗马音拼写指引（Hepburn 规范）
            const typedReadingPart = token.reading.slice(0, typedInToken);
            const typedRomajiPart = toRomaji(typedReadingPart);
            
            const wordRomaji = token.romaji;
            const bufferRomaji = romajiBuffer;
            
            const matchedRomajiLength = typedRomajiPart.length;
            const bufferLength = bufferRomaji.length;
            
            const greenRomaji = wordRomaji.slice(0, matchedRomajiLength);
            const activeRomaji = wordRomaji.slice(matchedRomajiLength, matchedRomajiLength + bufferLength);
            const remainingRomaji = wordRomaji.slice(matchedRomajiLength + bufferLength);

            romajiElement = (
              <span className="text-xs font-mono">
                <span className="text-green-500 font-medium">{greenRomaji}</span>
                {activeRomaji && (
                  <span className={`font-semibold px-0.5 rounded ${isCorrect ? 'text-indigo-900 bg-indigo-50 border-b border-indigo-400' : 'text-red-500 bg-red-50 border-b border-red-400'}`}>
                    {activeRomaji}
                  </span>
                )}
                {!activeRomaji && remainingRomaji.length > 0 ? (
                  <>
                    <span className="border-b border-indigo-300 text-indigo-900 font-semibold">{remainingRomaji[0]}</span>
                    <span className="text-ink-700 opacity-40">{remainingRomaji.slice(1)}</span>
                  </>
                ) : (
                  <span className="text-ink-700 opacity-40">{remainingRomaji}</span>
                )}
              </span>
            );
          }

          return (
            <div key={tokenIdx} className="flex flex-col items-center select-none shrink-0 min-h-[75px] justify-end">
              {showFurigana && token.furigana && (
                <div className="h-4 leading-none mb-1 text-center select-none">
                  {furiganaElement}
                </div>
              )}
              <div className="leading-none text-2xl mb-1 text-center">
                {surfaceElement}
              </div>
              {isActive && (isCompleted || isActiveToken) && token.romaji && (
                <div className="h-4 leading-none text-center select-none mt-0.5">
                  {romajiElement}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
                    setRomajiBuffer('');
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
                    setRomajiBuffer('');
                    reset();
                  }
                }}
                disabled={currentChapterIndex >= jpBook.chapters.length - 1}
                className="p-2 hover:bg-indigo-800 rounded-lg disabled:opacity-50"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {/* 生词本按钮 */}
              <button
                onClick={() => navigate('/vocab')}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-800 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <BookMarked className="w-5 h-5" />
                <span className="text-sm">生词本</span>
              </button>

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
        </div>
      </header>

      {/* Main Content - Split View */}
      <main className="flex-1 container mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
          {/* Japanese Typing Area */}
          <div
            ref={typingRef}
            tabIndex={0}
            className="bg-white rounded-xl shadow-lg p-8 overflow-hidden focus:outline-none focus:ring-2 focus:ring-sakura-400 flex flex-col"
          >
            <h2 className="text-lg font-semibold text-indigo-900 mb-4 font-noto-serif">
              {jpChapter?.title || '日语原文'}
            </h2>

            <div className="flex-1 overflow-y-auto">
              {/* 打字区域 */}
              <div className="mb-6 pb-6 min-h-[80px]">
                {renderTypingArea()}
              </div>

              {/* 注音参考（打字时显示在下方） */}
              {showFurigana && isActive && currentJpParagraph && (
                <div className="mt-2 p-4 bg-cream-50 rounded-lg text-lg leading-relaxed font-noto-sans border border-indigo-100">
                  <p className="text-xs text-ink-700 mb-2 font-sans">注音参考：</p>
                  {renderFuriganaText(currentJpParagraph)}
                </div>
              )}
            </div>

            {/* Input Hint */}
            <div className="mt-4 text-center text-sm text-ink-700 border-t border-gray-100 pt-4">
              {!isActive
                ? '开始输入罗马音以开始打字练习...'
                : romajiBuffer
                ? `正在输入: ${romajiBuffer}`
                : '继续输入以完成当前段落'}
            </div>
          </div>

          {/* Chinese Translation Area */}
          <div
            ref={zhRef}
            className="bg-white rounded-xl shadow-lg p-8 overflow-hidden flex flex-col"
          >
            <h2 className="text-lg font-semibold text-sakura-400 mb-4">
              {zhChapter?.title || '中文译文'}
            </h2>

            <div className="flex-1 overflow-y-auto pr-2">
              {currentZhParagraphs.length > 0 ? (
                <div className="space-y-4">
                  {currentZhParagraphs.map((para, idx) => (
                    <p key={idx} className="text-lg leading-relaxed text-ink-900 border-l-4 border-sakura-400/30 pl-3">
                      {para}
                    </p>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400 italic">
                  {zhBook ? '此段落暂无中文翻译，可继续练习打字' : '未导入中文译文，可继续练习日语打字'}
                </span>
              )}
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
