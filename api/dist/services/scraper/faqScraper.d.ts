export interface ScrapedResult {
    title: string;
    question: string;
    content: string;
    sourceUrl: string;
}
export declare function scrapeFaqPages(urls: string[]): Promise<ScrapedResult[]>;
//# sourceMappingURL=faqScraper.d.ts.map