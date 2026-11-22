import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const requireApi = createRequire(new URL('../../api-server/package.json', import.meta.url));
const { build } = await import(requireApi.resolve('esbuild'));
const output = new URL('../dist/ranking-pdf-actions-test.mjs', import.meta.url);
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });

await build({
  entryPoints: [new URL('../src/components/ranking-pdf-actions.tsx', import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  jsx: 'automatic',
  packages: 'external',
  alias: { '@': new URL('../src/', import.meta.url).pathname },
  plugins: [{
    name: 'ranking-pdf-hooks',
    setup(builder) {
      builder.onResolve({ filter: /^react$/ }, () => ({ path: 'hooks', namespace: 'ranking-pdf-hooks' }));
      builder.onLoad({ filter: /.*/, namespace: 'ranking-pdf-hooks' }, () => ({
        contents: 'export const useState = initial => globalThis.rankingPdfTestState.useState(initial)',
      }));
    },
  }],
});

const { RankingPdfActions } = await import(output.href);
const report = {
  title: 'Ranking geral de lojas',
  period: '01 nov. 2026 a 21 nov. 2026',
  summary: '2 lojas',
  variant: 'stores',
  sections: [{
    columns: [
      { key: 'position', header: 'Pos.', width: 55 },
      { key: 'store', header: 'Loja', width: 500 },
      { key: 'points', header: 'Pontos', width: 210 },
    ],
    rows: [
      { position: 1, store: 'Loja Belo Horizonte', points: '740 pts' },
      { position: 2, store: 'Loja Divinópolis', points: '700 pts' },
    ],
  }],
};

async function setup({ canShare = true, shareError } = {}) {
  const state = [];
  let cursor = 0;
  const calls = { shares: [], downloads: 0 };
  globalThis.rankingPdfTestState = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = initial;
      return [state[slot], (value) => { state[slot] = value; }];
    },
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      canShare: () => canShare,
      share: async (payload) => {
        calls.shares.push(payload);
        if (shareError) throw shareError;
      },
    },
  });
  globalThis.document = undefined;
  globalThis.window = undefined;
  const render = () => {
    cursor = 0;
    return RankingPdfActions({ report, fromDate: '2026-11-01', toDate: '2026-11-21' });
  };
  const find = (testId) => {
    const visit = (node) => {
      if (!node || typeof node !== 'object') return undefined;
      if (node.props?.['data-testid'] === testId) return node;
      return [node.props?.children].flat(Infinity).map(visit).find(Boolean);
    };
    return visit(render());
  };
  return { calls, find, render };
}

async function waitForGeneration(test) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (!test.find('button-generate-stores-ranking-pdf')?.props.disabled) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

for (const config of [{}, { canShare: false }]) {
  const test = await setup(config);
  test.find('button-generate-stores-ranking-pdf').props.onClick();
  await waitForGeneration(test);
  const notice = test.render().props.children;
  assert.ok(notice, 'PDF generation should render the available follow-up actions');
  assert.ok(test.find('button-download-stores-ranking-pdf'), `Generated report should always be downloadable; notice: ${JSON.stringify(notice)}`);
  const shareButton = test.find('button-share-stores-ranking-pdf');
  assert.equal(Boolean(shareButton), config.canShare !== false);
  if (shareButton) {
    await shareButton.props.onClick();
    assert.equal(test.calls.shares.length, 1);
    assert.equal(test.calls.shares[0].files[0].type, 'application/pdf');
  } else {
    const message = JSON.stringify(test.render().props.children);
    assert.ok(message.includes('baixar'), 'Unsupported file sharing should retain a clear download path');
  }
  globalThis.document = {
    body: { appendChild() {} },
    createElement: () => ({ click() { test.calls.downloads += 1; }, remove() {} }),
  };
  globalThis.window = { setTimeout() {} };
  test.find('button-download-stores-ranking-pdf').props.onClick();
  assert.equal(test.calls.downloads, 1);
}

console.log('Ranking PDF action tests passed: generated files can be shared or downloaded on supported and unsupported devices.');
