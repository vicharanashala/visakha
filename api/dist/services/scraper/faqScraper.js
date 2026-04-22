import * as cheerio from "cheerio";
export async function scrapeFaqPages(urls) {
    const results = [];
    for (const url of urls) {
        try {
            console.log(`Scraping URL: ${url}`);
            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Failed to fetch ${url} - Status: ${response.status}`);
                continue;
            }
            const html = await response.text();
            const $ = cheerio.load(html);
            // Remove irrelevant parts
            $('nav, footer, .menu, script, style, header, iframe, noscript, link').remove();
            // For the specific internship FAQ page structure, questions are usually headings (h2, h3, h4) 
            // or specific classes like .faq-question, .accordion.
            // Let's implement a general heuristic: find headings, and grab the content until the next heading.
            const title = $('title').text().trim() || "Internship FAQ";
            // Specifically for GitHub pages, main content is usually in an article or main tag.
            const mainContent = $('main, article, .content').length > 0 ? $('main, article, .content') : $('body');
            const elements = mainContent.find('h1, h2, h3, h4, h5, p, li, div');
            let currentQuestion = "";
            let currentContent = "";
            elements.each((_, el) => {
                const tagName = el.tagName.toLowerCase();
                const text = $(el).text().trim();
                if (!text)
                    return;
                // If it's a heading (but not h1 which is usually page title)
                if (['h2', 'h3', 'h4', 'h5'].includes(tagName)) {
                    // Save precious question if exists
                    if (currentQuestion && currentContent.trim().length > 10) {
                        results.push({
                            title,
                            question: currentQuestion,
                            content: currentContent.trim(),
                            sourceUrl: url
                        });
                    }
                    currentQuestion = text;
                    currentContent = "";
                }
                else if (tagName === 'p' || tagName === 'li' || tagName === 'div') {
                    // Only add paragraph/div text if it has meaningful length and we have a current question
                    if (text.length > 20 && currentQuestion) {
                        currentContent += text + "\n";
                    }
                }
            });
            // Push the last one
            if (currentQuestion && currentContent.trim().length > 10) {
                results.push({
                    title,
                    question: currentQuestion,
                    content: currentContent.trim(),
                    sourceUrl: url
                });
            }
        }
        catch (error) {
            console.error(`Error scraping ${url}:`, error);
        }
    }
    // Deduplicate by question text
    const uniqueResults = [];
    const seenQuestions = new Set();
    for (const res of results) {
        if (!seenQuestions.has(res.question)) {
            seenQuestions.add(res.question);
            uniqueResults.push(res);
        }
    }
    return uniqueResults;
}
//# sourceMappingURL=faqScraper.js.map