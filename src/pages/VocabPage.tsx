import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Download, Star, StarOff, Search } from 'lucide-react';
import { useVocabStore } from '@/stores/vocabStore';
import { isKanji } from '@/utils/furigana';

export default function VocabPage() {
  const navigate = useNavigate();
  const { wrongWords, bookmarkedWords, removeWrongWord, toggleBookmark, exportToCSV, clearAll } =
    useVocabStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'count' | 'recent'>('count');

  // 过滤和排序
  const filteredWords = wrongWords
    .filter((word) => {
      if (!searchQuery) return true;
      return (
        word.word.includes(searchQuery) ||
        word.reading.includes(searchQuery) ||
        word.reading.includes(searchQuery)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'count') {
        return b.wrongCount - a.wrongCount;
      }
      return b.lastWrongAt - a.lastWrongAt;
    });

  const handleExport = useCallback(() => {
    const csv = exportToCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jp-typing-vocab-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [exportToCSV]);

  const handleClearAll = useCallback(() => {
    if (confirm('确定要清空所有生词记录吗？此操作不可撤销。')) {
      clearAll();
    }
  }, [clearAll]);

  return (
    <div className="min-h-screen bg-cream-50">
      {/* Header */}
      <header className="bg-indigo-900 text-white py-6 sticky top-0 z-10">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/read')}
                className="flex items-center gap-2 hover:text-indigo-200 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                返回阅读
              </button>
              <div>
                <h1 className="text-xl font-bold">生词本</h1>
                <p className="text-sm text-indigo-200">
                  共 {wrongWords.length} 个生词
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleExport}
                disabled={wrongWords.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-800 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <Download className="w-5 h-5" />
                导出 CSV
              </button>
              <button
                onClick={handleClearAll}
                disabled={wrongWords.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                清空
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Search and Filter */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索单词或读音..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('count')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                sortBy === 'count'
                  ? 'bg-indigo-900 text-white'
                  : 'bg-white text-ink-700 hover:bg-gray-100'
              }`}
            >
              按错误次数
            </button>
            <button
              onClick={() => setSortBy('recent')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                sortBy === 'recent'
                  ? 'bg-indigo-900 text-white'
                  : 'bg-white text-ink-700 hover:bg-gray-100'
              }`}
            >
              按最近
            </button>
          </div>
        </div>

        {/* Stats */}
        {wrongWords.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-2xl font-bold text-indigo-900">{wrongWords.length}</div>
              <div className="text-sm text-ink-700">总单词数</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-2xl font-bold text-sakura-400">
                {wrongWords.reduce((sum, w) => sum + w.wrongCount, 0)}
              </div>
              <div className="text-sm text-ink-700">总错误次数</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-2xl font-bold text-green-500">{bookmarkedWords.length}</div>
              <div className="text-sm text-ink-700">已收藏</div>
            </div>
          </div>
        )}

        {/* Word List */}
        {filteredWords.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-ink-700 text-lg mb-4">
              {searchQuery ? '没有找到匹配的单词' : '暂无生词记录'}
            </p>
            <p className="text-sm text-ink-700">
              {searchQuery
                ? '尝试使用不同的关键词搜索'
                : '在阅读过程中输入错误的单词会被自动收录到这里'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWords.map((word) => {
              const isBookmarked = bookmarkedWords.includes(word.id);

              return (
                <div
                  key={word.id}
                  className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-bold text-indigo-900">
                          {word.word}
                        </span>
                        {isKanji(word.word) && (
                          <span className="text-lg text-sakura-400">
                            【{word.reading}】
                          </span>
                        )}
                        <span className="text-sm text-ink-700">{word.reading}</span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-ink-700">
                        <span className="px-2 py-1 bg-red-100 text-red-600 rounded">
                          错误 {word.wrongCount} 次
                        </span>
                        <span>
                          最后错误:{' '}
                          {new Date(word.lastWrongAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleBookmark(word.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {isBookmarked ? (
                          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                        ) : (
                          <StarOff className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => removeWrongWord(word.id)}
                        className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
