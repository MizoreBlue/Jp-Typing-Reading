import { create } from 'zustand';
import type { TypingState } from '@/types';

interface ExtendedTypingState extends TypingState {
  isActive: boolean;
  currentText: string;
}

interface TypingStore extends ExtendedTypingState {
  // Actions
  startTyping: (text: string, startIndex?: number) => void;
  processInput: (char: string) => { success: boolean; isComplete: boolean };
  backspace: () => void;
  reset: () => void;
  setActive: (active: boolean) => void;
}

export const useTypingStore = create<TypingStore>((set, get) => ({
  isActive: false,
  currentText: '',
  currentCharIndex: 0,
  inputBuffer: '',
  typedText: '',
  remainingText: '',
  isCorrect: true,
  errors: 0,
  startTime: null,

  startTyping: (text, startIndex = 0) => {
    set({
      isActive: true,
      currentText: text,
      currentCharIndex: startIndex,
      inputBuffer: '',
      typedText: text.slice(0, startIndex),
      remainingText: text.slice(startIndex),
      isCorrect: true,
      errors: 0,
      startTime: Date.now(),
    });
  },

  processInput: (char) => {
    const state = get();
    if (!state.isActive || !state.remainingText) {
      return { success: false, isComplete: false };
    }

    const expectedChar = state.remainingText[0];

    if (char === expectedChar) {
      const newTypedText = state.typedText + char;
      const newRemainingText = state.remainingText.slice(1);
      const isComplete = newRemainingText.length === 0;

      set({
        typedText: newTypedText,
        remainingText: newRemainingText,
        currentCharIndex: state.currentCharIndex + 1,
        inputBuffer: '',
        isCorrect: true,
      });

      return { success: true, isComplete };
    } else {
      set({
        isCorrect: false,
        errors: state.errors + 1,
      });
      return { success: false, isComplete: false };
    }
  },

  backspace: () => {
    const state = get();
    if (state.typedText.length > 0) {
      const newTypedText = state.typedText.slice(0, -1);
      const newCharIndex = state.currentCharIndex - 1;
      set({
        typedText: newTypedText,
        remainingText: state.currentText.slice(newCharIndex),
        currentCharIndex: newCharIndex,
        inputBuffer: '',
        isCorrect: true,
      });
    }
  },

  reset: () => set({
    isActive: false,
    currentText: '',
    currentCharIndex: 0,
    inputBuffer: '',
    typedText: '',
    remainingText: '',
    isCorrect: true,
    errors: 0,
    startTime: null,
  }),

  setActive: (active) => set({ isActive: active }),
}));
