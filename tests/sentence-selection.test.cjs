const { test } = require('node:test');
const assert = require('node:assert/strict');
require('../sentence-selection.js');
const { sentenceBounds, normalize } = globalThis.PdfSentenceSelection;

function sentence(text, word) {
  const start = text.indexOf(word);
  const bounds = sentenceBounds(text, start, start + word.length);
  return normalize(text.slice(bounds.start, bounds.end));
}

test('isolates a middle sentence and preserves closing quotes', () => {
  assert.equal(sentence('First. "This is useful!" Last.', 'useful'), '"This is useful!"');
});
test('preserves scientific abbreviations, initials and decimals', () => {
  const text = 'Previous. Dr. A. Smith uses Fig. 2, e.g. a 3.14 value. Next.';
  assert.equal(sentence(text, 'value'), 'Dr. A. Smith uses Fig. 2, e.g. a 3.14 value.');
});
test('supports Chinese punctuation without spaces', () => {
  assert.equal(sentence('第一句。这里是第二句！最后一句？', '第二'), '这里是第二句！');
});
test('keeps all sentences overlapped by a selection', () => {
  assert.equal(sentence('Before. One sentence. Another sentence! After.', 'sentence. Another'), 'One sentence. Another sentence!');
});
test('joins wrapped and hyphenated lines', () => {
  assert.equal(sentence('Before. The trans-\nformer uses\nattention. After.', 'attention'), 'The transformer uses attention.');
});
test('does not merge a heading or separate paragraph into a sentence', () => {
  assert.equal(sentence('Introduction\n\nThis is a paragraph without punctuation\n\nNext heading', 'paragraph'), 'This is a paragraph without punctuation');
});
test('handles final sentence without trailing punctuation', () => {
  assert.equal(sentence('First. Final sentence', 'Final'), 'Final sentence');
});
