import {} from "./faqScraper.js";
export function preprocessAndChunk(data) {
    const CHUNK_SIZE = 500;
    const CHUNK_OVERLAP = 100;
    const chunks = [];
    for (const item of data) {
        // 1. Normalize whitespace
        let cleanContent = item.content
            .replace(/\s+/g, " ")
            .replace(/\s*\n\s*/g, "\n")
            .trim();
        // 2. Reject useless short text
        if (cleanContent.length < 30) {
            continue;
        }
        // 3. Chunking logic
        let currentIndex = 0;
        let chunkIndex = 0;
        // Fast-path if the whole content fits nicely
        if (cleanContent.length <= CHUNK_SIZE) {
            chunks.push({
                title: item.title,
                question: item.question,
                content: cleanContent,
                chunkIndex: 0,
                sourceUrl: item.sourceUrl,
            });
            continue;
        }
        while (currentIndex < cleanContent.length) {
            let chunkText = cleanContent.slice(currentIndex, currentIndex + CHUNK_SIZE);
            // Try to break at a word boundary to avoid middle-of-word cuts
            if (currentIndex + CHUNK_SIZE < cleanContent.length) {
                const lastSpaceIndex = chunkText.lastIndexOf(" ");
                if (lastSpaceIndex > CHUNK_SIZE - 100) { // Only do this if we don't lose too much size
                    chunkText = chunkText.slice(0, lastSpaceIndex);
                }
            }
            chunks.push({
                title: item.title,
                question: item.question,
                content: chunkText.trim(),
                chunkIndex,
                sourceUrl: item.sourceUrl,
            });
            currentIndex += (chunkText.length - CHUNK_OVERLAP);
            // Ensure we always move forward
            if (chunkText.length - CHUNK_OVERLAP <= 0) {
                currentIndex += CHUNK_SIZE;
            }
            chunkIndex++;
        }
    }
    return chunks;
}
//# sourceMappingURL=preprocess.js.map