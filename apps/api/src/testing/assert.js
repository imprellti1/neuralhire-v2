export function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

export function assertEqual(a, b, message = 'Values are not equal') {
  if (a !== b) {
    throw new Error(`${message}. Expected: ${b}. Received: ${a}`);
  }
}

export function assertIncludes(value, expected, message = 'Value does not include expected') {
  if (!String(value).includes(String(expected))) {
    throw new Error(`${message}. Expected to include: ${expected}. Received: ${value}`);
  }
}
