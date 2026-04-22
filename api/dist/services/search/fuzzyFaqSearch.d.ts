export interface FaqRecord {
    _id?: any;
    question: string;
    answer: string;
    sourceType: string;
    url?: string;
    embedding?: number[];
    [key: string]: any;
}
export declare function findStrongFaqMatch(query: string, allFaqs: FaqRecord[]): {
    match: FaqRecord;
    score: number;
} | null;
//# sourceMappingURL=fuzzyFaqSearch.d.ts.map