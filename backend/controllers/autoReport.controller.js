import fetch from 'node-fetch';

// const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_KEY = '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';

const SYSTEM_PROMPT = `You are an expert radiologist report generator. Given the doctor's findings/observations, generate a professional radiology report in the following format:

Procedure: -
[Describe the imaging procedure performed]

FINDINGS: -
[Bullet-pointed findings based on the doctor's input]

OPINION: -
[Summary opinion based on findings]

Use professional medical terminology. Keep findings as bullet points. Be concise and clinically accurate.`;

export const generateAutoReport = async (req, res) => {
  try {
    const { findings, modality, bodyPart, clinicalHistory } = req.body;

    if (!findings || !findings.trim()) {
      return res.status(400).json({ success: false, message: 'Findings are required' });
    }

    const userPrompt = `Generate a radiology report based on the following:
Modality: ${modality || 'Not specified'}
Body Part: ${bodyPart || 'Not specified'}
Clinical History: ${clinicalHistory || 'Not provided'}

Doctor's Findings/Observations:
${findings}

Generate the complete report in the standard format with Procedure, FINDINGS, and OPINION sections.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      return res.status(500).json({ success: false, message: 'Failed to generate report from AI' });
    }

    const data = await response.json();
    const generatedReport = data.choices?.[0]?.message?.content;

    if (!generatedReport) {
      return res.status(500).json({ success: false, message: 'No report generated' });
    }

    // Convert to HTML format
    const htmlReport = generatedReport
      .replace(/\n/g, '<br>')
      .replace(/•/g, '&#8226;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    res.json({
      success: true,
      data: {
        report: generatedReport,
        htmlReport: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${htmlReport}</div>`
      }
    });
  } catch (error) {
    console.error('Auto report generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
};
