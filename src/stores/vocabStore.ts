import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VocabEntry } from '@/types';

interface VocabStore {
  wrongWords: VocabEntry[];
  bookmarkedWords: string[]; // word ids

  // Actions
  addWrongWord: (word: string, reading: string) => void;
  removeWrongWord: (id: string) => void;
  incrementWrongCount: (id: string) => void;
  toggleBookmark: (id: string) => void;
  exportToCSV: () => string;
  clearAll: () => void;
}

export const useVocabStore = create<VocabStore>()(
  persist(
    (set, get) => ({
      wrongWords: [],
      bookmarkedWords: [],

      addWrongWord: (word, reading) => {
        const { wrongWords } = get();
        const existing = wrongWords.find(w => w.word === word);
        if (existing) {
          set({
            wrongWords: wrongWords.map(w =>
              w.word === word
                ? { ...w, wrongCount: w.wrongCount + 1, lastWrongAt: Date.now() }
                : w
            ),
          });
        } else {
          const newEntry: VocabEntry = {
            id: `vocab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            word,
            reading,
            wrongCount: 1,
            lastWrongAt: Date.now(),
            bookmarked: false,
          };
          set({ wrongWords: [...wrongWords, newEntry] });
        }
      },

      removeWrongWord: (id) => {
        const { wrongWords, bookmarkedWords } = get();
        set({
          wrongWords: wrongWords.filter(w => w.id !== id),
          bookmarkedWords: bookmarkedWords.filter(b => b !== id),
        });
      },

      incrementWrongCount: (id) => {
        const { wrongWords } = get();
        set({
          wrongWords: wrongWords.map(w =>
            w.id === id
              ? { ...w, wrongCount: w.wrongCount + 1, lastWrongAt: Date.now() }
              : w
          ),
        });
      },

      toggleBookmark: (id) => {
        const { wrongWords, bookmarkedWords } = get();
        const nowBookmarked = !bookmarkedWords.includes(id);
        set({
          bookmarkedWords: nowBookmarked
            ? [...bookmarkedWords, id]
            : bookmarkedWords.filter((b) => b !== id),
          wrongWords: wrongWords.map((w) =>
            w.id === id ? { ...w, bookmarked: nowBookmarked } : w
          ),
        });
      },

      exportToCSV: () => {
        const { wrongWords } = get();
        const headers = 'Word,Reading,Wrong Count,Last Wrong At,Bookmarked\n';
        const rows = wrongWords
          .sort((a, b) => b.wrongCount - a.wrongCount)
          .map(w => `"${w.word}","${w.reading}",${w.wrongCount},${new Date(w.lastWrongAt).toISOString()},${w.bookmarked}`)
          .join('\n');
        return headers + rows;
      },

      clearAll: () => set({ wrongWords: [], bookmarkedWords: [] }),
    }),
    {
      name: 'jp-typing-vocab-store',
    }
  )
);
