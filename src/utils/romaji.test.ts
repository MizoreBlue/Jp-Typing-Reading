import { describe, it, expect } from 'vitest';
import { romajiToHiraganaConvert, isValidRomaji } from './romaji';

describe('romajiToHiraganaConvert', () => {
  it('should convert basic vowels', () => {
    expect(romajiToHiraganaConvert('aiueo')).toBe('あいうえお');
  });

  it('should convert basic consonants', () => {
    expect(romajiToHiraganaConvert('kakikukeko')).toBe('かきくけこ');
  });

  it('should convert youon', () => {
    expect(romajiToHiraganaConvert('kyakyukyo')).toBe('きゃきゅきょ');
    expect(romajiToHiraganaConvert('shashusho')).toBe('しゃしゅしょ');
  });

  it('should convert sokuon', () => {
    expect(romajiToHiraganaConvert('katta')).toBe('かった');
    expect(romajiToHiraganaConvert('kakatta')).toBe('かかった');
  });

  it('should convert mixed text', () => {
    expect(romajiToHiraganaConvert('konnichiha')).toBe('こんにちは');
  });

  it('should convert long vowel', () => {
    expect(romajiToHiraganaConvert('ka-a')).toBe('かーあ');
  });

  it('should handle unrecognized characters', () => {
    expect(romajiToHiraganaConvert('1!')).toBe('1!');
  });

  it('should convert sokuon with various consonants', () => {
    expect(romajiToHiraganaConvert('sasshi')).toBe('さっし');
    expect(romajiToHiraganaConvert('gakkou')).toBe('がっこう');
  });
});

describe('isValidRomaji', () => {
  it('should accept lowercase letters', () => {
    expect(isValidRomaji('a')).toBe(true);
    expect(isValidRomaji('z')).toBe(true);
  });

  it('should accept uppercase letters', () => {
    expect(isValidRomaji('A')).toBe(true);
  });

  it('should accept hyphen for long vowel', () => {
    expect(isValidRomaji('-')).toBe(true);
  });

  it('should reject non-romaji characters', () => {
    expect(isValidRomaji('1')).toBe(false);
    expect(isValidRomaji('!')).toBe(false);
    expect(isValidRomaji('あ')).toBe(false);
  });
});
