import { Router } from "express";
import { getOpenAIClient } from '../../../integrations/openai';

const router = Router();

// POST /resume/generate
// Body: { name, skills, experience, education, summary }
router.post('/generate', async (req, res) => {
  const { name, skills, experience, education, summary } = req.body;
  if (!name || !skills || !experience || !education) {
    return res.status(400).json({ success: false, message: "Missing required fields: name, skills, experience, education" });
  }

  const prompt = `You are a professional resume writer. Generate a clean, modern resume in plain text format for the following user. Use clear section headings (e.g., Summary, Skills, Experience, Education). Do not include any fake data.\n\nName: ${name}\nSummary: ${summary || ''}\nSkills: ${(Array.isArray(skills) ? skills.join(', ') : skills)}\nExperience: ${(Array.isArray(experience) ? experience.map(e => `- ${e}`).join('\n') : experience)}\nEducation: ${(Array.isArray(education) ? education.map(e => `- ${e}`).join('\n') : education)}\n\nResume:`;

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a professional resume writer." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 800,
    });
    const text = completion.choices?.[0]?.message?.content || "";
    return res.json({ success: true, resume: text });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Resume generation failed", error: (error as Error).message });
  }
});

export default router;
