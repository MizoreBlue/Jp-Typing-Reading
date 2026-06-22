import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, Check, X, SkipForward, ChevronDown, ChevronUp, AlertCircle, Download, RotateCcw, BookOpen } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { TXTParagraphMatcher, downloadAsTXT, readTXTFileWithEncoding, exportAlignmentsToJSON, createBookFromTXT } from '@/utils/txt';
import type { AlignmentPair } from '@/types';

interface FileInfo {
  file: File | null;
  text: string;
  encoding: string;
  paragraphCount: number;
  charCount: number;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export default function TXTMatchPage() {
  const navigate = useNavigate();
  const { setJPBook, setZHBook, setAlignments: saveAlignments } = useBookStore();
  const jpInputRef = useRef<HTMLInputElement>(null);
  const zhInputRef = useRef<HTMLInputElement>(null);

  const [jpInfo, setJpInfo] = useState<FileInfo>({
    file: null,
    text: '',
    encoding: '',
    paragraphCount: 0,
    charCount: 0,
  });
  const [zhInfo, setZhInfo] = useState<FileInfo>({
    file: null,
    text: '',
    encoding: '',
    paragraphCount: 0,
    charCount: 0,
  });

  const [matcher, setMatcher] = useState<TXTParagraphMatcher | null>(null);
  const [alignments, setAlignments] = useState<AlignmentPair[]>([]);
  const [selectedJp, setSelectedJp] = useState<number | null>(null);
  const [selectedZh, setSelectedZh] = useState<number | null>(null);
  const [skippedJp, setSkippedJp] = useState<Set<number>>(new Set());
  const [skippedZh, setSkippedZh] = useState<Set<number>>(new Set());
  const [expandedJp, setExpandedJp] = useState<Set<number>>(new Set());
  const [expandedZh, setExpandedZh] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // 自动清除提示消息
  useEffect(() => {
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const showError = useCallback((message: string) => {
    console.error(message);
    setError(message);
    setSuccessMessage(null);
  }, []);

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setError(null);
  }, []);

  const validateTXTFile = useCallback((file: File): string | null => {
    const fileName = file.name || '';
    const isValidName = fileName.toLowerCase().endsWith('.txt');
    const isValidMime = file.type === 'text/plain' || file.type === '' || file.type.startsWith('text/');

    if (!isValidName && !isValidMime) {
      return `不支持的文件类型："${fileName}" (${file.type || '未知 MIME'})。请上传 .txt 文件。`;
    }

    if (file.size > MAX_FILE_SIZE) {
      return `文件 "${fileName}" 过大：${(file.size / 1024 / 1024).toFixed(2)}MB，最大支持 ${MAX_FILE_SIZE / 1024 / 1024}MB。`;
    }

    if (file.size === 0) {
      return `文件 "${fileName}" 为空。`;
    }

    return null;
  }, []);

  const countParagraphs = useCallback((text: string): number => {
    return text.split(/\n{2,}/).filter(p => p.trim().length > 0).length;
  }, []);

  const handleJpFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateTXTFile(file);
    if (validationError) {
      showError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { text, encoding } = await readTXTFileWithEncoding(file);
      setJpInfo({
        file,
        text,
        encoding,
        paragraphCount: countParagraphs(text),
        charCount: text.length,
      });
      showSuccess(`日语文件 "${file.name}" 读取成功，编码：${encoding}`);
    } catch (err) {
      showError(`读取日语文件 "${file.name}" 失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
      if (jpInputRef.current) jpInputRef.current.value = '';
    }
  }, [validateTXTFile, countParagraphs, showError, showSuccess]);

  const handleZhFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateTXTFile(file);
    if (validationError) {
      showError(validationError);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { text, encoding } = await readTXTFileWithEncoding(file);
      setZhInfo({
        file,
        text,
        encoding,
        paragraphCount: countParagraphs(text),
        charCount: text.length,
      });
      showSuccess(`中文文件 "${file.name}" 读取成功，编码：${encoding}`);
    } catch (err) {
      showError(`读取中文文件 "${file.name}" 失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
      if (zhInputRef.current) zhInputRef.current.value = '';
    }
  }, [validateTXTFile, countParagraphs, showError, showSuccess]);

  const handleAutoMatch = useCallback(async () => {
    if (!jpInfo.text || !zhInfo.text) {
      showError('请先上传日语和中文 TXT 文件');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 让 UI 有机会渲染 loading 状态，避免大文件匹配时界面无响应
      await new Promise((resolve) => setTimeout(resolve, 0));

      const newMatcher = new TXTParagraphMatcher(jpInfo.text, zhInfo.text);
      if (newMatcher.getJpParagraphCount() === 0 || newMatcher.getZhParagraphCount() === 0) {
        showError('未能从 TXT 文件中解析出有效段落，请检查文件内容');
        return;
      }

      const newAlignments = newMatcher.match();
      setMatcher(newMatcher);
      setAlignments(newAlignments);
      setSkippedJp(new Set());
      setSkippedZh(new Set());

      if (newAlignments.length === 0) {
        showSuccess('自动匹配完成：未找到高置信度匹配，请使用手动匹配');
      } else {
        showSuccess(
          `自动匹配完成：共 ${newAlignments.length} 对，准确率 ${newMatcher.getAccuracy().toFixed(1)}%`
        );
      }
    } catch (err) {
      showError(`匹配失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, [jpInfo.text, zhInfo.text, showError, showSuccess]);

  const accuracy = useMemo(() => {
    if (alignments.length === 0) return 0;
    const validAlignments = alignments.filter(a => a.score >= 50);
    return (validAlignments.length / alignments.length) * 100;
  }, [alignments]);

  const alignmentMap = useMemo(() => {
    const map = new Map<number, number>();
    alignments.forEach((a) => map.set(a.jpIndex, a.zhIndex));
    return map;
  }, [alignments]);

  const zhReverseMap = useMemo(() => {
    const map = new Map<number, number>();
    alignments.forEach((a) => map.set(a.zhIndex, a.jpIndex));
    return map;
  }, [alignments]);

  const jpParagraphs = useMemo(() => {
    if (!matcher) return [];
    return matcher.getJpParagraphs();
  }, [matcher]);

  const zhParagraphs = useMemo(() => {
    if (!matcher) return [];
    return matcher.getZhParagraphs();
  }, [matcher]);

  const handleJpClick = useCallback((index: number) => {
    if (skippedJp.has(index)) return;

    if (selectedZh !== null) {
      // 已选中中文，点击日文完成配对
      const nextAlignments = alignments.filter(
        (a) => a.jpIndex !== index && a.zhIndex !== selectedZh
      );
      setAlignments([...nextAlignments, { jpIndex: index, zhIndex: selectedZh, score: 100 }]);
      setSelectedJp(null);
      setSelectedZh(null);
    } else {
      setSelectedJp(index);
      setSelectedZh(null);
    }
  }, [skippedJp, selectedZh, alignments]);

  const handleZhClick = useCallback((index: number) => {
    if (skippedZh.has(index)) return;

    if (selectedJp !== null) {
      // 已选中日文，点击中文完成配对
      const nextAlignments = alignments.filter(
        (a) => a.jpIndex !== selectedJp && a.zhIndex !== index
      );
      setAlignments([...nextAlignments, { jpIndex: selectedJp, zhIndex: index, score: 100 }]);
      setSelectedJp(null);
      setSelectedZh(null);
    } else {
      setSelectedZh(index);
      setSelectedJp(null);
    }
  }, [skippedZh, selectedJp, alignments]);

  const handleRemoveAlignment = useCallback((jpIndex: number) => {
    setAlignments(alignments.filter((a) => a.jpIndex !== jpIndex));
  }, [alignments]);

  const handleSkipJp = useCallback((index: number) => {
    const newSkipped = new Set(skippedJp);
    if (newSkipped.has(index)) {
      newSkipped.delete(index);
    } else {
      newSkipped.add(index);
      setAlignments(alignments.filter((a) => a.jpIndex !== index));
    }
    setSkippedJp(newSkipped);
  }, [skippedJp, alignments]);

  const handleSkipZh = useCallback((index: number) => {
    const newSkipped = new Set(skippedZh);
    if (newSkipped.has(index)) {
      newSkipped.delete(index);
    } else {
      newSkipped.add(index);
      setAlignments(alignments.filter((a) => a.zhIndex !== index));
    }
    setSkippedZh(newSkipped);
  }, [skippedZh, alignments]);

  const handleToggleExpandJp = useCallback((index: number) => {
    setExpandedJp(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleToggleExpandZh = useCallback((index: number) => {
    setExpandedZh(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleReset = useCallback(() => {
    setAlignments([]);
    setSelectedJp(null);
    setSelectedZh(null);
    setSkippedJp(new Set());
    setSkippedZh(new Set());
    setExpandedJp(new Set());
    setExpandedZh(new Set());
  }, []);

  const handleExportAlignments = useCallback(() => {
    const json = exportAlignmentsToJSON(alignments);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'alignments.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSuccess('对齐结果已导出');
  }, [alignments, showSuccess]);

  const handleExportJpTXT = useCallback(() => {
    if (!jpInfo.text) return;
    const filename = jpInfo.file?.name.replace(/\.txt$/i, '') || 'japanese';
    downloadAsTXT(jpInfo.text, `${filename}_exported.txt`);
    showSuccess('日语 TXT 已导出');
  }, [jpInfo, showSuccess]);

  const handleExportZhTXT = useCallback(() => {
    if (!zhInfo.text) return;
    const filename = zhInfo.file?.name.replace(/\.txt$/i, '') || 'chinese';
    downloadAsTXT(zhInfo.text, `${filename}_exported.txt`);
    showSuccess('中文 TXT 已导出');
  }, [zhInfo, showSuccess]);

  const handleClearFile = useCallback((type: 'jp' | 'zh') => {
    if (type === 'jp') {
      setJpInfo({ file: null, text: '', encoding: '', paragraphCount: 0, charCount: 0 });
    } else {
      setZhInfo({ file: null, text: '', encoding: '', paragraphCount: 0, charCount: 0 });
    }
    setMatcher(null);
    setAlignments([]);
    setSkippedJp(new Set());
    setSkippedZh(new Set());
  }, []);

  const handleStartReading = useCallback(async () => {
    if (!jpInfo.text || !zhInfo.text) {
      showError('请先上传日语和中文 TXT 文件');
      return;
    }
    if (alignments.length === 0) {
      showError('请至少完成一对段落匹配后再开始阅读');
      return;
    }

    setLoading(true);
    try {
      const jpBook = createBookFromTXT(jpInfo.text, 'ja', jpInfo.file?.name);
      const zhBook = createBookFromTXT(zhInfo.text, 'zh', zhInfo.file?.name);
      await setJPBook(jpBook);
      await setZHBook(zhBook);
      await saveAlignments(alignments);
      navigate('/read');
    } catch (err) {
      showError(`开始阅读失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, [jpInfo, zhInfo, alignments, setJPBook, setZHBook, saveAlignments, navigate, showError]);

  const renderUploadCard = useCallback((
    type: 'jp' | 'zh',
    info: FileInfo,
    inputRef: React.RefObject<HTMLInputElement>,
    colorClass: string,
    borderColorClass: string
  ) => {
    const isJp = type === 'jp';
    const title = isJp ? '日语原文 (TXT)' : '中文译文 (TXT)';

    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className={`text-lg font-semibold mb-4 flex items-center gap-2 ${isJp ? 'text-indigo-900' : 'text-pink-600'}`}>
          <FileText className="w-5 h-5" />
          {title}
        </h2>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          onChange={isJp ? handleJpFileChange : handleZhFileChange}
          className="hidden"
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className={`w-full py-4 border-2 border-dashed rounded-lg transition-colors flex flex-col items-center gap-2 ${borderColorClass} hover:opacity-80 disabled:opacity-50`}
        >
          <Upload className={`w-8 h-8 ${isJp ? 'text-indigo-400' : 'text-pink-400'}`} />
          <span className={`${isJp ? 'text-indigo-600' : 'text-pink-600'} truncate max-w-full px-4`}>
            {info.file ? info.file.name : `点击上传${isJp ? '日语' : '中文'} TXT 文件`}
          </span>
        </button>

        {info.file && (
          <div className="mt-4 space-y-2">
            <div className="flex gap-2">
              <button
                onClick={isJp ? handleExportJpTXT : handleExportZhTXT}
                className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${colorClass}`}
              >
                <Download className="w-4 h-4" />
                导出 TXT
              </button>
              <button
                onClick={() => handleClearFile(type)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                清除
              </button>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              <p>文件大小: {(info.file.size / 1024).toFixed(2)} KB</p>
              <p>字符数: {info.charCount.toLocaleString()}</p>
              <p>预估段落数: {info.paragraphCount.toLocaleString()}</p>
              {info.encoding && <p>检测编码: {info.encoding.toUpperCase()}</p>}
            </div>
          </div>
        )}
      </div>
    );
  }, [loading, handleJpFileChange, handleZhFileChange, handleExportJpTXT, handleExportZhTXT, handleClearFile]);

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
              <h1 className="text-xl font-bold">TXT 段落匹配</h1>
              <p className="text-sm text-indigo-200">日语-中文 TXT 文件段落对齐</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportAlignments}
              disabled={alignments.length === 0}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              导出对齐
            </button>
            <button
              onClick={handleStartReading}
              disabled={alignments.length === 0 || loading}
              className="flex items-center gap-2 bg-sakura-400 text-indigo-900 px-6 py-2 rounded-lg font-semibold hover:bg-sakura-300 transition-colors disabled:opacity-50"
            >
              <BookOpen className="w-5 h-5" />
              保存并开始阅读
            </button>
            <button
              onClick={handleReset}
              disabled={!matcher}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              重置
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-6">
        {/* 消息提示 */}
        {error && (
          <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-6 flex items-center gap-3 animate-fadeIn">
            <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="bg-green-100 border border-green-300 rounded-lg p-4 mb-6 flex items-center gap-3 animate-fadeIn">
            <Check className="w-6 h-6 text-green-600 shrink-0" />
            <span className="text-green-700">{successMessage}</span>
          </div>
        )}

        {/* 文件上传区域 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {renderUploadCard('jp', jpInfo, jpInputRef, 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200', 'border-indigo-300')}
          {renderUploadCard('zh', zhInfo, zhInputRef, 'bg-pink-100 text-pink-700 hover:bg-pink-200', 'border-pink-300')}
        </div>

        {/* 匹配按钮 */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">段落匹配</h2>
              <p className="text-sm text-gray-500 mt-1">
                上传文件后点击「自动匹配」开始对齐段落
              </p>
            </div>
            <button
              onClick={handleAutoMatch}
              disabled={!jpInfo.text || !zhInfo.text || loading}
              className="flex items-center gap-2 bg-indigo-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-800 transition-colors disabled:opacity-50"
            >
              <RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              自动匹配
            </button>
          </div>

          {matcher && (
            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span className="text-indigo-700">
                日语段落: <strong>{matcher.getJpParagraphCount()}</strong> 个
              </span>
              <span className="text-pink-600">
                中文段落: <strong>{matcher.getZhParagraphCount()}</strong> 个
              </span>
              <span className="text-green-600">
                已匹配: <strong>{alignments.length}</strong> 对
              </span>
              <span className="text-gray-600">
                准确率: <strong>{accuracy.toFixed(1)}%</strong>
              </span>
              <span className="text-gray-600">
                跳过 JP: <strong>{skippedJp.size}</strong> | ZH: <strong>{skippedZh.size}</strong>
              </span>
            </div>
          )}
        </div>

        {/* 匹配结果 */}
        {matcher && (
          <>
            <div className="bg-indigo-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-indigo-900">
                <strong>操作说明：</strong>先点击一侧段落，再点击另一侧对应段落即可完成关联（顺序不限）。
                点击 <SkipForward className="inline w-4 h-4" /> 按钮可以跳过该段落。
                完成部分匹配后，即可点击「保存并开始阅读」进入打字练习。
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 pb-8">
              {/* 日语段落 */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-indigo-900 text-white px-4 py-3 font-semibold">
                  日语原文 ({jpParagraphs.length} 段落)
                </div>
                <div className="divide-y max-h-[50vh] overflow-y-auto">
                  {jpParagraphs.map((para, index) => {
                    const isAligned = alignmentMap.has(index);
                    const isSelected = selectedJp === index;
                    const isSkipped = skippedJp.has(index);
                    const isExpanded = expandedJp.has(index);
                    const zhMatch = alignmentMap.get(index);

                    return (
                      <div
                        key={index}
                        onClick={() => handleJpClick(index)}
                        className={`p-4 cursor-pointer transition-all ${
                          isSkipped
                            ? 'bg-gray-100 opacity-50'
                            : isSelected
                            ? 'bg-pink-100 border-l-4 border-pink-400'
                            : isAligned
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${isExpanded ? '' : 'line-clamp-3'}`}>{para}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {para.length > 100 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleExpandJp(index);
                                }}
                                className="text-gray-500 hover:text-gray-700 p-1"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            )}
                            {isAligned && (
                              <div className="flex items-center gap-1 text-green-600">
                                <Check className="w-4 h-4" />
                                <span className="text-xs">→ {zhMatch! + 1}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveAlignment(index);
                                  }}
                                  className="ml-1 text-red-500 hover:text-red-700 p-1"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSkipJp(index);
                              }}
                              className={`p-1 rounded ${
                                isSkipped ? 'bg-gray-300 text-gray-700' : 'hover:bg-gray-100 text-gray-500'
                              }`}
                              title={isSkipped ? '取消跳过' : '跳过此段落'}
                            >
                              <SkipForward className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 中文段落 */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="bg-pink-500 text-white px-4 py-3 font-semibold">
                  中文译文 ({zhParagraphs.length} 段落)
                </div>
                <div className="divide-y max-h-[50vh] overflow-y-auto">
                  {zhParagraphs.map((para, index) => {
                    const isMatched = zhReverseMap.has(index);
                    const isSelected = selectedZh === index;
                    const isSkipped = skippedZh.has(index);
                    const isExpanded = expandedZh.has(index);

                    return (
                      <div
                        key={index}
                        onClick={() => handleZhClick(index)}
                        className={`p-4 cursor-pointer transition-all ${
                          isSkipped
                            ? 'bg-gray-100 opacity-50'
                            : isSelected
                            ? 'bg-pink-100 border-l-4 border-pink-400'
                            : isMatched
                            ? 'bg-green-50 hover:bg-green-100'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded shrink-0">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${isExpanded ? '' : 'line-clamp-3'}`}>{para}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {para.length > 100 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleExpandZh(index);
                                }}
                                className="text-gray-500 hover:text-gray-700 p-1"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            )}
                            {isMatched && (
                              <Check className="w-4 h-4 text-green-600" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSkipZh(index);
                              }}
                              className={`p-1 rounded ${
                                isSkipped ? 'bg-gray-300 text-gray-700' : 'hover:bg-gray-100 text-gray-500'
                              }`}
                              title={isSkipped ? '取消跳过' : '跳过此段落'}
                            >
                              <SkipForward className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
