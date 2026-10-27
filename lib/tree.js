// Walks content/ and turns it into a flat list of pages (folders and .md files), each with its breadcrumb and a listing of its children, plus the files to copy.
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import { parseName, slugify, displayFileName, DOWNLOAD_TYPES } from './names.js';

export const CONTENT = path.resolve(import.meta.dirname, '../content');

const MOUNTS = [
	{ dir: 'pages', url: '/', title: 'Domov', stripDate: true },
	{ dir: 'articles', url: '/novice/', title: 'Novice', stripDate: true, yearPrefix: true },
	{ dir: 'documents', url: '/dokumenti/', title: 'Dokumenti', stripDate: false, listing: true },
];

const md = new MarkdownIt({ html: true, linkify: true });
md.core.ruler.push('relative_links', (state) => {
	const { resolve } = state.env;
	for (const block of state.tokens) {
		for (const t of block.children ?? []) {
			if (t.type === 'link_open') t.attrSet('href', resolve(t.attrGet('href')));
			if (t.type === 'image') t.attrSet('src', resolve(t.attrGet('src')));
		}
	}
});

const isoDate = (v) => (v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : '').slice(0, 10) || null;
const collator = new Intl.Collator('sl', { numeric: true });

function urlSegment(name, mount, isFile) {
	if (isFile) {
		const ext = path.extname(name).toLowerCase();
		return slugify(path.basename(name, path.extname(name))) + ext;
	}
	const { date, title } = parseName(name);
	const slug = slugify(mount.stripDate ? title : name) || slugify(name);
	return mount.yearPrefix && date ? `${date.slice(0, 4)}/${slug}` : slug;
}

// `source:` is a full URL or just a path on the previous site; only the path is kept.
const OLD_ORIGIN = 'https://svet.fri.uni-lj.si';
const sourcePath = (source) => {
	const { pathname } = new URL(source, OLD_ORIGIN);
	return decodeURI(pathname).replace(/\/?$/, '/');
};

function sortRows(rows, order) {
	const dir = order === 'desc' ? -1 : 1;
	const cmp = (a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (+a.number || 0) - (+b.number || 0) || collator.compare(a.title, b.title);
	return rows.sort((a, b) => dir * cmp(a, b));
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
function excerpt(html, max = 240) {
	const text = html
		.replace(/<[^>]*>/g, ' ')
		.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e])
		.replace(/\s+/g, ' ')
		.trim();
	if (text.length <= max) return text;
	return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

const PAGE_SIZE = 10;
const FEED_SIZE = 20;

// Articles without any other tag get this one
const UNSORTED = 'Nerazvrščeno';
const tagOf = (name) => ({ name, url: `/novice/oznaka/${slugify(name)}/` });

// Splits posts into pages of PAGE_SIZE. Each page carries its numbered links:
// 1 … n-2 n-1 [n] n+1 n+2 … last, with `gap` entries for the ellipses.
function paginate(heading, base, posts) {
	const total = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
	const url = (n) => (n === 1 ? base : `${base}${n}/`);
	return Array.from({ length: total }, (_, i) => {
		const number = i + 1;
		const shown = [...new Set([1, total, ...[-2, -1, 0, 1, 2].map((d) => number + d)])].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
		const links = shown.flatMap((n, j) => [...(j && n - shown[j - 1] > 1 ? [{ gap: true }] : []), { number: n, url: url(n), current: n === number }]);
		return {
			heading,
			url: url(number),
			number,
			total,
			links,
			feed: `${base}feed.xml`,
			prev: number > 1 ? url(number - 1) : null,
			next: number < total ? url(number + 1) : null,
			items: posts.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE).map(({ title, url, date, tags, image, excerpt }) => ({ title, url, date, tags, image, excerpt })),
		};
	});
}

export function buildTree() {
	const nodes = [];
	const files = [];
	const pending = []; // nodes whose markdown still needs rendering
	const byPath = new Map(); // content path -> url, for resolving relative links
	const warnings = [];

	function makeNode({ id, kind, url, crumbs, parsed, data, body, sourceDir }) {
		url = data.source ? sourcePath(data.source) : url;
		const node = {
			id,
			kind,
			url,
			crumbs,
			title: data.title ?? parsed.title,
			date: isoDate(data.date) ?? parsed.date,
			number: data.number ?? parsed.number,
			tags: (data.tags ?? []).map(tagOf),
			listing: data.listing !== false,
			menu: data.menu ?? null,
			source: data.source ?? null,
			rows: [],
			html: '',
		};
		nodes.push(node);
		pending.push({ node, body, sourceDir, image: data.image });
		byPath.set(id, url);
		return node;
	}

	function walkFolder(mount, rel, url, crumbs, isRoot) {
		const abs = path.join(CONTENT, rel);
		const indexFile = path.join(abs, 'index.md');
		const { data, content } = fs.existsSync(indexFile) ? matter(fs.readFileSync(indexFile, 'utf8')) : { data: {}, content: '' };
		const parsed = isRoot ? { date: null, number: null, title: mount.title } : parseName(path.basename(rel));
		const node = makeNode({ id: rel, kind: 'folder', url, crumbs, parsed, data, body: content, sourceDir: rel });
		byPath.set(`${rel}/index.md`, node.url);
		const childCrumbs = mount.listing ? [...crumbs, { title: node.title, url: node.url }] : [];

		for (const ent of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
			if (ent.name.startsWith('.') || ent.name === 'index.md') continue;
			const childRel = `${rel}/${ent.name}`;
			const isMd = ent.isFile() && ent.name.endsWith('.md');
			const seg = urlSegment(isMd ? path.basename(ent.name, '.md') : ent.name, mount, ent.isFile() && !isMd);
			let row;
			if (ent.isDirectory()) {
				const child = walkFolder(mount, childRel, `${node.url}${seg}/`, childCrumbs, false);
				row = { ...child, kind: 'folder' };
			} else if (ent.name.endsWith('.md')) {
				const name = path.basename(ent.name, '.md');
				const { data: d, content: c } = matter(fs.readFileSync(path.join(abs, ent.name), 'utf8'));
				const child = makeNode({
					id: childRel,
					kind: 'page',
					url: `${node.url}${seg}/`,
					crumbs: childCrumbs,
					parsed: parseName(name),
					data: d,
					body: c,
					sourceDir: rel,
				});
				row = { ...child, kind: 'page' };
			} else {
				const ext = path.extname(ent.name).slice(1).toLowerCase();
				const fileUrl = `${node.url}${seg}`;
				byPath.set(childRel, fileUrl);
				files.push({ src: path.join(abs, ent.name), url: fileUrl });
				if (!mount.listing || !DOWNLOAD_TYPES[ext]) continue;
				const parsed = parseName(path.basename(ent.name, path.extname(ent.name)));
				const folderTitle = isRoot ? '' : parseName(path.basename(rel)).title;
				row = {
					kind: 'file',
					url: fileUrl,
					date: parsed.date,
					number: parsed.number,
					title: displayFileName(parsed.title, folderTitle),
				};
			}
			if (mount.listing) node.rows.push({ kind: row.kind, title: row.title, url: row.url, date: row.date, number: row.number });
		}
		sortRows(node.rows, data.order);
		node.columns = { date: node.rows.some((r) => r.date), number: node.rows.some((r) => r.number) };
		byPath.set(rel, node.url);
		return node;
	}

	const roots = MOUNTS.map((m) => walkFolder(m, m.dir, m.url, [], true));

	const resolveFrom = (sourceDir) => (href) => {
		if (/^[^/\s:]+@[^/\s]+$/.test(href)) return `mailto:${href}`;
		if (!href || /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) return href;
		const [, p, rest] = /^([^#?]*)(.*)$/.exec(href);
		let target;
		try {
			target = path.posix.join(sourceDir, decodeURI(p)).replace(/\/$/, '');
		} catch {
			return href;
		}
		const url = byPath.get(target);
		if (url === undefined) {
			warnings.push(`${sourceDir}: unresolved link ${href}`);
			return href;
		}
		return url + rest;
	};

	for (const { node, body, sourceDir, image } of pending) {
		const resolve = resolveFrom(sourceDir);
		node.html = md.render(body, { resolve });
		node.image = image ? resolve(encodeURI(image)) : null;
		node.excerpt = excerpt(node.html);
		if (node.id.startsWith('articles/') && !node.tags.length) node.tags = [tagOf(UNSORTED)];
	}

	const [, articlesRoot, documentsRoot] = roots;
	const posts = sortRows(
		nodes.filter((n) => n.id.startsWith('articles/')),
		'desc',
	);
	const menuPages = nodes.filter((n) => n.menu).sort((a, b) => a.menu - b.menu);
	const nav = [articlesRoot, documentsRoot, ...menuPages].map((n) => ({ title: n.title, url: n.url }));

	// The articles root is rendered as the paginated blog index, not as a node page;
	// every tag gets its own paginated index of the same kind.
	const byTag = new Map(); // tag url -> { name, posts }
	for (const post of posts) {
		for (const t of post.tags) byTag.set(t.url, { name: t.name, posts: [...(byTag.get(t.url)?.posts ?? []), post] });
	}
	const listings = [...paginate('Novice', '/novice/', posts), ...[...byTag].flatMap(([url, t]) => paginate(`Novice: ${t.name}`, url, t.posts))];
	// One RSS feed for all news and one per tag, newest first, with full content.
	const feedItems = (list) => list.slice(0, FEED_SIZE).map(({ title, url, date, html, excerpt }) => ({ title, url, date, html, excerpt }));
	const feeds = [
		{ url: '/novice/feed.xml', title: 'Novice', items: feedItems(posts) },
		...[...byTag].map(([url, t]) => ({ url: `${url}feed.xml`, title: `Novice: ${t.name}`, items: feedItems(t.posts) })),
	];

	const home = roots[0];
	return { listings, feeds, home, nodes: nodes.filter((n) => n !== articlesRoot && n !== home), files, nav, posts, latest: posts.slice(0, 5), warnings };
}
