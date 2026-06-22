import { describe, it, expect } from 'vitest';
import { addFurigana, simpleTokenize, getKanjiReading, isKanji, isHiragana, isKatakana } from './furigana';

describe('simpleTokenize', () => {
  it('should tokenize Japanese text', () => {
    const tokens = simpleTokenize('今日は良い天気です');
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens[0]).toHaveProperty('surface');
    expect(tokens[0]).toHaveProperty('reading');
    expect(tokens[0]).toHaveProperty('pos');
  });

  it('should identify kanji tokens', () => {
    const tokens = simpleTokenize('日本語');
    const kanjiToken = tokens.find(t => t.surface === '日本');
    expect(kanjiToken).toBeDefined();
    expect(kanjiToken?.reading).toBe('にほん');
  });
});

describe('addFurigana', () => {
  it('should return ruby text array', () => {
    const rubyTexts = addFurigana('今日は良い天気です');
    expect(Array.isArray(rubyTexts)).toBe(true);
    rubyTexts.forEach((rt) => {
      expect(rt).toHaveProperty('kanji');
      expect(rt).toHaveProperty('furigana');
    });
  });

  it('should add furigana to kanji', () => {
    const rubyTexts = addFurigana('日本語');
    const nihonRuby = rubyTexts.find(rt => rt.kanji === '日本');
    expect(nihonRuby).toBeDefined();
    expect(nihonRuby?.furigana).toBe('にほん');
  });
});

describe('getKanjiReading', () => {
  it('should return reading for known kanji', () => {
    expect(getKanjiReading('日')).toBe('に');
    expect(getKanjiReading('本')).toBe('ほん');
  });

  it('should return null for unknown kanji', () => {
    expect(getKanjiReading('鰯')).toBeNull();
  });
});

describe('katakana conversion', () => {
  it('should convert single katakana to hiragana', () => {
    const tokens = simpleTokenize('アイウエオ');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].reading).toBe('あいうえお');
  });

  it('should convert 2-char katakana combinations', () => {
    const tokens = simpleTokenize('ヴァ');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].reading).toBe('う゛ぁ');
  });

  it('should convert katakana in mixed text', () => {
    const tokens = simpleTokenize('カタカナと漢字');
    expect(tokens.length).toBeGreaterThan(1);
  });

  it('should tokenize mixed character types', () => {
    const tokens = simpleTokenize('日本語とひらがな');
    expect(tokens.length).toBeGreaterThan(1);
    tokens.forEach((token) => {
      expect(token).toHaveProperty('surface');
      expect(token).toHaveProperty('reading');
    });
  });

  it('should handle non-Japanese characters', () => {
    const tokens = simpleTokenize('日本語 ABC');
    expect(tokens.length).toBeGreaterThan(1);
  });
});

describe('character type checks', () => {
  it('should identify kanji characters', () => {
    expect(isKanji('日')).toBe(true);
    expect(isKanji('あ')).toBe(false);
  });

  it('should identify hiragana characters', () => {
    expect(isHiragana('あ')).toBe(true);
    expect(isHiragana('ア')).toBe(false);
  });

  it('should identify katakana characters', () => {
    expect(isKatakana('ア')).toBe(true);
    expect(isKatakana('あ')).toBe(false);
  });
});
