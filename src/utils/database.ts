import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { EPUBBook, AlignmentPair, VocabEntry } from '@/types';

interface JPTypingDB extends DBSchema {
  books: {
    key: string;
    value: EPUBBook;
    indexes: { 'by-addedAt': number };
  };
  alignments: {
    key: string;
    value: {
      bookPairId: string;
      pairs: AlignmentPair[];
      updatedAt: number;
    };
  };
  vocab: {
    key: string;
    value: VocabEntry;
    indexes: { 'by-wrongCount': number; 'by-lastWrongAt': number };
  };
}

const DB_NAME = 'jp-typing-reader';
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<JPTypingDB> | null = null;

/**
 * 获取数据库实例
 */
async function getDB(): Promise<IDBPDatabase<JPTypingDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<JPTypingDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 创建书籍存储
      if (!db.objectStoreNames.contains('books')) {
        const bookStore = db.createObjectStore('books', { keyPath: 'id' });
        bookStore.createIndex('by-addedAt', 'addedAt');
      }

      // 创建对齐存储
      if (!db.objectStoreNames.contains('alignments')) {
        db.createObjectStore('alignments', { keyPath: 'bookPairId' });
      }

      // 创建词汇存储
      if (!db.objectStoreNames.contains('vocab')) {
        const vocabStore = db.createObjectStore('vocab', { keyPath: 'id' });
        vocabStore.createIndex('by-wrongCount', 'wrongCount');
        vocabStore.createIndex('by-lastWrongAt', 'lastWrongAt');
      }
    },
  });

  return dbInstance;
}

// ============ 书籍操作 ============

export async function saveBook(book: EPUBBook): Promise<void> {
  const db = await getDB();
  await db.put('books', book);
}

export async function getBook(id: string): Promise<EPUBBook | undefined> {
  const db = await getDB();
  return db.get('books', id);
}

export async function getAllBooks(): Promise<EPUBBook[]> {
  const db = await getDB();
  return db.getAllFromIndex('books', 'by-addedAt');
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('books', id);
}

// ============ 对齐操作 ============

export async function saveAlignments(
  jpBookId: string,
  zhBookId: string,
  pairs: AlignmentPair[]
): Promise<void> {
  const db = await getDB();
  const bookPairId = `${jpBookId}_${zhBookId}`;
  await db.put('alignments', {
    bookPairId,
    pairs,
    updatedAt: Date.now(),
  });
}

export async function getAlignments(
  jpBookId: string,
  zhBookId: string
): Promise<AlignmentPair[] | undefined> {
  const db = await getDB();
  const bookPairId = `${jpBookId}_${zhBookId}`;
  const result = await db.get('alignments', bookPairId);
  return result?.pairs;
}

export async function deleteAlignments(
  jpBookId: string,
  zhBookId: string
): Promise<void> {
  const db = await getDB();
  const bookPairId = `${jpBookId}_${zhBookId}`;
  await db.delete('alignments', bookPairId);
}

// ============ 词汇操作 ============

export async function saveVocabEntry(entry: VocabEntry): Promise<void> {
  const db = await getDB();
  await db.put('vocab', entry);
}

export async function getVocabEntry(id: string): Promise<VocabEntry | undefined> {
  const db = await getDB();
  return db.get('vocab', id);
}

export async function getAllVocab(): Promise<VocabEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex('vocab', 'by-wrongCount');
}

export async function deleteVocabEntry(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('vocab', id);
}

export async function clearAllVocab(): Promise<void> {
  const db = await getDB();
  await db.clear('vocab');
}

// ============ 导出/导入 ============

export async function exportAllData(): Promise<string> {
  const db = await getDB();
  const books = await db.getAll('books');
  const alignments = await db.getAll('alignments');
  const vocab = await db.getAll('vocab');

  return JSON.stringify({
    books,
    alignments,
    vocab,
    exportedAt: Date.now(),
  }, null, 2);
}

export async function importData(json: string): Promise<void> {
  try {
    const data = JSON.parse(json);
    const db = await getDB();

    if (data.books && Array.isArray(data.books)) {
      const tx = db.transaction('books', 'readwrite');
      for (const book of data.books) {
        await tx.store.put(book);
      }
      await tx.done;
    }

    if (data.alignments && Array.isArray(data.alignments)) {
      const tx = db.transaction('alignments', 'readwrite');
      for (const alignment of data.alignments) {
        await tx.store.put(alignment);
      }
      await tx.done;
    }

    if (data.vocab && Array.isArray(data.vocab)) {
      const tx = db.transaction('vocab', 'readwrite');
      for (const vocab of data.vocab) {
        await tx.store.put(vocab);
      }
      await tx.done;
    }
  } catch (error) {
    console.error('Failed to import data:', error);
    throw new Error('无效的导入数据格式');
  }
}
