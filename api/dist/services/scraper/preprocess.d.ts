import { type ScrapedResult } from "./faqScraper.js";
export interface ChunkedResult {
    title: string;
    question: string;
    content: string;
    chunkIndex: number;
    sourceUrl: string;
}
export declare function preprocessAndChunk(data: ScrapedResult[]): ChunkedResult[];
//# sourceMappingURL=preprocess.d.ts.map