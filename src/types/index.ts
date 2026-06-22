// 书籍相关类型
export interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface EPUBBook {
  id: string;
  title: string;
  author: string;
  language: 'ja' | 'zh';
  chapters: Chapter[];
  addedAt: number;
}

// 对齐相关类型
export interface AlignmentPair {
  jpIndex: number;
  zhIndex: number;
  score: number;
}

// 打字相关类型
export interface Token {
  surface: string;
  reading: string;
  pos: string;
}

export interface RubyText {
  kanji: string;
  furigana: string;
}

export interface TypingState {
  currentCharIndex: number;
  inputBuffer: string;
  typedText: string;
  remainingText: string;
  isCorrect: boolean;
  errors: number;
  startTime: number | null;
}

// 生词本类型
export interface VocabEntry {
  id: string;
  word: string;
  reading: string;
  wrongCount: number;
  lastWrongAt: number;
  bookmarked: boolean;
}

// 阅读进度
export interface ReadingProgress {
  chapterId: string;
  charIndex: number;
  completed: boolean;
}
