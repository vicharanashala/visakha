import { parseFaqTxt } from "./src/services/faqParser/faqParser.js";
const items = parseFaqTxt("./faq.txt");
const t7 = items.filter(i => i.topicNo === 7);
console.log("Topic 7 count:", t7.length);
t7.forEach(i => console.log(i.displayIndex, "-", i.question.slice(0,60)));
const allByTopic = {};
items.forEach(i => { allByTopic[i.topicNo] = (allByTopic[i.topicNo] || 0) + 1; });
console.log("All counts:", JSON.stringify(allByTopic));
