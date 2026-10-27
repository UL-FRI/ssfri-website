// Builds the full-text search index into _site/pagefind (run after eleventy).
// Indexes the built pages plus the text of every .pdf/.docx in documents/.
import path from 'node:path';
import * as pagefind from 'pagefind';
import { buildTree } from '../lib/tree.js';
import { parseName } from '../lib/names.js';
import { extractText } from '../lib/doctext.js';

const SITE = path.resolve(import.meta.dirname, '../_site');
const { index } = await pagefind.createIndex({ forceLanguage: 'sl' });
if (!index) throw new Error('could not create the search index');

const pages = await index.addDirectory({ path: SITE });
console.log(`search: ${pages.page_count} pages`);

let docs = 0;
for (const { src, url } of buildTree().files) {
	if (!url.startsWith('/dokumenti/') || !/\.(pdf|docx)$/i.test(url)) continue;
	const content = extractText(src);
	if (!content) continue; // scanned PDFs have no text layer
	const folder = parseName(path.basename(path.dirname(src))).title;
	const title = `${parseName(path.basename(src, path.extname(src))).title} (${folder})`;
	await index.addCustomRecord({ url, content, language: 'sl', meta: { title } });
	docs++;
}
console.log(`search: ${docs} documents`);

await index.writeFiles({ outputPath: path.join(SITE, 'pagefind') });
await pagefind.close();
