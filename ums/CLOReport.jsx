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
const CLOs = Object.values(closMap).sort((a, b) => a.number - b.number);

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

// 4. Sub-components

const SummaryTable = () => {
    // Calculate Summary Data
    const summaryCLOs = CLOs.map(clo => {
        // sum weight of all weights belonging to this CLO
        const totalWeight = clo.weights.reduce((sum, w) => sum + (w.weight || 0), 0);
        return { ...clo, totalWeight };
    });

    const summaryStudents = students.map(student => {
        let grandTotal = 0;
        const cloScores = summaryCLOs.map(clo => {
            let cloScore = 0;
            clo.weights.forEach(w => {
                const scoreRecord = student.scores.find(s => s.weightId === w.id);
                cloScore += scoreRecord?.value || 0;
            });
            grandTotal += cloScore;
            return cloScore;
        });

        const isPass = grandTotal >= passThreshold;
        return { student, cloScores, grandTotal, isPass };
    });

    const summaryPassCount = summaryStudents.filter(s => s.isPass).length;
    const summaryFailCount = summaryStudents.length - summaryPassCount;
    const summaryPassPct = summaryStudents.length ? ((summaryPassCount / summaryStudents.length) * 100).toFixed(0) : 0;
    const summaryFailPct = summaryStudents.length ? ((summaryFailCount / summaryStudents.length) * 100).toFixed(0) : 0;

    return (
        <div className="clo-page" style={styles.cloContainer}>
            <h3 style={{ color: '#1890ff' }}>Summary Report</h3>
            <table style={styles.table}>
                <thead>
                    <tr style={styles.headerRow1}>
                        <th style={styles.thHeader}>Student ID</th>
                        <th style={styles.thHeader}>Student Name</th>
                        {summaryCLOs.map(clo => (
                            <th key={clo.id} style={styles.th}>
                                CLO {clo.number}<br />({clo.totalWeight})
                            </th>
                        ))}
                        <th style={styles.th}>Total Marks<br />(100)</th>
                        <th style={styles.th}>Course<br />Grade</th>
                    </tr>
                </thead>
                <tbody>
                    {summaryStudents.map((item, idx) => (
                        <tr key={item.student.id}>
                            <td style={styles.td}>{item.student.code || item.student.id}</td>
                            <td style={styles.td}>{item.student.khmerName || item.student.name}</td>
                            {item.cloScores.map((score, i) => (
                                <td key={i} style={styles.tdCenter}>{score.toFixed(0)}</td>
                            ))}
                            <td style={{
                                ...styles.tdCenter,
                                ...(item.isPass ? styles.bgGreen : styles.bgRed)
                            }}>
                                {item.grandTotal}
                            </td>
                            <td style={styles.tdCenter}>
                                {(() => {
                                    const pct = item.grandTotal; // Assuming total weight is 100
                                    if (pct >= 85) return 'A'; if (pct >= 80) return 'B+'; if (pct >= 70) return 'B';
                                    if (pct >= 65) return 'C+'; if (pct >= 50) return 'C'; if (pct >= 45) return 'D';
                                    if (pct >= 40) return 'E'; return 'F';
                                })()}
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={2 + summaryCLOs.length} rowSpan={4} style={styles.tdNoBorder}></td>
                        <td style={styles.td}># Fail</td>
                        <td style={styles.tdCenter}>{summaryFailCount} ({summaryFailPct}%)</td>
                    </tr>
                    <tr>
                        <td style={styles.td}># Pass</td>
                        <td style={styles.tdCenter}>{summaryPassCount} ({summaryPassPct}%)</td>
                    </tr>
                </tfoot>
            </table>
            <br clear="all" style={{ pageBreakBefore: 'always' }} />
        </div>
    );
};

const CLOTable = ({ clo }) => {
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
        assessmentGroupsMap[aId].totalWeight += w.weight;
    });

    const assessmentGroups = Object.values(assessmentGroupsMap);
    const maxScoreTotal = assessmentGroups.reduce((acc, g) => acc + g.totalWeight, 0);

    const studentResults = students.map(student => {
        let totalScore = 0;
        clo.weights.forEach(w => {
            const scoreRecord = student.scores.find(s => s.weightId === w.id);
            totalScore += scoreRecord?.value || 0;
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
        <div className="clo-page" style={styles.cloContainer}>
            <h3 style={{ color: '#1890ff' }}>{`CLO ${clo.number}: ${clo.statement}`}</h3>
            <table style={styles.table}>
                <thead>
                    <tr style={styles.headerRow1}>
                        <th rowSpan={2} style={styles.thHeader}>id</th>
                        <th rowSpan={2} style={styles.thHeader}>name</th>
                        {assessmentGroups.map(group => (
                            <th key={group.id} style={styles.th}>{group.name}</th>
                        ))}
                        <th colSpan={3} style={styles.th}>Total</th>
                    </tr>
                    <tr style={styles.headerRow2}>
                        {assessmentGroups.map(group => (
                            <th key={group.id} style={styles.th}>max {group.totalWeight}</th>
                        ))}
                        <th style={styles.th}>max {maxScoreTotal}</th>
                        <th style={styles.th}>100%</th>
                        <th style={styles.th}>Grade</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((student, index) => {
                        const { totalScore, isPass } = studentResults[index];
                        return (
                            <tr key={student.id}>
                                <td style={styles.td}>{student.id}</td>
                                <td style={styles.td}>{student.khmerName || student.name}</td>
                                {assessmentGroups.map(group => {
                                    let groupScore = 0;
                                    group.weights.forEach(w => {
                                        const scoreRecord = student.scores.find(s => s.weightId === w.id);
                                        groupScore += scoreRecord?.value || 0;
                                    });
                                    const groupPass = groupScore >= (group.totalWeight / 2);
                                    return (
                                        <td key={group.id} style={{
                                            ...styles.tdCenter,
                                            ...(groupPass ? styles.bgGreen : styles.bgRed),
                                            ...(groupPass ? styles.textGreen : styles.textRed),
                                        }}>{groupScore.toFixed(0)}</td>
                                    );
                                })}
                                <td style={styles.tdCenter}>{totalScore.toFixed(0)}</td>
                                <td style={{ ...styles.tdCenter, ...(isPass ? styles.bgGreen : styles.bgRed) }}>
                                    {maxScoreTotal > 0 ? ((totalScore / maxScoreTotal) * 100).toFixed(0) : 0}%
                                </td>
                                <td style={{ ...styles.tdCenter }}>
                                    {(() => {
                                        const pct = totalScore / maxScoreTotal * 100;
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
                        <td colSpan={2 + assessmentGroups.length} rowSpan={4} style={styles.tdNoBorder}></td>
                        <td style={styles.td}>Fail</td>
                        <td style={styles.tdCenter}>{failCount} ({failPercentage}%)</td>
                        <td style={styles.td}>Avg. CLO achieved</td>
                    </tr>
                    <tr>
                        <td style={styles.td}>Pass</td>
                        <td style={styles.tdCenter}>{passCount} ({passPercentage}%)</td>
                        <td style={styles.tdCenter}>{passPercentage >= passThreshold ? 'yes' : 'no'}</td>
                    </tr>
                </tfoot>
            </table>
            <br clear="all" style={{ pageBreakBefore: 'always' }} />
        </div>
    );
};

// 5. App / DocTemplate
const DocTemplate = React.forwardRef((props, ref) => {
    return (
        <div ref={ref} style={styles.container}>
            <SummaryTable />
            {CLOs.map(clo => (
                <CLOTable key={clo.id} clo={clo} />
            ))}
        </div>
    );
});

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
        <div>
            <button onClick={download} style={{ background: '#1890ff', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer' }}>
                download
            </button>
            <DocTemplate ref={docRef} />
        </div>
    );
};

ctx.render(<App />);