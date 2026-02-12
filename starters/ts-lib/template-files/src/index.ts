/**
 * Adds two numbers together.
 */
export function add(a: number, b: number): number {
    return a + b;
}

/**
 * Subtracts the second number from the first.
 */
export function subtract(a: number, b: number): number {
    return a - b;
}

/**
 * Multiplies two numbers together.
 */
export function multiply(a: number, b: number): number {
    return a * b;
}

/**
 * Divides the first number by the second.
 * @throws Error if divisor is zero.
 */
export function divide(a: number, b: number): number {
    if (b === 0) {
        throw new Error('Cannot divide by zero');
    }
    return a / b;
}
