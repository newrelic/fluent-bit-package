const Sequencer = require('@jest/test-sequencer').default;

/**
 * Custom test sequencer that runs version-validation.test.js first.
 * Fails fast if wrong version is installed, preventing wasted time on functional tests.
 */
class CustomSequencer extends Sequencer {
  sort(tests) {
    if (!Array.isArray(tests)) return tests || [];

    return Array.from(tests).sort((testA, testB) => {
      if (!testA?.path || !testB?.path) return 0;

      const isTestAVersionValidation = testA.path.includes('version-validation.test.js');
      const isTestBVersionValidation = testB.path.includes('version-validation.test.js');

      if (isTestAVersionValidation && !isTestBVersionValidation) return -1;
      if (!isTestAVersionValidation && isTestBVersionValidation) return 1;

      return testA.path.localeCompare(testB.path);
    });
  }
}

module.exports = CustomSequencer;
