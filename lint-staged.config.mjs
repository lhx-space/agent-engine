export default {
  '*.{js,mjs,cjs,ts,tsx,mts,cts}': ['rslint --fix', 'prettier --write'],
  '*.{json,yaml,yml,md}': ['prettier --write'],
  '*.{js,mjs,cjs,ts,tsx,mts,cts,json,yaml,yml,md}': ['cspell --no-must-find-files'],
};
