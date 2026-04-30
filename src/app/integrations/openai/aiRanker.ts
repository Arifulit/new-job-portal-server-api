import { getOpenAIClient } from "./index";

export async function scoreCandidateWithAI(jobDescription: string, candidate: any): Promise<{ score: number; reasons: string[] }> {
  const openai = getOpenAIClient();

  // Build a concise candidate summary
  const candidateSummaryParts: string[] = [];
  if (candidate.name) candidateSummaryParts.push(`Name: ${candidate.name}`);
  if (candidate.skills && Array.isArray(candidate.skills)) candidateSummaryParts.push(`Skills: ${candidate.skills.join(", ")}`);
  if (typeof candidate.experience !== 'undefined') candidateSummaryParts.push(`YearsExperience: ${candidate.experience}`);
  if (candidate.bio) candidateSummaryParts.push(`Bio: ${candidate.bio}`);
  if (candidate.location) candidateSummaryParts.push(`Location: ${candidate.location}`);

  const candidateSummary = candidateSummaryParts.join("\n");

  const prompt = `You are an assistant that scores how well a candidate matches a job description.

Job Description:
${jobDescription}

Candidate:
${candidateSummary}

Return a JSON object with keys:\n- score: integer 0-100 (higher means better match)\n- reasons: array of short reasons (3 max) explaining the score.\nOnly return the JSON object and nothing else.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are an expert recruiter and career advisor." },
      { role: "user", content: prompt },
    ],
    temperature: 0.0,
    max_tokens: 300,
  });

  const text = completion.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(text);
    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 0;
    const reasons = Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [String(parsed.reasons ?? '')];
    return { score, reasons };
  } catch (e) {
    // If parsing fails, return conservative defaults
    return { score: 0, reasons: [text.slice(0, 300)] };
  }
}
