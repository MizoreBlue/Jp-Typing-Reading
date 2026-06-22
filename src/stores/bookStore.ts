import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EPUBBook, AlignmentPair } from '@/types';
import { saveBook, saveAlignments, getBook } from '@/utils/database';

interface BookState {
  jpBook: EPUBBook | null;
  zhBook: EPUBBook | null;
  alignments: AlignmentPair[];
  skippedJp: number[];
  skippedZh: number[];
  currentChapterIndex: number;
  isLoading: boolean;
  error: string | null;

  progress: Record<string, number>;

  setJPBook: (book: EPUBBook | null) => Promise<void>;
  setZHBook: (book: EPUBBook | null) => Promise<void>;
  loadBook: (id: string, type: 'jp' | 'zh') => Promise<void>;
  setAlignments: (alignments: AlignmentPair[]) => Promise<void>;
  updateAlignment: (jpIndex: number, zhIndex: number) => void;
  setSkippedJp: (indices: number[]) => void;
  setSkippedZh: (indices: number[]) => void;
  toggleSkipJp: (index: number) => void;
  toggleSkipZh: (index: number) => void;
  setCurrentChapter: (index: number) => void;
  setProgress: (chapterId: string, charIndex: number) => void;
  getProgress: (chapterId: string) => number;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useBookStore = create<BookState>()(
  persist(
    (set, get) => ({
      jpBook: null,
      zhBook: null,
      alignments: [],
      skippedJp: [],
      skippedZh: [],
      currentChapterIndex: 0,
      isLoading: false,
      error: null,
      progress: {},

      setJPBook: async (book) => {
        set({ isLoading: true, error: null });
        try {
          if (book) {
            await saveBook(book);
          }
          set({ jpBook: book, isLoading: false });
        } catch (err) {
          set({
            error: `保存日语书籍失败: ${err instanceof Error ? err.message : '未知错误'}`,
            isLoading: false,
          });
        }
      },

      setZHBook: async (book) => {
        set({ isLoading: true, error: null });
        try {
          if (book) {
            await saveBook(book);
          }
          set({ zhBook: book, isLoading: false });
        } catch (err) {
          set({
            error: `保存中文书籍失败: ${err instanceof Error ? err.message : '未知错误'}`,
            isLoading: false,
          });
        }
      },

      loadBook: async (id, type) => {
        set({ isLoading: true, error: null });
        try {
          const book = await getBook(id);
          if (book) {
            if (type === 'jp') {
              set({ jpBook: book, isLoading: false });
            } else {
              set({ zhBook: book, isLoading: false });
            }
          } else {
            set({ error: `未找到书籍: ${id}`, isLoading: false });
          }
        } catch (err) {
          set({
            error: `加载书籍失败: ${err instanceof Error ? err.message : '未知错误'}`,
            isLoading: false,
          });
        }
      },

      setAlignments: async (alignments) => {
        const { jpBook, zhBook } = get();
        set({ alignments });
        if (jpBook && zhBook) {
          try {
            await saveAlignments(jpBook.id, zhBook.id, alignments);
          } catch (err) {
            console.error('保存对齐结果失败:', err);
          }
        }
      },

      updateAlignment: (jpIndex, zhIndex) => {
        const { alignments } = get();
        const existing = alignments.findIndex(a => a.jpIndex === jpIndex);
        if (existing >= 0) {
          const updated = [...alignments];
          updated[existing] = { jpIndex, zhIndex, score: 100 };
          set({ alignments: updated });
        } else {
          set({ alignments: [...alignments, { jpIndex, zhIndex, score: 100 }] });
        }
      },

      setSkippedJp: (indices) => set({ skippedJp: indices }),
      setSkippedZh: (indices) => set({ skippedZh: indices }),

      toggleSkipJp: (index) => {
        const { skippedJp } = get();
        const newSkipped = skippedJp.includes(index)
          ? skippedJp.filter(i => i !== index)
          : [...skippedJp, index];
        set({ skippedJp: newSkipped });
      },

      toggleSkipZh: (index) => {
        const { skippedZh } = get();
        const newSkipped = skippedZh.includes(index)
          ? skippedZh.filter(i => i !== index)
          : [...skippedZh, index];
        set({ skippedZh: newSkipped });
      },

      setCurrentChapter: (index) => set({ currentChapterIndex: index }),

      setProgress: (chapterId, charIndex) => {
        const { progress } = get();
        set({ progress: { ...progress, [chapterId]: charIndex } });
      },

      getProgress: (chapterId) => {
        const { progress } = get();
        return progress[chapterId] || 0;
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      reset: () => set({
        jpBook: null,
        zhBook: null,
        alignments: [],
        skippedJp: [],
        skippedZh: [],
        currentChapterIndex: 0,
        isLoading: false,
        error: null,
        progress: {},
      }),
    }),
    {
      name: 'jp-typing-book-store',
      partialize: (state) => ({
        jpBook: state.jpBook,
        zhBook: state.zhBook,
        alignments: state.alignments,
        skippedJp: state.skippedJp,
        skippedZh: state.skippedZh,
        currentChapterIndex: state.currentChapterIndex,
        progress: state.progress,
      }),
    }
  )
);
