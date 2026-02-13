import {describe, it, expect} from 'vitest';
import {
    escapeQuotes,
    toKebabCase,
    compareVersions,
    parseMajor,
    findBestVersionForMajor,
} from '../../generators/shared/utils';

describe('escapeQuotes', () => {
    it('should escape single quotes', () => {
        expect(escapeQuotes("it's")).toBe("it\\'s");
    });

    it('should handle strings without quotes', () => {
        expect(escapeQuotes('hello')).toBe('hello');
    });

    it('should escape multiple single quotes', () => {
        expect(escapeQuotes("it's a 'test'")).toBe("it\\'s a \\'test\\'");
    });
});

describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
        expect(toKebabCase('skipTests')).toBe('skip-tests');
    });

    it('should convert multiple humps', () => {
        expect(toKebabCase('inlineStyle')).toBe('inline-style');
    });

    it('should leave already-lowercase strings unchanged', () => {
        expect(toKebabCase('style')).toBe('style');
    });

    it('should handle consecutive uppercase transitions', () => {
        expect(toKebabCase('viewEncapsulation')).toBe('view-encapsulation');
    });
});

describe('compareVersions', () => {
    it('should return negative when a < b', () => {
        expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    });

    it('should return positive when a > b', () => {
        expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
    });

    it('should return 0 for equal versions', () => {
        expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
    });

    it('should compare minor versions', () => {
        expect(compareVersions('1.1.0', '1.2.0')).toBeLessThan(0);
    });

    it('should compare patch versions', () => {
        expect(compareVersions('1.0.1', '1.0.2')).toBeLessThan(0);
    });
});

describe('parseMajor', () => {
    it('should extract major version number', () => {
        expect(parseMajor('21.1.3')).toBe(21);
    });

    it('should handle single digit', () => {
        expect(parseMajor('1.0.0')).toBe(1);
    });

    it('should handle pre-release versions', () => {
        expect(parseMajor('10.0.0-rc.1')).toBe(10);
    });
});

describe('findBestVersionForMajor', () => {
    it('should find the highest stable version for a major', () => {
        const versions = ['18.0.0', '18.1.0', '18.2.0', '18.2.12', '19.0.0'];
        expect(findBestVersionForMajor(versions, 18)).toBe('18.2.12');
    });

    it('should skip pre-release versions', () => {
        const versions = ['19.0.0-rc.1', '19.0.0', '19.1.0'];
        expect(findBestVersionForMajor(versions, 19)).toBe('19.1.0');
    });

    it('should return undefined when no matching versions', () => {
        const versions = ['18.0.0', '19.0.0'];
        expect(findBestVersionForMajor(versions, 20)).toBeUndefined();
    });

    it('should exclude all pre-release if no stable exists', () => {
        const versions = ['20.0.0-alpha.1', '20.0.0-beta.1'];
        expect(findBestVersionForMajor(versions, 20)).toBeUndefined();
    });
});
