const { React } = ctx.libs;
const { useRef } = React;
const { Button } = ctx.libs.antd;

// 1. Data Fetching
const { data: { data: [semester] } } = await ctx.api.request({
    url: 'semester:list',
    params: {
        sort: '-startDate',
        limit: 1
    }
});

const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: ctx.value,
        appends: 'class,class.students,class.students.scores,course,course.weights,course.weights.CLO,course.weights.PLO,course.program,course.program.faculty'
    }
});

const students = schedule.class.students.sort((a, b) => a.khmerName.localeCompare(b.khmerName, 'km'));
const { program, weights, theoryCredit, practiceCredit } = schedule.course;
const credit = theoryCredit + practiceCredit;

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
};

// 4. Sub-components

const PLOTable = ({ plo }) => {
    const ploCLOs = Object.values(plo.closMap).sort((a, b) => a.number - b.number);
    const ploMaxWeight = ploCLOs.reduce((acc, c) => acc + c.totalWeight, 0);

    const studentResults = students.map(student => {
        let ploTotalScore = 0;
        const cloScores = ploCLOs.map(clo => {
            let cloScore = 0;
            clo.weightIds.forEach(wid => {
                const scoreRecord = student.scores.find(s => s.weightId === wid);
                cloScore += scoreRecord?.value;
            });
            ploTotalScore += cloScore;
            return cloScore;
        });

        // Deal breaker criteria: if any assessment (across all PLOs) has a total score of 0
        let hasAnyZeroAssessment = false;
        const assessmentTotals = {};
        weights.forEach(w => {
            const scoreRecord = student.scores.find(s => s.weightId === w.id);
            assessmentTotals[w.assessmentId] = (assessmentTotals[w.assessmentId] || 0) + scoreRecord?.value || 0;
        });

        // Check only assessments with positive weight
        Object.keys(assessmentTotals).forEach(aId => {
            const totalWeight = weights.filter(w => w.assessmentId == aId).reduce((s, w) => s + (w.weight || 0), 0);
            hasAnyZeroAssessment = totalWeight > 0 && assessmentTotals[aId] === 0;
        });

        const percentage = ploMaxWeight > 0 ? (ploTotalScore / ploMaxWeight) * 100 : 0;
        const isPass = !hasAnyZeroAssessment && percentage >= 50;
        return { student, cloScores, ploTotalScore, percentage, isPass, hasAnyZeroAssessment };
    });

    const passCount = studentResults.filter(r => r.isPass).length;
    const failCount = studentResults.length - passCount;
    const passPercentage = ((passCount / studentResults.length) * 100).toFixed(0);
    const failPercentage = ((failCount / studentResults.length) * 100).toFixed(0);

    return (
        <div className="plo-page" style={styles.ploContainer}>
            <h3 style={{ color: '#1890ff' }}>{`PLO ${plo.number}: ${plo.statement || ''}`}</h3>
            <table style={styles.table}>
                <thead>
                    <tr>
                        <th rowSpan={2}>ID</th>
                        <th rowSpan={2}>Name</th>
                        {ploCLOs.map(clo => (
                            <th key={clo.id}>CLO {clo.number}</th>
                        ))}
                        <th colSpan={3}>PLO {plo.number} score</th>
                    </tr>
                    <tr>
                        {ploCLOs.map(clo => (
                            <th key={clo.id}>{clo.totalWeight}%</th>
                        ))}
                        <th>max {ploMaxWeight}</th>
                        <th>100%</th>
                        <th>grade</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style={{ fontWeight: 'bold' }}>
                        <td colSpan={2}>CW = weight x credit ({credit})</td>
                        {ploCLOs.map(clo => (
                            <td key={clo.id}>
                                {(clo.totalWeight * credit / 100).toFixed(2)}
                            </td>
                        ))}
                        <td colSpan={3}>
                            {(ploMaxWeight * credit / 100).toFixed(2)}
                        </td>
                    </tr>
                    {studentResults.map((res, idx) => (
                        <tr key={res.student.id}>
                            <td>{res.student.id}</td>
                            <td>{res.student.khmerName}</td>
                            {res.cloScores.map((score, i) => (
                                <td key={i}>{score}</td>
                            ))}
                            <td>{res.ploTotalScore}</td>
                            <td>
                                {res.percentage.toFixed(0)}%
                            </td>
                            <td>
                                {(() => {
                                    if (res.hasAnyZeroAssessment) return 'F';
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
                        <td colSpan={2 + ploCLOs.map(c => 1).length} rowSpan={2}></td>
                        <td>fail</td>
                        <td>{failCount} ({failPercentage}%)</td>
                        <td>Avg. PLO achieved</td>
                    </tr>
                    <tr>
                        <td>pass</td>
                        <td>{passCount} ({passPercentage}%)</td>
                        <td>{passPercentage >= 50 ? 'yes' : 'no'}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

// 5. DocTemplate Component
const DocTemplate = React.forwardRef((props, ref) => (
    <div ref={ref} style={styles.container}>
        <style>{`
            th {
                border: 1pt solid #ccc;
                padding: 8px;
                text-align: center;
                background-color: #f2f2f2;
            }
            td {
                text-align: center;
                border: 1pt solid #ccc;
                padding: 8px;
            }
            .header-table td {
                border: none;
                width: 30%;
            }
            .footer-table td {
                border: none;
                width: 50%;
            }
        `}</style>
        <table className="header-table" style={{ width: '100%', marginBottom: '20px' }}>
            <tr>
                <td>
                    <br /><br />សាកលវិទ្យាល័យភូមិន្ទកសិកម្ម<br />{program.faculty.khmerName || program.faculty.name}
                </td>
                <td></td>
                <td>
                    ព្រះរាជាណាចក្រកម្ពុជា<br />ជាតិ សាសនា ព្រះមហាក្សត្រ
                </td>
            </tr>
        </table>
        <p style={{ textAlign: 'center' }}>
            បញ្ជីរាយនាមនិស្សិត {program.khmerName || program.englishName}
            <br />
            ឆ្នាំទី{schedule.course.year} ជំនាន់ទី{semester.startYear - program.startYear + 1} ឆ្នាំសិក្សា {semester.startYear}-{semester.startYear + 1}
            <br />
            {schedule.course.khmerName || schedule.course.englishName} ថ្នាក់ {schedule.class.name}
        </p>
        {PLOs.map(plo => (
            <PLOTable key={plo.id} plo={plo} />
        ))}
    </div>
));

// 6. Main App
const App = () => {
    const docRef = useRef(null);

    const download = () => {
        const contentHTML = docRef.current.innerHTML;
        const fullHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='https://www.w3.org/TR/html40'>
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

        const blob = new Blob([fullHTML], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `PLO_Report_${schedule.course?.name || 'export'}.doc`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (<>
        <Button type="primary" onClick={download}>download</Button>
        <DocTemplate ref={docRef} />
    </>);
};

ctx.render(<App />);