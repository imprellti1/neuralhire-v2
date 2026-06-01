export async function runTestSuite(name, tests) {
  console.log(`\nSuite: ${name}`);

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`✔ PASS - ${test.name}`);
    } catch (error) {
      failed += 1;
      console.log(`✖ FAIL - ${test.name}`);
      console.log(`  ${error.message}`);
    }
  }

  const total = tests.length;
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }

  return { total, passed, failed };
}
