const { React } = ctx.libs;
const { useRef } = React;

// 1. Data Fetching
const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: ctx.value,
        appends: 'class,class.students,class.students.scores,course,course.weights,course.weights.CLO,course.weights.PLO,course.program'
    }
});

const { passThreshold } = schedule.course.program;
const { students } = schedule.class;
const { weights, credit } = schedule.course;

// 2. Logic: Group weights by PLO
const plosMap = {};
weights.forEach(w => {
    plosMap[w.PLO.id] ??= {
        ...w.PLO,
        closMap: {}
    };

    const ploEntry = plosMap[w.PLO.id];
    ploEntry.closMap[w.CLO.id] ??= {
        ...w.CLO,
        totalWeight: 0,
        weightIds: []
    }

    ploEntry.closMap[w.CLO.id].totalWeight += (w.weight || 0);
    ploEntry.closMap[w.CLO.id].weightIds.push(w.id);
});

const PLOs = Object.values(plosMap).sort((a, b) => a.number - b.number);

// 3. Styles Object
const styles = {
    container: { fontFamily: 'Khmer OS Battambang, Arial' },
    ploContainer: { marginBottom: '40px', pageBreakAfter: 'always' },
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
    bgYellow: { backgroundColor: '#ffff00' },
    bgGreen: { backgroundColor: '#d4edda' },
    bgRed: { backgroundColor: '#f8d7da' },
    bgLightGreen: { backgroundColor: '#d1e7dd' },
    textGreen: { color: '#155724' },
    textRed: { color: '#721c24' },
};

// 4. Sub-components

const PLOTable = ({ plo, students, passThreshold, credit }) => {
    const ploCLOs = Object.values(plo.closMap).sort((a, b) => a.number - b.number);
    const ploMaxWeight = ploCLOs.reduce((acc, c) => acc + c.totalWeight, 0);

    const studentResults = students.map(student => {
        let ploTotalScore = 0;
        const cloScores = ploCLOs.map(clo => {
            let cloScore = 0;
            clo.weightIds.forEach(wid => {
                const scoreRecord = student.scores.find(s => s.weightId === wid);
                cloScore += parseFloat(scoreRecord?.value || '0');
            });
            ploTotalScore += cloScore;
            return cloScore;
        });

        const percentage = ploMaxWeight > 0 ? (ploTotalScore / ploMaxWeight) * 100 : 0;
        const isPass = percentage >= (passThreshold || 50);
        return { student, cloScores, ploTotalScore, percentage, isPass };
    });

    const passCount = studentResults.filter(r => r.isPass).length;
    const failCount = studentResults.length - passCount;
    const passPercentage = studentResults.length ? ((passCount / studentResults.length) * 100).toFixed(0) : 0;
    const failPercentage = studentResults.length ? ((failCount / studentResults.length) * 100).toFixed(0) : 0;

    return (
        <div className="plo-page" style={styles.ploContainer}>
            <h3 style={{ color: '#1890ff' }}>{`PLO ${plo.number}: ${plo.statement || ''}`}</h3>
            <table style={styles.table}>
                <thead>
                    <tr style={styles.headerRow1}>
                        <th rowSpan={2} style={styles.thHeader}>id</th>
                        <th rowSpan={2} style={styles.thHeader}>name</th>
                        {ploCLOs.map(clo => (
                            <th key={clo.id} style={styles.th}>CLO {clo.number}</th>
                        ))}
                        <th colSpan={3} style={styles.th}>PLO {plo.number} score</th>
                    </tr>
                    <tr style={styles.headerRow2}>
                        {ploCLOs.map(clo => (
                            <th key={clo.id} style={styles.th}>{clo.totalWeight}%</th>
                        ))}
                        <th style={styles.th}>max {ploMaxWeight}</th>
                        <th style={styles.th}>100%</th>
                        <th style={styles.th}>grade</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style={{ fontWeight: 'bold' }}>
                        <td colSpan={2} style={styles.td}>CW = weight x credit ({credit})</td>
                        {ploCLOs.map(clo => (
                            <td key={clo.id} style={styles.tdCenter}>
                                {(clo.totalWeight * credit / 100).toFixed(2)}
                            </td>
                        ))}
                        <td colSpan={3} style={styles.tdCenter}>
                            {(ploMaxWeight * credit / 100).toFixed(2)}
                        </td>
                    </tr>
                    {studentResults.map((res, idx) => (
                        <tr key={res.student.id}>
                            <td style={styles.td}>{res.student.id}</td>
                            <td style={styles.td}>{res.student.khmerName}</td>
                            {res.cloScores.map((score, i) => (
                                <td key={i} style={styles.tdCenter}>{score}</td>
                            ))}
                            <td style={styles.tdCenter}>{res.ploTotalScore.toFixed(2)}</td>
                            <td style={{
                                ...styles.tdCenter,
                                ...(res.isPass ? styles.bgGreen : styles.bgRed)
                            }}>
                                {res.percentage.toFixed(0)}%
                            </td>
                            <td style={styles.tdCenter}>
                                {(() => {
                                    const pct = res.percentage;
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
                        <td colSpan={2 + ploCLOs.map(c => 1).length} rowSpan={2} style={styles.tdNoBorder}></td>
                        <td style={styles.td}>fail</td>
                        <td style={styles.tdCenter}>{failCount} ({failPercentage}%)</td>
                        <td style={styles.td}>Avg. PLO achieved</td>
                    </tr>
                    <tr>
                        <td style={styles.td}>pass</td>
                        <td style={styles.tdCenter}>{passCount} ({passPercentage}%)</td>
                        <td style={styles.td}>{passPercentage >= passThreshold ? 'yes' : 'no'}</td>
                    </tr>
                </tfoot>
            </table>
            <br clear="all" style={{ pageBreakBefore: 'always' }} />
        </div>
    );
};

// 5. DocTemplate Component
const DocTemplate = React.forwardRef((props, ref) => (
    <div ref={ref} style={styles.container}>
        {PLOs.map(plo => (
            <PLOTable key={plo.id} plo={plo} students={students} passThreshold={passThreshold} credit={credit} />
        ))}
    </div>
));

// 6. Main App
const App = () => {
    const docRef = useRef(null);

    const download = () => {
        const contentHTML = docRef.current.innerHTML;
        const fullHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head><meta charset='utf-8'>
            <style>
                body { font-family: 'Khmer OS Battambang', sans-serif; }
                table { border-collapse: collapse; width: 100%; }
                td, th { border: 1pt solid #ccc; padding: 5pt; }
                .plo-page { page-break-after: always; }
            </style>
            </head><body>
                ${contentHTML}
            </body></html>
        `;

        const element = document.createElement('a');
        element.href = `data:application/vnd.ms-word,${encodeURIComponent(fullHTML)}`;
        element.download = `PLO_Report_${schedule.course?.name || 'export'}.doc`;
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