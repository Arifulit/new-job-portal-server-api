// Resume PDF parsing utility

// pdf-parse import নিয়ে সমস্যা হলে এই পদ্ধতি ব্যবহার করুন।
// এটি CommonJS ও ESM দুইভাবেই কাজ করবে।
// Bangla: pdf-parse লাইব্রেরি import/require সমস্যা সমাধান

export async function extractTextFromPdf(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  let pdfParse: any;
  try {
    pdfParse = require('pdf-parse');
  } catch (e) {
    pdfParse = (await import('pdf-parse')).default;
  }
  const data = await pdfParse(dataBuffer);
  return data.text;
}
