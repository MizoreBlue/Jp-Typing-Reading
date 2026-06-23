import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, GripVertical, Save, SkipForward, ChevronDown, ChevronUp, AlertCircle, RotateCcw } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { splitToParagraphs, getChapterPreview } from '@/utils/epub';
import { calculateAlignmentAccuracy, alignParagraphs } from '@/utils/aligner';
import type { AlignmentPair } from '@/types';

export default function AlignPage() {
  const navigate = useNavigate();
  const { jpBook, zhBook, alignments, skippedJp, skippedZh, currentChapterIndex, setCurrentChapter, setAlignments, setSkippedJp, setSkippedZh } = useBookStore();

  const [manualAlignments, setManualAlignments] = useState<AlignmentPair[]>(alignments);
  const [selectedJp, setSelectedJp] = useState<number | null>(null);
  const [selectedZh, setSelectedZh] = useState<number | null>(null);
  const [expandedJp, setExpandedJp] = useState<Set<number>>(new Set());
  const [expandedZh, setExpandedZh] = useState<Set<number>>(new Set());
  const [autoAligning, setAutoAligning] = useState(false);

  useEffect(() => {
    setManualAlignments(alignments);
  }, [alignments, currentChapterIndex]);

  const paragraphs = useMemo(() => {
    if (!jpBook || !zhBook) return { jp: [], zh: [] };

    const jpContent = jpBook.chapters[currentChapterIndex]?.content || '';
    const zhContent = zhBook.chapters[currentChapterIndex]?.content || '';

    const jpParagraphs = splitToParagraphs(jpContent);
    const zhParagraphs = splitToParagraphs(zhContent);

    console.log(`章节 ${currentChapterIndex}: 日语段落 ${jpParagraphs.length} 个, 中文段落 ${zhParagraphs.length} 个`);

    return { jp: jpParagraphs, zh: zhParagraphs };
  }, [jpBook, zhBook, currentChapterIndex]);

  const accuracy = useMemo(() => {
    return calculateAlignmentAccuracy(manualAlignments);
  }, [manualAlignments]);

  const alignmentMap = useMemo(() => {
    const map = new Map<number, number[]>();
    manualAlignments.forEach((a) => {
      if (!map.has(a.jpIndex)) map.set(a.jpIndex, []);
      if (!map.get(a.jpIndex)!.includes(a.zhIndex)) {
        map.get(a.jpIndex)!.push(a.zhIndex);
      }
    });
    return map;
  }, [manualAlignments]);

  const zhReverseMap = useMemo(() => {
    const map = new Map<number, number[]>();
    manualAlignments.forEach((a) => {
      if (!map.has(a.zhIndex)) map.set(a.zhIndex, []);
      if (!map.get(a.zhIndex)!.includes(a.jpIndex)) {
        map.get(a.zhIndex)!.push(a.jpIndex);
      }
    });
    return map;
  }, [manualAlignments]);

  const handleJpClick = useCallback((index: number) => {
    if (skippedJp.includes(index)) return;

    if (selectedZh !== null) {
      const exists = manualAlignments.some(a => a.jpIndex === index && a.zhIndex === selectedZh);
      if (exists) {
        setManualAlignments(manualAlignments.filter(a => !(a.jpIndex === index && a.zhIndex === selectedZh)));
      } else {
        setManualAlignments([...manualAlignments, { jpIndex: index, zhIndex: selectedZh, score: 100 }]);
      }
    } else {
      setSelectedJp(index === selectedJp ? null : index);
      setSelectedZh(null);
    }
  }, [skippedJp, selectedJp, selectedZh, manualAlignments]);

  const handleZhClick = useCallback((index: number) => {
    if (skippedZh.includes(index)) return;

    if (selectedJp !== null) {
      const exists = manualAlignments.some(a => a.jpIndex === selectedJp && a.zhIndex === index);
      if (exists) {
        setManualAlignments(manualAlignments.filter(a => !(a.jpIndex === selectedJp && a.zhIndex === index)));
      } else {
        setManualAlignments([...manualAlignments, { jpIndex: selectedJp, zhIndex: index, score: 100 }]);
      }
    } else {
      setSelectedZh(index === selectedZh ? null : index);
      setSelectedJp(null);
    }
  }, [skippedZh, selectedJp, selectedZh, manualAlignments]);

  const handleRemoveSpecificAlignment = useCallback((jpIndex: number, zhIndex: number) => {
    setManualAlignments(manualAlignments.filter((a) => !(a.jpIndex === jpIndex && a.zhIndex === zhIndex)));
  }, [manualAlignments]);

  const handleSkipJp = useCallback((index: number) => {
    const newSkipped = skippedJp.includes(index)
      ? skippedJp.filter(i => i !== index)
      : [...skippedJp, index];
    setSkippedJp(newSkipped);
    setManualAlignments(manualAlignments.filter((a) => a.jpIndex !== index));
  }, [skippedJp, manualAlignments, setSkippedJp]);

  const handleSkipZh = useCallback((index: number) => {
    const newSkipped = skippedZh.includes(index)
      ? skippedZh.filter(i => i !== index)
      : [...skippedZh, index];
    setSkippedZh(newSkipped);
    setManualAlignments(manualAlignments.filter((a) => a.zhIndex !== index));
  }, [skippedZh, manualAlignments, setSkippedZh]);

  const handleToggleExpandJp = useCallback((index: number) => {
    const newExpanded = new Set(expandedJp);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedJp(newExpanded);
  }, [expandedJp]);

  const handleToggleExpandZh = useCallback((index: number) => {
    const newExpanded = new Set(expandedZh);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedZh(newExpanded);
  }, [expandedZh]);

  const handleAutoAlign = useCallback(async () => {
    if (paragraphs.jp.length === 0 || paragraphs.zh.length === 0) return;

    setAutoAligning(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const autoAlignments = alignParagraphs(paragraphs.jp, paragraphs.zh);
      setManualAlignments(autoAlignments);
    } finally {
      setAutoAligning(false);
    }
  }, [paragraphs]);

  const handleReset = useCallback(() => {
    setManualAlignments([]);
    setSelectedJp(null);
    setSelectedZh(null);
    setExpandedJp(new Set());
    setExpandedZh(new Set());
  }, []);

  const handleSave = useCallback(async () => {
    await setAlignments(manualAlignments);
    navigate('/read');
  }, [manualAlignments, navigate, setAlignments]);

  const handleChapterChange = useCallback((newIndex: number) => {
    setCurrentChapter(newIndex);
    setManualAlignments([]);
    setSelectedJp(null);
    setSelectedZh(null);
    setExpandedJp(new Set());
    setExpandedZh(new Set());
  }, [setCurrentChapter]);

  if (!jpBook || !zhBook) {
    return (
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <p className="text-ink-700">请先导入书籍</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="bg-indigo-900 text-white py-4 sticky top-0 z-10">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:text-indigo-200 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              返回
            </button>
            <div>
              <h1 className="text-xl font-bold">段落对齐调整</h1>
              <p className="text-sm text-indigo-200">
                准确率: {accuracy.toFixed(1)}% | 已对齐: {manualAlignments.length}/{paragraphs.jp.length} | 
                跳过 JP: {skippedJp.length} | 跳过 ZH: {skippedZh.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => handleChapterChange(currentChapterIndex - 1)}
              disabled={currentChapterIndex === 0}
              className="p-2 hover:bg-indigo-800 rounded-lg disabled:opacity-50"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm">
              章节 {currentChapterIndex + 1} / {jpBook.chapters.length}
            </span>
            <button
              onClick={() => handleChapterChange(currentChapterIndex + 1)}
              disabled={currentChapterIndex >= jpBook.chapters.length - 1}
              className="p-2 hover:bg-indigo-800 rounded-lg disabled:opacity-50"
            >
              <ArrowLeft className="w-5 h-5 rotate-180" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoAlign}
              disabled={autoAligning || paragraphs.jp.length === 0 || paragraphs.zh.length === 0}
              className="flex items-center gap-2 bg-indigo-700 text-white px-4 py-2 rounded-lg hover:bg-indigo-600 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${autoAligning ? 'animate-spin' : ''}`} />
              自动对齐
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-sakura-400 text-indigo-900 px-6 py-2 rounded-lg font-semibold hover:bg-sakura-300 transition-colors"
            >
              <Save className="w-5 h-5" />
              保存并开始阅读
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-4">
        <div className="bg-indigo-100 rounded-lg p-4 text-sm text-indigo-900 shadow-sm border border-indigo-200">
          <p className="font-semibold text-base">💡 双语对齐与多对多关联引导说明：</p>
          <ul className="list-disc list-inside mt-2 space-y-1.5 text-sm">
            <li><strong>单对单关联：</strong>选中一侧的段落（高亮为粉色），点击另一侧对应的段落即可。</li>
            <li><strong>一对多 / 多对多关联：</strong>在选中某段落（例如左侧日语段落 5）后，可以<strong>连续点击右侧多个中文段落</strong>，它们都会被绑定至该日语段落！选中一个中文段落绑定多个日语段落亦然。</li>
            <li><strong>取消选择：</strong>再次点击已选中的高亮段落即可取消其选中状态。</li>
            <li><strong>精确解除绑定：</strong>每个已关联的标签右侧均有 <X className="inline w-3 h-3" /> 按钮，点击即可直接删除该特定对准关系。</li>
            <li><strong>过滤占位行：</strong>如果看到章节标题或空白，点击 <SkipForward className="inline w-4 h-4" /> 按钮可以跳过，被跳过的段落将不再参与对齐。</li>
            <li><strong>内容展开：</strong>如果文本较长，可点击 <ChevronDown className="inline w-4 h-4" /> 展开完整段落内容。</li>
          </ul>
        </div>
      </div>

      {paragraphs.jp.length === 0 && (
        <div className="container mx-auto px-6 py-4">
          <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600" />
            <div>
              <p className="font-semibold text-yellow-800">警告：日语段落数为零</p>
              <p className="text-sm text-yellow-700">可能是 EPUB 文件解析问题，请检查文件格式或尝试其他 EPUB 文件</p>
              <p className="text-sm text-yellow-700 mt-1">章节内容预览: {getChapterPreview(jpBook.chapters[currentChapterIndex]?.content || '', 200)}</p>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-6 pb-8">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-indigo-900 text-white px-4 py-3 font-semibold flex items-center justify-between">
              <span>日语原文 ({paragraphs.jp.length} 段落)</span>
              <span className="text-xs opacity-75">
                章节: {jpBook.chapters[currentChapterIndex]?.title || '未知'}
              </span>
            </div>
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {paragraphs.jp.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>未解析到段落内容</p>
                  <p className="text-sm mt-2">章节预览: {getChapterPreview(jpBook.chapters[currentChapterIndex]?.content || '')}</p>
                </div>
              ) : (
                paragraphs.jp.map((para, index) => {
                  const isAligned = alignmentMap.has(index);
                  const isSelected = selectedJp === index;
                  const isSkipped = skippedJp.includes(index);
                  const isExpanded = expandedJp.has(index);

                  return (
                    <div
                      key={index}
                      onClick={() => handleJpClick(index)}
                      className={`p-4 cursor-pointer transition-all ${
                        isSkipped
                          ? 'bg-gray-100 opacity-50'
                          : isSelected
                          ? 'bg-sakura-400/30 border-l-4 border-sakura-400'
                          : isAligned
                          ? 'bg-green-50 hover:bg-green-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-ink-700 bg-gray-100 px-2 py-1 rounded shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isExpanded ? '' : 'line-clamp-3'}`}>
                            {para}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isExpanded ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpandJp(index);
                              }}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                          ) : para.length > 100 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpandJp(index);
                              }}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          ) : null}
                          {isAligned && (
                            <div className="flex flex-wrap items-center gap-1.5 text-green-600">
                              <Check className="w-4 h-4 shrink-0" />
                              {alignmentMap.get(index)?.map((zhIdx) => (
                                <span
                                  key={zhIdx}
                                  className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-0.5 rounded text-xs shrink-0 font-sans"
                                >
                                  → {zhIdx + 1}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveSpecificAlignment(index, zhIdx);
                                    }}
                                    className="ml-1 text-red-500 hover:text-red-700 font-bold"
                                    title="解除此关联"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSkipJp(index);
                            }}
                            className={`p-1 rounded ${
                              isSkipped
                                ? 'bg-gray-300 text-gray-700'
                                : 'hover:bg-gray-100 text-gray-500'
                            }`}
                            title={isSkipped ? '取消跳过' : '跳过此段落'}
                          >
                            <SkipForward className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="bg-sakura-400 text-indigo-900 px-4 py-3 font-semibold flex items-center justify-between">
              <span>中文译文 ({paragraphs.zh.length} 段落)</span>
              <span className="text-xs opacity-75">
                章节: {zhBook.chapters[currentChapterIndex]?.title || '未知'}
              </span>
            </div>
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {paragraphs.zh.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p>未解析到段落内容</p>
                  <p className="text-sm mt-2">章节预览: {getChapterPreview(zhBook.chapters[currentChapterIndex]?.content || '')}</p>
                </div>
              ) : (
                paragraphs.zh.map((para, index) => {
                  const isMatched = zhReverseMap.has(index);
                  const isSelected = selectedZh === index;
                  const isSkipped = skippedZh.includes(index);
                  const isExpanded = expandedZh.has(index);

                  return (
                    <div
                      key={index}
                      onClick={() => handleZhClick(index)}
                      className={`p-4 cursor-pointer transition-all ${
                        isSkipped
                          ? 'bg-gray-100 opacity-50'
                          : isSelected
                          ? 'bg-sakura-400/30 border-l-4 border-sakura-400'
                          : isMatched
                          ? 'bg-green-50 hover:bg-green-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-ink-700 bg-gray-100 px-2 py-1 rounded shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isExpanded ? '' : 'line-clamp-3'}`}>
                            {para}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isExpanded ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpandZh(index);
                              }}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                          ) : para.length > 100 ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleExpandZh(index);
                              }}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          ) : null}
                          {isMatched && (
                            <div className="flex flex-wrap items-center gap-1.5 text-indigo-600">
                              <GripVertical className="w-4 h-4 shrink-0" />
                              {zhReverseMap.get(index)?.map((jpIdx) => (
                                <span
                                  key={jpIdx}
                                  className="inline-flex items-center gap-1 bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-xs shrink-0 font-sans"
                                >
                                  ← {jpIdx + 1}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveSpecificAlignment(jpIdx, index);
                                    }}
                                    className="ml-1 text-red-500 hover:text-red-700 font-bold"
                                    title="解除此关联"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSkipZh(index);
                            }}
                            className={`p-1 rounded ${
                              isSkipped
                                ? 'bg-gray-300 text-gray-700'
                                : 'hover:bg-gray-100 text-gray-500'
                            }`}
                            title={isSkipped ? '取消跳过' : '跳过此段落'}
                          >
                            <SkipForward className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
