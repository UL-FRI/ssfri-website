// Public address of the site (feeds need absolute URLs). Set SITE_URL to the origin (e.g. https://svet.fri.uni-lj.si) and PATH_PREFIX if the site lives in a sub-path.
const origin = (process.env.SITE_URL || 'https://svet.fri.uni-lj.si').replace(/\/$/, '');
const prefix = (process.env.PATH_PREFIX || '').replace(/\/$/, '');

export default { url: origin + prefix };
