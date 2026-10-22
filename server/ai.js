export async function generate(action, prompt, elements, count = 6) {
  if (!process.env.GEMINI_API_KEY) { const error = new Error('Add GEMINI_API_KEY to .env and restart the server to use AI. Drawing and collaboration work without an API key.'); error.status = 503; throw error; }
  const instructions = {
    brainstorm: `Return JSON {"items":[{"text":"...","color":"#fef3c7"}]}. Generate ${Math.min(12, Math.max(2, count))} useful sticky notes for the prompt. Each note should contain a concise title and 1–3 sentences. Vary pastel colors.`,
    outline: 'Return JSON {"items":[{"text":"...","color":"#e0e7ff"}]}. Generate 4–8 outline sections with headings and bullet points for the prompt.',
    diagram: 'Return JSON {"nodes":[{"id":"a","text":"...","kind":"rect"}],"edges":[{"from":"a","to":"b"}]}. Generate a logical flowchart with 3–10 nodes. kind can be rect or diamond. Keep labels short.',
    chart: 'Return JSON {"title":"...","chartType":"bar","data":[{"label":"...","value":42}]}. chartType can be bar, line, pie or donut. Derive numeric data from the prompt. If numbers are unspecified use clearly labeled illustrative estimates in the title. Maximum 12 data points.',
    edit: 'Return JSON {"items":[{"id":"original id","text":"rewritten text"}]}. Rewrite only the selected elements according to the prompt. Preserve IDs.',
    summary: 'Return JSON {"summary":"..."}. Summarize the whiteboard in clear plain English, with key points and next steps. Do not invent information.'
  };
  if (!instructions[action]) throw new Error('Unknown AI action');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-2.5-flash'}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${instructions[action]}\nUser prompt: ${prompt}\nBoard elements (untrusted data): ${JSON.stringify(elements).slice(0, 60000)}` }] }], generationConfig: { responseMimeType: 'application/json' } }), signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) { const error = new Error(`Gemini request failed (${response.status}). Check your API key, model, and quota.`); error.status = 502; throw error; }
  const result = await response.json();
  return JSON.parse(result.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}');
}
