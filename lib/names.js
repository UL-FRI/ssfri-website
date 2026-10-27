// Everything the site knows about names lives here: files, folders and .md
// pages are all named "[YYYY-MM-DD] [NN] Title", e.g. "2025-12-27 01 Redna.docx".

// Optional ISO date, then optional 1-3 digit number (must be followed by
// whitespace), then the title. "Mandat 2025-26" has neither, so it is all title.
export const NAME_RE = /^(?:(?<date>\d{4}-\d{2}-\d{2})(?:[\s_-]+|$))?(?:(?<number>\d{1,3})(?:\s+|$))?(?<title>.*)$/;

// Downloadable file types and their labels. Other files in a folder
// (images etc.) are still copied to the output, but not listed.
export const DOWNLOAD_TYPES = {
	pdf: 'PDF',
	docx: 'Word',
	doc: 'Word',
	odt: 'OpenDocument',
	rtf: 'RTF',
	xlsx: 'Excel',
	pptx: 'PowerPoint',
};

export function parseName(name) {
	const { date, number, title } = NAME_RE.exec(name).groups;
	const valid = date && new Date(`${date}T00:00:00Z`).toISOString().startsWith(date);
	if (date && !valid) return { date: null, number: null, title: name };
	return { date: date ?? null, number: number ?? null, title: title.trim() };
}

export function slugify(s) {
	return s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/đ/gi, 'd')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

// Accent/case-insensitive, length-preserving, so indexes carry over to the original.
const fold = (s) =>
	[...s]
		.map((c) => c.normalize('NFD')[0])
		.join('')
		.toLowerCase();

// Display name of a file inside a folder: strip the folder's name from the
// left; if nothing is left it is simply the download of that folder.
export function displayFileName(title, folderTitle) {
	const tokens = fold(folderTitle)
		.split(/[\s_-]+/)
		.filter(Boolean);
	if (tokens.length) {
		const esc = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		const m = new RegExp(`^${esc.join('[\\s_-]+')}(?:[\\s_-]+|$)`).exec(fold(title));
		if (m) title = title.slice(m[0].length);
	}
	return title.trim() || 'Prenos';
}
