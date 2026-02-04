const { React } = ctx.libs;
const { useRef, useState } = React;

// 1. Fetch Data
const { data: { data: questions } } = await ctx.api.request({ url: 'evaluationQuestion:list' });
const { data: { data: results } } = await ctx.api.request({
  url: 'schedule:list',
  params: { appends: 'completedStudents,course,lecturer,class,class.program' }
});

// Helpers
const getPercent = (answers) => {
  if (!answers) return "";
  const total = Object.values(answers).reduce((a, b) => a + b, 0);
  return Object.entries(answers)
    .map(([key, value]) => `${key}៖ ${((value / total) * 100).toFixed(0)}%`)
    .join(" . . ");
};

const summarize = (answers) => "AI Summary Content Placeholder";

// 2. The Document Template
const DocTemplate = React.forwardRef(({ settings, data }, ref) => {
  const { showAiSummary, colWidth } = settings;

  const getList = (answers) => {
    if (!answers) return "";
    const answerList = Object.entries(answers).flatMap(([key, value]) => Array(value).fill(key));
    return showAiSummary ? summarize(answerList) : answerList.join(' . . ');
  };

  return (
    <div ref={ref}>
      {data.map((result, idx) => (
        <div key={idx} style={{
          padding: '40px',
          backgroundColor: '#fff',
          // This tells Word to start a new page after this div
          pageBreakAfter: 'always',
          display: 'block'
        }}>
          {/* Metadata Section */}
          <div style={{ marginBottom: '20px' }}>
            មុខវិជ្ជា៖ <strong>{result.course?.name}</strong>&nbsp;
            គ្រូបង្រៀន៖ <strong>{result.lecturer?.nickname}</strong>&nbsp;
            ថ្នាក់៖ <strong>{result.class?.name}</strong><br />
            ចំនួនសិស្សឆ្លើយសរុប៖ <strong>{result.completedStudents?.length || 0}</strong>
          </div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                    {qs.type === 'mcq' || qs.type === 'checkbox'
                      ? getPercent(result?.[`question_${i}`])
                      : getList(result?.[`question_${i}`])}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <br clear="all" style={{ pageBreakBefore: 'always' }} />
        </div>
      ))}
    </div>
  );
});

// 3. Main App
const App = () => {
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [colWidth, setColWidth] = useState(35);
  const docRef = useRef(null);

  const download = () => {
    const fullHTML = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
         <style>
          body { font-family: 'Khmer OS Battambang', sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1pt solid black; padding: 5pt; }
          .evaluation-container { page-break-after: always; }
        </style>
      </head>
      <body>
        ${docRef.current.innerHTML}
      </body>
      </html>
    `;

    const element = document.createElement('a');
    element.href = `data:application/vnd.ms-word,${encodeURIComponent(fullHTML)}`;
    element.download = `Results_Export.doc`;
    element.click();
  };

  return (
    <div style={{ background: '#f0f2f5', minHeight: '100vh' }}>
      <div style={{
        position: 'sticky', top: 0, background: '#fff', padding: '12px 20px',
        borderBottom: '1px solid #d9d9d9', zIndex: 100, display: 'flex', gap: '20px', alignItems: 'center'
      }}>
        <button onClick={download} style={{
          padding: '6px 16px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer'
        }}>Download .doc</button>

        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
          <input type="checkbox" checked={showAiSummary} onChange={(e) => setShowAiSummary(e.target.checked)} />
          AI Summary
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label>Question Width: {colWidth}%</label>
          <input type="range" min="20" max="60" value={colWidth} onChange={(e) => setColWidth(e.target.value)} />
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        <DocTemplate
          ref={docRef}
          data={results}
          settings={{ showAiSummary, colWidth }}
        />
      </div>
    </div>
  );
};

ctx.render(<App />);