// The tree is built once per Eleventy build by src/_data/tree.js; the
// eleventy.after hook in eleventy.config.js reads it from here to copy files.
let current;
export const setCurrentTree = (t) => {
	current = t;
};
export const getCurrentTree = () => current;
