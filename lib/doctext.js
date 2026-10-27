// Plain text of a .pdf (pdftotext) or .docx (pandoc); null if unsupported or empty.
// `pages` limits a PDF to its first pages (a .docx is always read whole).
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function extractText(file, pages) {
	const ext = path.extname(file).toLowerCase();
	const r =
		ext === '.pdf'
			? spawnSync('pdftotext', [...(pages ? ['-l', String(pages)] : []), file, '-'], { encoding: 'utf8', maxBuffer: 64 << 20 })
			: ext === '.docx'
				? spawnSync('pandoc', [file, '-t', 'plain', '--wrap=none'], { encoding: 'utf8', maxBuffer: 64 << 20 })
				: null;
	return r?.status === 0 && r.stdout.trim() ? r.stdout : null;
}
