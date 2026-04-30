
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
import { extractTextFromPdf } from "./pdfUtil";

export async function analyzeResumeWithOpenAI(resumeFilePath: string) {
  // Extract text from PDF
  const resumeText = await extractTextFromPdf(resumeFilePath);
  // You can customize the prompt as needed
  const prompt = `Analyze the following resume text. Extract:
Skills
Score out of 100 (score)
Suggest missing skills for a backend engineer
Give improvement suggestions

Resume:
${resumeText}

Return JSON with keys: score, skills (array), missingSkills (array), suggestions (array).`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a helpful resume analyzer." },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    max_tokens: 500,
  });

  const text = completion.choices[0]?.message?.content || "";
  try {
    const result = JSON.parse(text);
    return result;
  } catch {
    return {
      score: null,
      skills: [],
      missingSkills: [],
      suggestions: [text],
    };
  }
}
