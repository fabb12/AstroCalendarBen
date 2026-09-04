const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const body = {
  nodeType: 1,
  hasAttribute: () => false,
  childNodes: []
};
const document = {
  readyState: 'loading',
  body,
  documentElement: { lang: '', dataset: {} },
  title: '',
  addEventListener() {},
  querySelector: () => null,
  getElementById: () => null,
  dispatchEvent() {}
};
const context = {
  window: {},
  document,
  navigator: { languages: [] },
  localStorage: { getItem: () => null, setItem() {} },
  console,
  Intl,
  Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
  CustomEvent: function CustomEvent() {},
  MutationObserver: function MutationObserver() {},
  AbortController,
  fetch,
  setTimeout,
  clearTimeout
};

vm.runInNewContext(fs.readFileSync('i18n.js', 'utf8'), context);
const i18n = context.window.astroI18n;

assert.deepStrictEqual([...i18n.getSupportedLanguages()], ['it', 'en']);
assert.strictEqual(i18n.t('app.title'), 'AstroCalendario di Ben');

i18n.registerLocale('fr', {
  locale: 'fr-FR',
  manifest: 'manifest-fr.json',
  messages: {
    'language.switch': 'Passer en {language}',
    'app.title': 'AstroCalendrier de Ben',
    'test.greeting': 'Bonjour {name}'
  }
});
i18n.setLanguage('fr');

assert.strictEqual(i18n.getLanguage(), 'fr');
assert.strictEqual(i18n.getLocale(), 'fr-FR');
assert.strictEqual(i18n.t('test.greeting', { name: 'Ada' }), 'Bonjour Ada');
assert.strictEqual(document.documentElement.lang, 'fr');
assert.strictEqual(document.title, 'AstroCalendrier de Ben');
assert.strictEqual(i18n.t('test.missing'), 'test.missing');

console.log('i18n: registry, switching, interpolation and missing-key handling OK');
