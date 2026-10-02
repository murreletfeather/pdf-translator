const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    const file = req.url === '/sentence-selection.js' ? 'sentence-selection.js' : 'index.html';
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'text/html');
    res.end(fs.readFileSync(path.join(root, file)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('pdf_ai_llm_config', JSON.stringify({
      provider: 'openai', apiKey: 'test-only', baseUrl: 'https://translator.test/v1', model: 'test-model'
    })));
    const requests = [];
    const bodies = [];
    let delayNext = false, abortedRequests = 0;
    page.on('requestfailed', request => { if (request.url().startsWith('https://translator.test/')) abortedRequests++; });
    await page.route('https://translator.test/**', async route => {
      const body = route.request().postDataJSON();
      bodies.push(body);
      requests.push(body.messages[1].content);
      const delayed = delayNext;
      delayNext = false;
      if (delayed) await new Promise(resolve => setTimeout(resolve, 500));
      const explaining = body.messages[0].content.includes('术语讲解助手');
      await route.fulfill({ contentType: 'text/event-stream', body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: delayed ? '过期单词译文' : explaining ? '测试术语解释：定义、语境、例子。' : '测试译文' } }] }) + '\n\ndata: [DONE]\n\n' }).catch(() => {});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '✨ 打开多页示例论文' }).click();
    const line = page.locator('#pdf-page-1 .textLayer span').filter({ hasText: 'The dominant sequence' });
    await line.waitFor();
    await line.scrollIntoViewIfNeeded();
    const box = await line.boundingBox();
    // Hold Alt explicitly like a reader.
    await page.keyboard.down('Alt');
    await page.mouse.click(box.x + 70, box.y + box.height / 2);
    await page.keyboard.up('Alt');
    const popup = page.locator('#selection-popup-box');
    await popup.getByRole('button', { name: '已选中整句' }).waitFor();
    await popup.getByText('测试译文', { exact: true }).waitFor();
    assert.equal(requests.length, 1, 'Alt-click sends exactly one request');
    assert.match(requests[0], /The dominant sequence transduction models are based on complex recurrent or convolutional neural networks\./);
    assert.equal(await page.evaluate(() => window.getSelection().toString()), 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.');

    await page.keyboard.press('Escape');
    await page.mouse.dblclick(box.x + 70, box.y + box.height / 2);
    await popup.getByRole('button', { name: '整句翻译', exact: true }).waitFor();
    await popup.getByText('测试译文', { exact: true }).waitFor();
    assert.equal(requests.length, 2, 'double click still translates a word');
    assert.ok(requests[1].length < requests[0].length, JSON.stringify(requests));
    await popup.getByRole('button', { name: '整句翻译', exact: true }).click();
    await popup.getByRole('button', { name: '已选中整句' }).waitFor();
    await popup.getByText('测试译文', { exact: true }).waitFor();
    assert.equal(requests.length, 3);
    await popup.getByTitle('钉住/固定浮窗').click();
    await page.mouse.click(20, 120);
    assert.equal(await popup.isVisible(), true, 'pinned popup survives outside click');
    await page.keyboard.press('Escape');
    assert.equal(await popup.count(), 0);

    delayNext = true;
    await page.mouse.dblclick(box.x + 70, box.y + box.height / 2);
    await popup.getByRole('button', { name: '整句翻译', exact: true }).click();
    await popup.getByText('测试译文', { exact: true }).waitFor();
    await page.waitForTimeout(600);
    assert.equal(await popup.getByText('过期单词译文', { exact: true }).count(), 0);
    assert.ok(abortedRequests > 0, 'switching to the sentence aborts the pending word request');
    if (process.env.TEST_SCREENSHOT) await page.screenshot({ path: process.env.TEST_SCREENSHOT });
    await page.keyboard.press('Escape');

    await page.evaluate(() => {
      window.mouseDefaults = [];
      for (const type of ['mousedown', 'auxclick', 'contextmenu']) {
        window.addEventListener(type, event => window.mouseDefaults.push({ type, button: event.button, shift: event.shiftKey, prevented: event.defaultPrevented }));
      }
    });
    const beforeMiddle = requests.length;
    await page.mouse.click(box.x + 70, box.y + box.height / 2, { button: 'middle' });
    await popup.getByRole('button', { name: '已选中整句' }).waitFor();
    await popup.getByText('测试译文', { exact: true }).waitFor();
    assert.equal(requests.length, beforeMiddle + 1);
    assert.ok(await page.evaluate(() => window.mouseDefaults.some(e => e.type === 'mousedown' && e.button === 1 && e.prevented)), 'middle mousedown blocks autoscroll');
    assert.ok(await page.evaluate(() => window.mouseDefaults.some(e => e.type === 'auxclick' && e.button === 1 && e.prevented)), 'middle auxclick is consumed');
    await page.keyboard.press('Escape');

    const wordPoint = await line.evaluate(element => {
      const range = document.createRange();
      const node = element.firstChild, start = node.textContent.indexOf('recurrent');
      range.setStart(node, start); range.setEnd(node, start + 9);
      const rect = range.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });
    const beforeExplain = requests.length;
    await page.mouse.click(wordPoint.x, wordPoint.y, { button: 'right' });
    await popup.getByText('AI 术语解释', { exact: true }).waitFor();
    await popup.getByText('测试术语解释：定义、语境、例子。', { exact: true }).waitFor();
    assert.equal(requests.length, beforeExplain + 1, 'right-click sends exactly one explanation request');
    assert.match(requests.at(-1), /术语："recurrent"/);
    assert.match(requests.at(-1), /所在句子："The dominant sequence/);
    assert.equal(bodies.at(-1).model, 'test-model', 'explanation reuses the configured model');
    assert.ok(await page.evaluate(() => window.mouseDefaults.some(e => e.type === 'contextmenu' && !e.shift && e.prevented)), 'native PDF menu is prevented');
    await popup.getByTitle('在侧边栏查看').click();
    await page.locator('aside').getByText('测试术语解释：定义、语境、例子。', { exact: true }).waitFor();
    await page.locator('aside').getByRole('button', { name: '立即解释' }).waitFor();
    assert.match(bodies.at(-1).messages[0].content, /术语讲解助手/);
    await page.locator('aside').getByRole('button', { name: '✖', exact: true }).click();
    await page.keyboard.press('Escape');

    await line.scrollIntoViewIfNeeded();
    const phrasePoint = await line.evaluate(element => {
      const node = element.firstChild, phrase = 'complex recurrent';
      const start = node.textContent.indexOf(phrase), range = document.createRange();
      range.setStart(node, start); range.setEnd(node, start + phrase.length);
      window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
      const rect = range.getBoundingClientRect();
      return { x: rect.left + 10, y: rect.top + rect.height / 2 };
    });
    await page.mouse.click(phrasePoint.x, phrasePoint.y, { button: 'right' });
    await popup.getByText('测试术语解释：定义、语境、例子。', { exact: true }).waitFor();
    assert.match(requests.at(-1), /术语："complex recurrent"/, 'right-click preserves the entire selected phrase');
    const beforeNative = requests.length;
    await page.keyboard.down('Shift');
    await page.mouse.click(phrasePoint.x, phrasePoint.y, { button: 'right' });
    await page.keyboard.up('Shift');
    assert.equal(requests.length, beforeNative);
    assert.ok(await page.evaluate(() => window.mouseDefaults.some(e => e.type === 'contextmenu' && e.shift && !e.prevented)), 'Shift-right-click leaves the native menu enabled');
    await page.keyboard.press('Escape');
    await page.mouse.click(100, 28, { button: 'right' });
    assert.equal(requests.length, beforeNative);
    assert.equal(await page.evaluate(() => window.mouseDefaults.filter(e => e.type === 'contextmenu').at(-1).prevented), false, 'non-PDF right-click remains native');
    await page.keyboard.press('Escape');

    // Switching from translation to explanation of the same word must issue a new prompt.
    await page.mouse.dblclick(wordPoint.x, wordPoint.y);
    await popup.getByText('测试译文', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.getSelection().toString()), 'recurrent', 'double-click does not absorb the following word');
    await popup.getByRole('button', { name: '解释术语', exact: true }).click();
    await popup.getByText('测试术语解释：定义、语境、例子。', { exact: true }).waitFor();
    assert.match(bodies.at(-1).messages[0].content, /术语讲解助手/);
    if (process.env.TEST_SCREENSHOT) await page.screenshot({ path: process.env.TEST_SCREENSHOT });
    await page.keyboard.press('Escape');

    // Exercise DOM offsets across lines and adjacent PDF fragments using real browser Ranges.
    const result = await page.evaluate(() => {
      const layer = document.createElement('div');
      layer.className = 'textLayer';
      layer.style.cssText = 'position:fixed;top:0;left:0;width:600px;height:100px';
      layer.innerHTML = '<span style="top:0;left:0;height:20px">Before. A trans-</span><span style="top:25px;left:0;height:20px">former uses attention.</span><span style="top:25px;left:250px;height:20px"> Next.</span>';
      document.body.append(layer);
      const node = layer.children[1].firstChild;
      const range = document.createRange();
      range.setStart(node, 11); range.setEnd(node, 13);
      const expanded = PdfSentenceSelection.expandRange(range);
      const text = expanded.text;
      const highlight = expanded.range.toString();
      const caret = document.createRange();
      caret.setStart(node, 12); caret.collapse(true);
      const caretText = PdfSentenceSelection.expandRange(caret).text;
      const other = document.querySelector('#pdf-page-1 .textLayer span').firstChild;
      const crossPage = document.createRange();
      crossPage.setStart(other, 0); crossPage.setEnd(node, 13);
      const outside = PdfSentenceSelection.expandRange(crossPage);
      layer.remove();
      return { text, highlight, caretText, outside };
    });
    assert.equal(result.text, 'A transformer uses attention.');
    assert.equal(result.caretText, result.text);
    assert.match(result.highlight, /A trans-former uses attention\./);
    assert.equal(result.outside, null);
    assert.deepEqual(errors, []);
    console.log('PASS: Alt/middle sentence translation, right-click AI explanation, selected phrases/context, same-model API, sidebar explanation, native-menu escape/outside behavior, fallback explanation button, cancellation and sentence regressions; no browser script errors.');
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
