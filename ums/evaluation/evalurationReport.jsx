const { React } = ctx.libs;
const { useRef, useState, useEffect, forwardRef } = React;
const { Button, Checkbox } = ctx.libs.antd;

// 1. Fetch Data
const { data: { data: questions } } = await ctx.api.request({ url: 'evaluationQuestion:list' });
const { data: { data: results } } = await ctx.api.request({
  url: 'schedule:list',
  params: {
    appends: 'completedStudents,course,lecturer,class',
    pageSize: 1000
  }
});

const { data: { data: CLOs } } = await ctx.api.request({
  url: 'CLO:list',
  params: {
    pageSize: 1000
  }
});
// Helpers
const getPercent = (answers) => {
  if (!answers) return "";
  const total = Object.values(answers).reduce((a, b) => a + b, 0);
  return Object.entries(answers)
    .map(([key, value]) => `${key}៖ ${((value / total) * 100).toFixed(0)}%`)
    .join(" . . ");
};

const summarize = async (answers) => {
  let prompt = `
    **Step 1: Identifying and Grouping Unique Student Feedback Ideas**
    1.  Read each "Student Answer" carefully to understand its core, distinct meaning or sentiment.
    2.  **Only group answers that express the IDENTICAL core idea or sentiment.** Do not group answers that are merely related, share a few keywords, or convey distinct points. Focus strictly on the central, unique message of each answer.
    3.  For each identified **unique and distinct group of meaning**, create a concise, representative phrase. You can use an exact phrase from one of the students if it perfectly captures the group's essence, or synthesize a new phrase if necessary.

    **Step 2: Precise Counting and Output Formatting**
    1.  For each distinct group you've identified, **accurately count the precise number of original student answers that specifically fall into that group's unique meaning.**
        * **Crucial Verification:** After initial grouping, go back through each *original student answer* one by one. Assign each original answer to the single most appropriate group. This step ensures that your count for each group exactly matches the number of original answers that belong there. If an original answer contains multiple, *truly distinct* ideas, it may contribute to the count of more than one group; otherwise, it contributes to only one.
    2.  Present your final results as a list in Khmer, with each item on a separate line.
    3.  Place the count immediately after the representative phrase, formatted as (x នាក់) where x is the exact numerical count. Do not join the items with " * " or any other symbols; use only newlines.
    
    **CRITICAL: Output ONLY the final list in Khmer. Do not include any headers, "Step" titles, introductory text, or explanations. Just the final lines of results.**

    Student Answers:
    ${answers.join("\n")}
  `;

  const { data: { data: { id } } } = await ctx.api.request({
    url: `apiCall:create`,
    method: 'POST',
    data: {
      path: 'gemini',
      request: { prompt }
    }
  });
  const res = await ctx.api.request({
    url: `apiCall:get`,
    params: { filterByTk: id },
  });
  return res.data.data.response.candidates[0].content.parts[0].text;
}

const AnswerCell = ({ type, answers, showAiSummary }) => {
  const [aiResult, setAiResult] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showAiSummary && type !== 'mcq' && type !== 'checkbox' && answers) {
      if (answers.aiResult) {
        setAiResult(answers.aiResult);
        return;
      }
      const answerList = Object.entries(answers).flatMap(([key, value]) => Array(value).fill(key));
      if (answerList.length === 0) {
        setAiResult("");
        return;
      }
      setLoading(true);
      summarize(answerList)
        .then((summary) => {
          setAiResult(summary);
          answers.aiResult = summary;
        })
        .catch((error) => setAiResult(error.message))
        .finally(() => setLoading(false));
    }
  }, [showAiSummary, type, answers]);

  if (type === 'mcq' || type === 'checkbox') return getPercent(answers);

  if (showAiSummary) {
    if (loading) return <em>Summarizing...</em>;
    return aiResult ? <div style={{ whiteSpace: 'pre-wrap' }}>{aiResult}</div> : <em>No summary available</em>;
  }

  if (!answers) return "";
  let answerList = Object.entries(answers).flatMap(([key, value]) => Array(value).fill(key));
  answerList = answerList.filter((item) => item !== 'aiResult');
  return answerList.join(' . . ');
};

// 2. The Document Template
const DocTemplate = forwardRef(({ showAiSummary, showCLO, colWidth }, ref) => (
  <div ref={ref}>
    {results.map((result, idx) => {
      // WIP: check if we need to add CLO question
      return (
        <div key={idx} style={{
          display: 'block',
          fontFamily: 'Khmer OS Battambang, sans-serif',
        }}>
          {/* Metadata Section */}
          <div style={{ marginBottom: '20px' }}>
            មុខវិជ្ជា៖ <strong>{result.course?.englishName}</strong>&nbsp;
            គ្រូបង្រៀន៖ <strong>{result.lecturer?.englishName}</strong>&nbsp;
            ថ្នាក់៖ <strong>{result.class?.name}</strong><br />
            ចំនួនសិស្សឆ្លើយសរុប៖ <strong>{result.completedStudents?.length}</strong>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Khmer OS Battambang, sans-serif' }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th style={{ border: '1pt solid black', padding: '8px', width: `${colWidth}%`, textAlign: 'left' }}>សំណួរ</th>
                <th style={{ border: '1pt solid black', padding: '8px', textAlign: 'left' }}>ចម្លើយ</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((qs, i) => (
                <tr key={i}>
                  <td style={{ border: '1pt solid black', padding: '8px' }}>{qs.label}</td>
                  <td style={{ border: '1pt solid black', padding: '8px' }}>
                    <AnswerCell
                      type={qs.type}
                      answers={result?.[`question${i}`]}
                      showAiSummary={showAiSummary}
                    />
                  </td>
                </tr>
              ))}
              {showCLO && CLOs.filter(CLO => CLO.courseId == result.courseId).map((CLO, i) => (
                <tr key={i + questions.length}>
                  <td style={{ border: '1pt solid black', padding: '8px' }}>CLO {CLO.number} achieved</td>
                  <td style={{ border: '1pt solid black', padding: '8px' }}>
                    <AnswerCell
                      type='mcq'
                      answers={result?.[`question${i + questions.length}`]}
                      showAiSummary={showAiSummary}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    })}
  </div>
));

// 3. Main App
const App = () => {
  const [showCLO, setShowCLO] = useState(true);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [colWidth, setColWidth] = useState(35);
  const docRef = useRef(null);

  const download = () => {
    const fullHTML = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='https://www.w3.org/TR/html40'>
      <head>
        <meta charset='utf-8'>
      </head>
      <body>
        ${docRef.current.innerHTML}
      </body>
      </html>
    `;

    const blob = new Blob([fullHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Evaluation_Report.doc`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{
        position: 'sticky', top: 0, background: '#fff', padding: '12px 20px',
        borderBottom: '1px solid #d9d9d9', zIndex: 100, display: 'flex', gap: '20px', alignItems: 'center'
      }}>
        <Button onClick={download} type="primary">Download</Button>

        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Checkbox checked={showCLO} onChange={(e) => setShowCLO(e.target.checked)} />
          show CLOs
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Checkbox checked={showAiSummary} onChange={(e) => setShowAiSummary(e.target.checked)} />
          AI Summary
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <label>Question Width: {colWidth}%</label>
          <input type="range" min="20" max="60" value={colWidth} onChange={(e) => setColWidth(e.target.value)} />
        </div>
      </div>

      <DocTemplate
        ref={docRef}
        showAiSummary={showAiSummary}
        showCLO={showCLO}
        colWidth={colWidth}
      />
    </div>
  );
};

ctx.render(<App />);