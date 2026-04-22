import Fuse from "fuse.js";
import { normalizeQuery } from "./queryNormalizer.js";
// Fuse threshold -> lower is stricter. < 0.35 is a good balance for strong match.
const STRONG_MATCH_THRESHOLD = 0.35;
export function findStrongFaqMatch(query, allFaqs) {
    const normalizedQuery = normalizeQuery(query);
    const options = {
        includeScore: true,
        threshold: 0.5, // We'll return matches up to 0.5 but only use strong ones
        keys: ["question"] // We only fuzzy match against the question/title
    };
    const fuse = new Fuse(allFaqs, options);
    const results = fuse.search(normalizedQuery);
    if (results.length > 0) {
        const bestMatch = results[0];
        // Fuse score: 0 is a perfect match, 1 is a complete mismatch
        if (bestMatch && bestMatch.score !== undefined && bestMatch.score <= STRONG_MATCH_THRESHOLD) {
            return {
                match: bestMatch.item,
                score: 1 - bestMatch.score, // Invert score to match confidence style (1 = perfect)
            };
        }
    }
    return null;
}
//# sourceMappingURL=fuzzyFaqSearch.js.map