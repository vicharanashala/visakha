import { parseFaqTxt } from "./src/services/faqParser/faqParser.js";

const items = parseFaqTxt("./faq.txt");
const byTopic: Record<number, number> = {};
items.forEach(i => { byTopic[i.topicNo] = (byTopic[i.topicNo] || 0) + 1; });
console.log("Total items:", items.length);
console.log("By topic:", JSON.stringify(byTopic, null, 2));
console.log("\nTopic 7 questions:");
items.filter(i => i.topicNo === 7).forEach(i => console.log(" ", i.displayIndex, "-", i.question.slice(0, 70)));
