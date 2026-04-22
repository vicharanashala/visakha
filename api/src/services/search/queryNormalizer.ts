import { distance } from "fastest-levenshtein";
import { LRUCache } from "lru-cache";

// 1. Maintain in-memory cache for normalized queries
const queryCache = new LRUCache<string, string>({
  max: 1000,
});

const DOMAIN_DICTIONARY = [
  "what", "is", "the", "this", "internship", "vinternship", "stipend",
  "apply", "application", "certificate", "eligibility", "breakout",
  "session", "attendance", "mern", "bootcamp", "program", "who", "when",
  "how", "about", "nptel", "mongodb", "react", "node", "express", "tech", "stack"
];

// Always map these exactly, avoiding distance cost
const SPECIFIC_FIXES: Record<string, string> = {
  "si": "is",
  "hte": "the",
  "wht": "what",
  "hw": "how",
  "aplly": "apply",
  "stiepnd": "stipend",
  "intnreship": "internship",
  "thsi": "this"
};

// Safe threshold for edit distance
function getMaxDistance(word: string): number {
  if (word.length <= 3) return 0; // Strict exact match for tiny words unless in specific fixes
  if (word.length <= 5) return 1; // 1 typo allowed for small words
  return 2; // Auto-correct threshold: max edit distance <= 2 for longer words
}

export function normalizeQuery(query: string): string {
  if (!query) return "";
  
  // 1. lowercase, trim, remove punctuation
  const cleanStr = query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");

  // Check cache before processing
  if (queryCache.has(cleanStr)) {
      return queryCache.get(cleanStr)!;
  }

  // 2. tokenize words
  const words = cleanStr.split(" ");

  // 3. correct each word iteratively
  const correctedWords = words.map(word => {
    // A. Grammar/Phrase exceptions
    if (SPECIFIC_FIXES[word]) return SPECIFIC_FIXES[word];

    // B. Exact keep (valid dictionary words)
    if (DOMAIN_DICTIONARY.includes(word)) {
      return word;
    }

    // C. Nearest Match
    let bestMatch = word;
    let minDistance = Infinity;
    
    // Never allow distance > 2 as per safe correction threshold rule
    const maxAllowedDist = getMaxDistance(word);

    // Skip distance check for very small words that weren't in dictionary or fixes
    if (maxAllowedDist === 0) {
        return word;
    }

    for (const dictWord of DOMAIN_DICTIONARY) {
      const dist = distance(word, dictWord);
      
      // Strict thresholding: distance <= maxAllowed && dist <= 2
      if (dist <= maxAllowedDist && dist <= 2 && dist < minDistance) {
        minDistance = dist;
        bestMatch = dictWord;
      }
    }

    // if confidence met (e.g. minDistance <= 2), keep it. Otherwise, return original word to avoid overcorrection.
    return bestMatch;
  });

  // 4. rebuild corrected sentence
  const finalQuery = correctedWords.join(" ");
  
  // Save to cache
  queryCache.set(cleanStr, finalQuery);
  
  return finalQuery;
}
