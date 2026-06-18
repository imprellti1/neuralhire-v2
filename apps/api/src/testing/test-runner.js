import { dumpApiTestState, resetApiTestState } from './reset-test-state.js';

export async function runTestSuite(name, tests) {
  console.log(`\nSuite: ${name}`);

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`[test-start] ${test.name} :: ${JSON.stringify(dumpApiTestState())}`);
      resetApiTestState();
      console.log(`[test-after-reset] ${test.name} :: ${JSON.stringify(dumpApiTestState())}`);
      await test.run();
      passed += 1;
      console.log(`✔ PASS - ${test.name}`);
    } catch (error) {
      failed += 1;
      console.log(`✖ FAIL - ${test.name}`);
      console.log(`  ${error.message}`);
      if (error?.stack) {
        console.log(error.stack);
      }
    } finally {
      console.log(`[test-end] ${test.name} :: ${JSON.stringify(dumpApiTestState())}`);
      resetApiTestState();
    }
  }

  const total = tests.length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }

  return { total, passed, failed };
}
