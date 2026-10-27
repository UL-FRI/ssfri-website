// Flags suspicious markdown in content/ (mostly leftovers of the HTML conversion).
//   node scripts/lint-md.mjs        prints file:line problems, exits 1 if any
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT, buildTree } from '../lib/tree.js';

const problems = [];
const report = (file, line, rule, msg) => problems.push({ file, line, rule, msg });

const files = fs
	.readdirSync(CONTENT, { recursive: true })
	.filter((f) => f.endsWith('.md'))
	.sort();
for (const rel of files) {
	const src = fs.readFileSync(path.join(CONTENT, rel), 'utf8');
	const fm = /^---\n([\s\S]*?)\n---\n?/.exec(src);
	if (!fm) {
		report(rel, 1, 'frontmatter', 'missing frontmatter');
		continue;
	}
	const front = fm[1];
	const bodyStart = fm[0].split('\n').length - 1; // lines before the body
	const body = src.slice(fm[0].length);
	const lines = body.split('\n');
	const at = (i) => bodyStart + i + 1;

	if (!/^title: ".+"$/m.test(front) && !/(^|\/)index\.md$/.test(rel)) report(rel, 1, 'frontmatter', 'missing or empty title');
	const date = /^date: "([^"]*)"$/m.exec(front)?.[1];
	if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) report(rel, 1, 'frontmatter', `bad date ${date}`);
	if (!body.trim() && !/(^|\/)index\.md$/.test(rel)) report(rel, 1, 'empty-body', 'page has no text');

	if (/\n{3,}/.test(body)) {
		const i = body.indexOf('\n\n\n');
		report(rel, at(body.slice(0, i).split('\n').length - 1), 'blank-lines', 'multiple blank lines');
	}
	if (/\n\n$/.test(body) || (body.length && !body.endsWith('\n'))) report(rel, at(lines.length - 1), 'eof', 'file should end with exactly one newline');
	if (/\\\s*$/.test(body)) report(rel, at(lines.length - 1), 'eof-backslash', 'file ends with a backslash');

	// paragraph-level checks, outside fenced code
	let inCode = false;
	let para = [];
	const flush = (endIdx) => {
		if (!para.length) return;
		const first = endIdx - para.length;
		const text = para.join('\n');
		const plain = text.replace(/\\\*/g, '').replace(/`[^`]*`/g, '');
		if ((plain.match(/\*\*/g) ?? []).length % 2) report(rel, at(first), 'unclosed-bold', 'odd number of ** in paragraph');
		for (const m of plain.matchAll(/\*\*([^*\n]+?)\*\*/g)) {
			if (/^\s|\s$/.test(m[1])) {
				report(rel, at(first), 'bold-space', `whitespace inside ** pair: "${m[0].slice(0, 50)}" (will not render bold)`);
				break;
			}
		}
		if (/\\$/.test(para[para.length - 1])) report(rel, at(endIdx - 1), 'para-backslash', 'paragraph ends with a backslash (stray hard break)');
		para = [];
	};
	lines.forEach((line, i) => {
		if (/^```/.test(line)) {
			flush(i);
			inCode = !inCode;
			return;
		}
		if (inCode) return;
		if (!line.trim()) {
			flush(i);
			return;
		}
		para.push(line);

		if (/^#{1,6}\s*$/.test(line)) report(rel, at(i), 'empty-heading', 'heading without text');
		if (/(?<!!)\[[^\]]*\]\(\s*\)/.test(line)) report(rel, at(i), 'empty-link', 'link with empty target');
		if (/(?<!!)\[\s*\]\([^)]+\)/.test(line)) report(rel, at(i), 'empty-link', 'link with empty text');
		if (/&(nbsp|amp|lt|gt|quot|#\d+);/.test(line)) report(rel, at(i), 'entity', 'HTML entity left in text');
		if (/[\u00a0\u200b\ufeff\x00-\x08\x0b\x0c\x0e-\x1f]/.test(line)) report(rel, at(i), 'invisible-char', 'non-breaking space / zero-width / control character');
		if (/<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(line)) report(rel, at(i), 'raw-html', 'raw HTML tag');
		if (/^ {4,}\S/.test(line) && !para.slice(0, -1).length && !/^\s*([-*+]|\d+\.)\s/.test(line))
			report(rel, at(i), 'indented-code', 'indented line starts an accidental code block');
	});
	flush(lines.length);
}

// relative links that do not point at any file/page
for (const w of buildTree().warnings) report(w.split(':')[0], 0, 'unresolved-link', w.split(': ').slice(1).join(': '));

for (const p of problems) console.log(`${p.file}:${p.line}  [${p.rule}] ${p.msg}`);
const byRule = problems.reduce((a, p) => ((a[p.rule] = (a[p.rule] ?? 0) + 1), a), {});
console.log(`\n${files.length} files, ${problems.length} problems`, byRule);
process.exit(problems.length ? 1 : 0);
