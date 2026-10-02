/* Sentence selection uses the rendered PDF text layer; no PDF or text leaves the browser. */
(function (root) {
  function sentenceBounds(text, start, end) {
    const boundaries = [0];
    const punctuation = /[.!?。！？]/;
    for (let i = 0; i < text.length; i++) {
      if (text.slice(i, i + 2) === '\n\n') {
        boundaries.push(i + 2);
        i++;
        continue;
      }
      if (!punctuation.test(text[i])) continue;
      if (text[i] === '.') {
        // Preserve decimals, initials, and common abbreviations in scientific prose.
        if (/\d/.test(text[i - 1] || '') && /\d/.test(text[i + 1] || '')) continue;
        const prefix = text.slice(0, i + 1);
        if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Fig|Figs|Eq|Eqs|Sec|Vol|No|vs|etc|al|e\.g|i\.e)\.$/i.test(prefix)) continue;
        if (/\b[A-Z]\.$/.test(prefix)) continue;
        if (/[A-Za-z]/.test(text[i + 1] || '')) continue;
      }
      let next = i + 1;
      while (next < text.length && /[.!?。！？”’"')\]]/.test(text[next])) next++;
      if (next === text.length || /\s/.test(text[next]) || /[。！？]/.test(text[i])) {
        boundaries.push(next);
        i = next - 1;
      }
    }
    boundaries.push(text.length);
    let first = 0, last = text.length;
    for (const boundary of boundaries) {
      if (boundary <= start) first = boundary;
      if (boundary >= end) { last = boundary; break; }
    }
    while (first < last && /\s/.test(text[first])) first++;
    while (last > first && /\s/.test(text[last - 1])) last--;
    return { start: first, end: last };
  }

  function normalize(text) {
    return text.replace(/([A-Za-z])-\s*\n\s*([a-z])/g, '$1$2').replace(/\s+/g, ' ').trim();
  }

  function expandRange(range) {
    const element = node => node.nodeType === 1 ? node : node.parentElement;
    const layer = element(range.startContainer)?.closest('.textLayer');
    // Do not combine unrelated pages or selections outside the PDF.
    if (!layer || element(range.endContainer)?.closest('.textLayer') !== layer) return null;
    const doc = layer.ownerDocument;
    const walker = doc.createTreeWalker(layer, NodeFilter.SHOW_TEXT);
    const entries = [];
    let text = '', node, previousRect;
    while ((node = walker.nextNode())) {
      if (!node.textContent || !node.parentElement.closest('span')) continue;
      const rect = node.parentElement.getBoundingClientRect();
      if (previousRect) {
        const lineChange = Math.abs(rect.top - previousRect.top) > Math.max(rect.height, previousRect.height) * 0.5;
        const paragraph = Math.abs(rect.top - previousRect.top) > Math.max(rect.height, previousRect.height) * 1.9;
        const headingChange = lineChange && Math.max(rect.height, previousRect.height) > Math.min(rect.height, previousRect.height) * 1.2;
        const columnChange = lineChange && rect.left > previousRect.right + rect.height;
        if (paragraph || headingChange || columnChange) text += '\n\n';
        else if (lineChange) text += '\n';
        else if (rect.left - previousRect.right > rect.height * 0.12) text += ' ';
      }
      entries.push({ node, start: text.length, end: text.length + node.textContent.length });
      text += node.textContent;
      previousRect = rect;
    }
    // Range boundary points may be element offsets (triple-click / select-all), too.
    const selected = entries.filter(entry => range.intersectsNode(entry.node));
    if (!selected.length) return null;
    const first = selected[0], last = selected[selected.length - 1];
    const start = first.start + (range.startContainer === first.node ? range.startOffset : 0);
    let end = last.start + (range.endContainer === last.node ? range.endOffset : last.node.length);
    if (range.collapsed) end = Math.min(text.length, start + 1);
    if (end < start) return null;
    const bounds = sentenceBounds(text, start, end);
    const from = entries.find(entry => entry.end > bounds.start);
    const to = entries.find(entry => entry.end >= bounds.end);
    if (!from || !to) return null;
    const expanded = doc.createRange();
    expanded.setStart(from.node, Math.max(0, bounds.start - from.start));
    expanded.setEnd(to.node, Math.min(to.node.length, bounds.end - to.start));
    return { range: expanded, text: normalize(text.slice(bounds.start, bounds.end)) };
  }

  root.PdfSentenceSelection = { sentenceBounds, normalize, expandRange };
})(typeof window === 'undefined' ? globalThis : window);
