const React = ctx.libs.React;

let questions = [];
await ctx.api.request({
  url: 'evaluation_question:list',
}).then(({data}) => questions = data.data);

let results = [];
await ctx.api.request({
  url: 'evaluation_result:list',
  params: {
    appends: 'completedStudents,schedule,schedule.subject,schedule.lecturer,schedule.class,schedule.class.affiliation'
  }
}).then(({data}) => results = data.data);

// wip: save AI result
function summarize(answers) {
  return "AI";
  // const geminiApiKey = 'AIzaSyDDwi0-waXktXNWESy_4peMjj2zNZqyWOU';
  // const model = "gemini-2.5-flash-lite";
  // const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
  // let prompt = `
  //   **Step 1: Identifying and Grouping Unique Student Feedback Ideas**
  //   1.  Read each "Student Answer" carefully to understand its core, distinct meaning or sentiment.
  //   2.  **Only group answers that express the IDENTICAL core idea or sentiment.** Do not group answers that are merely related, share a few keywords, or convey distinct points. Focus strictly on the central, unique message of each answer.
  //   3.  For each identified **unique and distinct group of meaning**, create a concise, representative phrase. You can use an exact phrase from one of the students if it perfectly captures the group's essence, or synthesize a new phrase if necessary.

  //   **Step 2: Precise Counting and Output Formatting**
  //   1.  For each distinct group you've identified, **accurately count the precise number of original student answers that specifically fall into that group's unique meaning.**
  //       * **Crucial Verification:** After initial grouping, go back through each *original student answer* one by one. Assign each original answer to the single most appropriate group. This step ensures that your count for each group exactly matches the number of original answers that belong there. If an original answer contains multiple, *truly distinct* ideas, it may contribute to the count of more than one group; otherwise, it contributes to only one.
  //   2.  Present your final results as a list in Khmer.
  //   3.  Place the count immediately after the representative phrase, formatted as (x នាក់) where x is the exact numerical count.
  //   4.  Do not number the list items.
  //   Student Answers:
  //   ${answers.join('\n')}
  // `;

  // const res = await ctx.fetch(geminiEndpoint, { 
  //   'method' : 'POST',
  //   'contentType': 'application/json',
  //   'payload': JSON.stringify({
  //     contents: [{ 
  //       parts: [{ 
  //         text: prompt 
  //       }]
  //     }]})
  // });
  // const data = JSON.parse(res);
  // return data["candidates"][0]["content"]["parts"][0]["text"];
}

// Helper
const getPercent = (answers) => {
  const total = Object.values(answers).reduce((a, b) => a + b, 0);
  return Object.entries(answers)
    .map(([key, value]) => {
      const percentage = ((value / total) * 100).toFixed(0);
      return `${key}៖ ${percentage}%`;
    })
    .join(" . . ");
};

const now = new Date();
const currentMonth = now.getMonth() + 1;
const semesterNo = (currentMonth >= 1 && currentMonth <= 6) ? 1 : 2;
const academicYr = `${now.getFullYear() - 1}-${now.getFullYear().toString().slice(-2)}`;

const App = () => {
  const [showAiSummary, setShowAiSummary] = React.useState(false);
  const [showHeader, setShowHeader] = React.useState(true);
  const [showFooter, setShowFooter] = React.useState(true);
  const [colWidth, setColWidth] = React.useState(30); // Percentage for the first column

  // helper
  const getList = (answers) => {
    const answerList = Object.entries(answers).flatMap(([key, value]) => 
        Array(value).fill(key));
    if (showAiSummary)
      return summarize(answerlist);
    else 
      return answerList.join(' . . ');
  }
    
  return (
    <div>
      {/* Control Panel - Hidden during export if using print media queries */}
      <div 
        className="control-panel no-print" 
        style={{ 
          position: 'sticky', 
          top: 0, 
          background: '#f8f9fa', 
          padding: '15px', 
          borderBottom: '1px solid #ddd', 
          zIndex: 100,
          display: 'flex',
          gap: '10px',
          alignItems: 'center'
        }}
      >
        <button>download</button>
          <input type="checkbox" checked={showAiSummary} onChange={(e) => setShowAiSummary(e.target.checked)} style={{ marginRight: '5px' }} />
          AI Summary
          <input type="checkbox" checked={showHeader} onChange={(e) => setShowHeader(e.target.checked)} style={{ marginRight: '5px' }} />
          Show Header
          <input type="checkbox" checked={showFooter} onChange={(e) => setShowFooter(e.target.checked)} style={{ marginRight: '5px' }} />
          Show Footer
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label>Width: {colWidth}%</label>
          <input 
            type="range" min="20" max="70" value={colWidth} 
            onChange={(e) => setColWidth(e.target.value)} 
          />
        </div>
      </div>

      <div id="doc">
        {results.map(result => (
          <div 
            className="evaluation-container" 
            style={{ 
              fontFamily: 'Khmer OS Battambang, serif', 
              padding: '40px', 
              maxWidth: '800px', 
              margin: 'auto',
              backgroundColor: '#fff',
              pageBreakAfter: 'always' 
            }}
          > 
            {/* Header Section */}
            {showHeader && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', marginBottom: '20px'}}>
                <div style={{ textAlign: 'center' }}>
                  <br/>សាកលវិទ្យាល័យភូមិន្ទកសិកម្ម
                </div>
                <div style={{ textAlign: 'center' }}>
                  ព្រះរាជាណាចក្រកម្ពុជា
                  <br />
                  ជាតិ សាសនា ព្រះមហាក្សត្រ
                </div>
              </div>
            )}

            {/* Metadata Section */}
            <div style={{ marginBottom: '20px' }}>
              កម្មវិធី៖ {result.schedule.class.affiliation.name} ឆ្នាំទី {result.schedule.subject.year} ឆមាសទី {semesterNo} (ឆ្នាំសិក្សា {academicYr})
              <br/>
              មុខវិជ្ជា៖ <strong>{result.schedule.subject.name}</strong>&nbsp;
              គ្រូបង្រៀន៖ <strong>{result.schedule.lecturer.nickname}</strong>&nbsp;
              ថ្នាក់៖ <strong>{result.schedule.class.name}</strong>
              <br/>
              ចំនួនសិស្សឆ្លើយសរុប៖ <strong>{result.completedStudents.length}</strong>
            </div>

            {/* Evaluation Table  */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f2f2f2' }}>
                  <th style={{ border: '1px solid black', padding: '8px', width: `${colWidth}%` }}>សំណួរ</th> 
                  <th style={{ border: '1px solid black', padding: '8px' }}>ចម្លើយ</th> 
                </tr>
              </thead>
              <tbody>
                {questions.map((qs, i) => (
                  <tr key={i}>
                    <td style={{ border: '1px solid black', padding: '8px' }}>{qs.label}</td>
                    <td style={{ border: '1px solid black', padding: '8px' }}>
                      {qs.type === 'mcq' || qs.type === 'checkbox' 
                        ? getPercent(result[`question_${i}`]) 
                        : getList(result[`question_${i}`])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer */}
            {showFooter && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px' }}>
                <div style={{ textAlign: 'center' }}>
                  ហត្ថលេខា និងឈ្មោះព្រឹទ្ធបុរស
                </div>
                <div style={{ textAlign: 'center' }}>
                  រាជធានីភ្នំពេញ ថ្ងៃទី …… ខែ …… ឆ្នាំ ……
                  <br />
                  ហត្ថលេខា និងឈ្មោះ អ្នកកត់ត្រា
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

ctx.render(<App />);