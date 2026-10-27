import fs from 'node:fs';
import path from 'node:path';
import { EleventyHtmlBasePlugin } from '@11ty/eleventy';
import { getCurrentTree } from './lib/current.js';

export default function (eleventyConfig) {
	// PATH_PREFIX (e.g. /pr-preview/pr-12) lets the site live in a sub-path: the plugin prefixes every root-absolute link and src in the built HTML.
	eleventyConfig.addPlugin(EleventyHtmlBasePlugin);
	eleventyConfig.addWatchTarget('content/');
	eleventyConfig.addPassthroughCopy({ 'src/style.css': 'style.css', 'src/assets': '/' });

	const dateFmt = new Intl.DateTimeFormat('sl-SI', { dateStyle: 'long', timeZone: 'UTC' });
	eleventyConfig.addFilter('dateSl', (iso) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : ''));

	// RSS needs absolute URLs: make root-relative links and images in post HTML absolute.
	eleventyConfig.addFilter('absolutize', (html, base) => html.replace(/(href|src)="\//g, `$1="${base}/`));
	eleventyConfig.addFilter('rfc822', (iso) => new Date(`${iso}T12:00:00Z`).toUTCString());
	// Control characters are not allowed in XML at all, not even inside CDATA.
	const xmlClean = (s) => s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, '');
	eleventyConfig.addFilter('xmlClean', xmlClean);
	eleventyConfig.addFilter('cdata', (s) => `<![CDATA[${xmlClean(s).replaceAll(']]>', ']]]]><![CDATA[>')}]]>`);

	// content/ files (documents, images) are served next to their page, under slugified paths.
	eleventyConfig.on('eleventy.after', ({ dir }) => {
		for (const { src, url } of getCurrentTree().files) {
			const dest = path.join(dir.output, decodeURI(url));
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			fs.copyFileSync(src, dest);
		}
	});

	return { pathPrefix: process.env.PATH_PREFIX || '/', dir: { input: 'src', output: '_site' } };
}
