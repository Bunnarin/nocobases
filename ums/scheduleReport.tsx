const { React } = ctx.libs;
const { useRef } = React;

// 1. Data Fetching
const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: ctx.value,
        appends: 'class,class.students,class.students.scores,course,course.weights,course.weights.assessment,course.weights.CLO,course.program'
    }
});

const { passThreshold } = schedule.course.program;
const { students } = schedule.class;
const { weights } = schedule.course;

// 2. Logic: Group weights by CLO
const closMap = {};
weights.forEach(weight => {
    const clo = weight.CLO;
    closMap[clo.id] ??= { ...clo, weights: [] };
    closMap[clo.id].weights.push(weight);
});
const CLOs = Object.values(closMap).sort((a, b) => a.id - b.id);

// 3. Styles Object
const styles = {
    container: { fontFamily: 'Khmer OS Battambang, Arial' },
    cloContainer: { marginBottom: '40px', pageBreakAfter: 'always' },
    table: { borderCollapse: 'collapse', width: '100%', fontSize: '12px' },
    th: { border: '1pt solid #ccc', padding: '8px', textAlign: 'center' },
    thHeader: { border: '1pt solid #ccc', padding: '8px', minWidth: '150px' },
    headerRow1: { backgroundColor: '#f2f2f2' },
    headerRow2: { backgroundColor: '#f9f9f9' },
    td: { border: '1pt solid #ccc', padding: '8px' },
    tdCenter: { border: '1pt solid #ccc', padding: '8px', textAlign: 'center' },
    tdNoBorder: { border: 'none' },
    tdVerticalMiddle: { border: '1pt solid #ccc', padding: '8px', textAlign: 'center', verticalAlign: 'middle' },
    footerBold: { fontWeight: 'bold' },
    bgYellow: { backgroundColor: '#ffff00' }, // Standard Hex for Word
    bgGreen: { backgroundColor: '#d4edda' },
    bgRed: { backgroundColor: '#f8d7da' },
    bgLightGreen: { backgroundColor: '#d1e7dd' },
    textGreen: { color: '#155724' },
    textRed: { color: '#721c24' },
};

// 4. The Template Component
const DocTemplate = React.forwardRef((props, ref) => {
    return (
        <div ref={ref} style={styles.container}>
            {CLOs.map(clo => {
                const assessmentGroupsMap = {};
                clo.weights.forEach(w => {
                    const aId = w.assessmentId;
                    if (!assessmentGroupsMap[aId]) {
                        assessmentGroupsMap[aId] = {
                            id: aId,
                            name: w.assessment?.name,
                            totalWeight: 0,
                            weights: []
                        };
                    }
                    assessmentGroupsMap[aId].weights.push(w);
                    assessmentGroupsMap[aId].totalWeight += (w.weight || 0);
                });

                const assessmentGroups = Object.values(assessmentGroupsMap).sort((a, b) => a.id - b.id);
                const maxScoreTotal = assessmentGroups.reduce((acc, g) => acc + g.totalWeight, 0);

                const studentResults = students.map(student => {
                    let totalScore = 0;
                    clo.weights.forEach(w => {
                        const scoreRecord = student.scores.find(s => s.weightId === w.id);
                        totalScore += parseInt(scoreRecord?.value || '0');
                    });
                    const isPass = totalScore / maxScoreTotal >= passThreshold / 100;
                    return { totalScore, isPass };
                });

                const totalStudents = studentResults.length;
                const passCount = studentResults.filter(r => r.isPass).length;
                const failCount = totalStudents - passCount;
                const passPercentage = ((passCount / totalStudents) * 100).toFixed(0);
                const failPercentage = ((failCount / totalStudents) * 100).toFixed(0);

                return (
                    <div key={clo.id} className="clo-page" style={styles.cloContainer}>
                        <h3 style={{ color: '#1890ff' }}>{`CLO ${clo.number}: ${clo.statement}`}</h3>
                        <table style={styles.table}>
                            <thead>
                                <tr style={styles.headerRow1}>
                                    <th rowSpan={2} style={styles.thHeader}>Student Name</th>
                                    {assessmentGroups.map(group => (
                                        <th key={group.id} style={styles.th}>{group.name}</th>
                                    ))}
                                    <th colSpan={3} style={styles.th}>Total</th>
                                </tr>
                                <tr style={styles.headerRow2}>
                                    {assessmentGroups.map(group => (
                                        <th key={group.id} style={styles.th}>CLO score<br />({group.totalWeight}%)</th>
                                    ))}
                                    <th style={styles.th}>Score Max {maxScoreTotal}</th>
                                    <th style={styles.th}>Score Max (%)</th>
                                    <th style={styles.th}>CLO {clo.number} Grade</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student, index) => {
                                    const { totalScore, isPass } = studentResults[index];
                                    return (
                                        <tr key={student.id}>
                                            <td style={styles.td}>{student.khmerName}</td>
                                            {assessmentGroups.map(group => {
                                                let groupScore = 0;
                                                group.weights.forEach(w => {
                                                    const scoreRecord = student.scores.find(s => s.weightId === w.id);
                                                    groupScore += parseInt(scoreRecord?.value || '0');
                                                });
                                                const groupPass = groupScore >= (group.totalWeight / 2);
                                                return (
                                                    <td key={group.id} style={{
                                                        ...styles.tdCenter,
                                                        ...(groupPass ? styles.bgGreen : styles.bgRed),
                                                        ...(groupPass ? styles.textGreen : styles.textRed),
                                                    }}>{groupScore}</td>
                                                );
                                            })}
                                            <td style={styles.tdCenter}>{totalScore}</td>
                                            <td style={{ ...styles.tdCenter, ...(isPass ? styles.bgGreen : styles.bgRed) }}>
                                                {((totalScore / maxScoreTotal) * 100).toFixed(0)}%
                                            </td>
                                            <td style={{ ...styles.tdCenter, ...styles.bgLightGreen }}>
                                                {(() => {
                                                    const pct = (totalScore / maxScoreTotal) * 100;
                                                    if (pct >= 85) return 'A'; if (pct >= 80) return 'B+'; if (pct >= 70) return 'B';
                                                    if (pct >= 65) return 'C+'; if (pct >= 50) return 'C'; if (pct >= 45) return 'D';
                                                    if (pct >= 40) return 'E'; return 'F';
                                                })()}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={1 + assessmentGroups.length} rowSpan={4} style={styles.tdNoBorder}></td>
                                    <td style={styles.td}># Fail</td>
                                    <td style={styles.tdCenter}>{failCount}</td>
                                    <td rowSpan={3} style={styles.tdVerticalMiddle}>Avg. CLO Pass/Fail</td>
                                </tr>
                                <tr>
                                    <td style={styles.td}># Pass</td>
                                    <td style={styles.tdCenter}>{passCount}</td>
                                </tr>
                                <tr>
                                    <td style={styles.td}>Fail %</td>
                                    <td style={styles.tdCenter}>{failPercentage}%</td>
                                </tr>
                                <tr style={styles.footerBold}>
                                    <td style={{ ...styles.td, ...styles.bgYellow }}>Pass %</td>
                                    <td style={{ ...styles.tdCenter, ...styles.bgYellow }}>{passPercentage}%</td>
                                    <td style={styles.tdCenter}>{passThreshold}%</td>
                                </tr>
                            </tfoot>
                        </table>
                        <br clear="all" style={{ pageBreakBefore: 'always' }} />
                    </div>
                );
            })}
        </div>
    );
});

// 5. Main App Controller
const App = () => {
    const docRef = useRef(null);

    const download = () => {
        const contentHTML = docRef.current.innerHTML;

        // Note: Word prefers 1pt over 1px for table borders
        const fullHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'>
            <style>
                body { font-family: 'Khmer OS Battambang', sans-serif; }
                table { border-collapse: collapse; width: 100%; }
                td, th { border: 1pt solid #ccc; padding: 5pt; }
                .clo-page { page-break-after: always; }
            </style>
            </head><body>
                ${contentHTML}
            </body></html>
        `;

        const element = document.createElement('a');
        element.href = `data:application/vnd.ms-word,${encodeURIComponent(fullHTML)}`;
        element.download = `CLO_Report_${schedule.course?.name || 'export'}.doc`;
        element.click();
    };

    return (
        <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '20px' }}>
            <button onClick={download} style={{ background: '#1890ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer' }}>
                download
            </button>
            <DocTemplate ref={docRef} />
        </div>
    );
};

ctx.render(<App />);