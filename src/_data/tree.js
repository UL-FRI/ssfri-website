import { buildTree } from '../../lib/tree.js';
import { setCurrentTree } from '../../lib/current.js';

export default function () {
	const tree = buildTree();
	setCurrentTree(tree);
	if (tree.warnings.length) {
		console.warn(`[tree] ${tree.warnings.length} unresolved relative links, e.g.:\n  ${tree.warnings.slice(0, 5).join('\n  ')}`);
	}
	return tree;
}
