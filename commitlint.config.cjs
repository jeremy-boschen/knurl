module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [2, 'never', ['sentence-case']],
    'body-max-line-length': [2, 'always', 120],
  },
};

