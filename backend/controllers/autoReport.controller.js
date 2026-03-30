import fetch from 'node-fetch';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '-';

const SYSTEM_PROMPT = `You are a senior consultant radiologist with 20+ years of experience generating comprehensive, publication-quality radiology reports. Given the doctor's findings/observations, generate a highly detailed professional radiology report.

STRICT OUTPUT FORMAT:

Procedure: -
- Describe the exact imaging technique, slice thickness, plane of acquisition, contrast administration details (if any), and any relevant protocol specifics based on the modality and body part.

FINDINGS: -
- Provide exhaustive, systematic findings covering EVERY anatomical structure relevant to the study.
- Each finding must be a separate bullet point with detailed descriptions.
- For each structure, describe: morphology, signal/density characteristics, dimensions (if abnormal), and any pathological changes.
- Always include pertinent negatives (e.g., "No evidence of...", "No abnormal...") for key structures even if normal.
- Systematically cover all relevant anatomy in logical order:
  * For Brain: parenchyma, gray-white differentiation, midline structures, ventricles, basal ganglia, thalami, cerebellum, brainstem, CP angles, sella/pituitary, orbits, paranasal sinuses, mastoids, calvarium, scalp soft tissues
  * For Chest: lungs (each lobe), airways, mediastinum, heart/pericardium, great vessels, pleura, chest wall, bones, soft tissues
  * For Abdomen: liver, gallbladder, bile ducts, pancreas, spleen, kidneys, adrenals, aorta, bowel, bladder, lymph nodes, bones, soft tissues
  * For Spine: vertebral bodies, disc spaces, spinal cord, nerve roots, facet joints, paravertebral soft tissues
  * For MSK: bones, joints, ligaments, tendons, muscles, soft tissues
- Include measurements for any abnormalities found.
- Describe any incidental findings.

OPINION: -
- Provide a numbered list of impressions/conclusions in order of clinical significance.
- Each impression should be specific and actionable.
- Include differential diagnoses where appropriate.
- Suggest follow-up or correlation if clinically indicated.

IMPORTANT RULES:
- Use standard radiological terminology and nomenclature.
- Be thorough — missing a finding is worse than being verbose.
- Match the level of detail to what a senior radiologist would dictate.
- Format findings as clean bullet points with bullet character "•".
- If the doctor's input mentions trauma, always comment on soft tissue swelling, fractures, and associated findings.
- Always correlate findings with the provided clinical history.`;

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
        max_tokens: 4000
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
