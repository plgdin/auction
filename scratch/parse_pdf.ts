import fs from 'fs';
import pdf from 'pdf-parse';

async function parse() {
  const dataBuffer = fs.readFileSync('public/FAQ-based-on-Scrap-Buyers-meet-during-the-Grievance-Redress-Camp-held-on-30-10-2022.pdf');
  const data = await pdf(dataBuffer);
  fs.writeFileSync('scratch/faq_text.txt', data.text);
  console.log('PDF text successfully written to scratch/faq_text.txt');
}

parse();
