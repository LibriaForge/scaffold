import { describe, it, expect } from 'vitest';
import { add, subtract, multiply, divide } from '../src';

describe('Math functions', () => {
    describe('add', () => {
        it('should add two positive numbers', () => {
            expect(add(2, 3)).toBe(5);
        });

        it('should handle negative numbers', () => {
            expect(add(-1, 1)).toBe(0);
        });
    });

    describe('subtract', () => {
        it('should subtract two numbers', () => {
            expect(subtract(5, 3)).toBe(2);
        });

        it('should return negative when second is larger', () => {
            expect(subtract(3, 5)).toBe(-2);
        });
    });

    describe('multiply', () => {
        it('should multiply two numbers', () => {
            expect(multiply(4, 5)).toBe(20);
        });

        it('should return zero when multiplied by zero', () => {
            expect(multiply(5, 0)).toBe(0);
        });
    });

    describe('divide', () => {
        it('should divide two numbers', () => {
            expect(divide(10, 2)).toBe(5);
        });

        it('should throw when dividing by zero', () => {
            expect(() => divide(5, 0)).toThrow('Cannot divide by zero');
        });
    });
});
