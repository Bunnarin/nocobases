const { React } = ctx.libs;
const { Button } = ctx.libs.antd;
const { useRef } = React;

// 1. Data Fetching
const { data: { data: semesters } } = await ctx.api.request({
    url: 'semester:list',
    params: {
        sort: '-startDate',
        limit: 3
    }
});

// find the semester whose endDate is closest to now
const semester = semesters.reduce((prev, curr) => {
    const prevDiff = Math.abs(new Date(prev.endDate).getTime() - now.getTime());
    const currDiff = Math.abs(new Date(curr.endDate).getTime() - now.getTime());
    return currDiff < prevDiff ? curr : prev;
});

const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: ctx.value,
        appends: 'class,class.students,class.students.scores,course,course.weights,course.weights.assessment,course.weights.CLO,course.program,course.program.faculty'
    }
});

const { program } = schedule.course;
const students = schedule.class.students.sort((a, b) => a.khmerName.localeCompare(b.khmerName, 'km'));
const { weights } = schedule.course;

// 2. Logic: Group weights by CLO
const closMap = {};
weights.forEach(weight => {
    const clo = weight.CLO;
    closMap[clo.id] ??= { ...clo, weights: [] };
    closMap[clo.id].weights.push(weight);
});
const CLOs = Object.values(closMap).sort((a, b) => a.number - b.number);

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
            let hasMakeup = false;
            clo.weights.forEach(w => {
                const scoreRecord = student.scores.find(s => s.weightId === w.id);
                cloScore += scoreRecord?.value || 0;
                if (scoreRecord?.makeup) hasMakeup = true;
            });
            grandTotal += cloScore;
            return { value: cloScore, hasMakeup };
        });

        let studentGrandTotalHasMakeup = cloScores.some(c => c.hasMakeup);

        // Global assessment check: if any assessment (across all CLOs) has a total score of 0
        let hasAnyZeroAssessment = false;
        const assessmentTotals = {};
        weights.forEach(w => {
            const scoreRecord = student.scores.find(s => s.weightId === w.id);
            assessmentTotals[w.assessmentId] = (assessmentTotals[w.assessmentId] || 0) + scoreRecord?.value;
        });

        // We only care about assessments that actually have positive weight
        Object.keys(assessmentTotals).forEach(aId => {
            const totalWeight = weights.filter(w => w.assessmentId == aId).reduce((s, w) => s + (w.weight || 0), 0);
            hasAnyZeroAssessment = totalWeight > 0 && assessmentTotals[aId] === 0;
        });

        const isPass = !hasAnyZeroAssessment && grandTotal >= 50;
        return { student, cloScores, grandTotal, isPass, hasAnyZeroAssessment, hasMakeup: studentGrandTotalHasMakeup };
    });

    const summaryPassCount = summaryStudents.filter(s => s.isPass).length;
    const summaryFailCount = summaryStudents.length - summaryPassCount;
    const summaryPassPct = summaryStudents.length ? ((summaryPassCount / summaryStudents.length) * 100).toFixed(0) : 0;
    const summaryFailPct = summaryStudents.length ? ((summaryFailCount / summaryStudents.length) * 100).toFixed(0) : 0;

    return (<>
        <style>{`
            table, p {
                font-family: 'Khmer OS Battambang', sans-serif;
                font-size: 10px;
                border-collapse: collapse;
                width: 100%;
            }
            td, th {
                text-align: center;
                border: 1pt solid #ccc;
            }
            .invisible-table td {
                border: none;
            }
        `}</style>
        <table className="invisible-table">
            <tr>
                <td>
                    <br /><br />សាកលវិទ្យាល័យភូមិន្ទកសិកម្ម<br />{program.faculty.khmerName}
                </td>
                <td></td>
                <td>
                    ព្រះរាជាណាចក្រកម្ពុជា<br />ជាតិ សាសនា ព្រះមហាក្សត្រ
                </td>
            </tr>
        </table>
        <p style={{ textAlign: 'center' }}>
            បញ្ជីរាយនាមនិស្សិត {program.khmerName}
            <br />
            ឆ្នាំទី{schedule.course.year} ជំនាន់ទី{semester.startYear - program.startYear + 1} ឆ្នាំសិក្សា {semester.startYear}-{semester.startYear + 1}
            <br />
            {schedule.course.khmerName} ថ្នាក់ {schedule.class.name}
        </p>
        <div className="clo-page">
            <h3>Summary Report</h3>
            <table>
                <thead>
                    <tr>
                        <th>ល.រ.</th>
                        <th>ID</th>
                        <th>Name</th>
                        {summaryCLOs.map(clo => (
                            <th key={clo.id}>
                                CLO {clo.number}<br />({clo.totalWeight})
                            </th>
                        ))}
                        <th>Total Marks<br />(100)</th>
                        <th>Grade</th>
                    </tr>
                </thead>
                <tbody>
                    {summaryStudents.map((item, idx) => (
                        <tr key={item.student.id}>
                            <td>{idx + 1}</td>
                            <td>{item.student.id}</td>
                            <td>{item.student.khmerName}</td>
                            {item.cloScores.map((score, i) => (
                                <td key={i}>{score.value}{score.hasMakeup ? '*' : ''}</td>
                            ))}
                            <td>
                                {item.grandTotal}{item.hasMakeup ? '*' : ''}
                            </td>
                            <td>
                                {(() => {
                                    if (item.hasAnyZeroAssessment) return 'F';
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
                        <td colSpan={2 + summaryCLOs.length} rowSpan={4}></td>
                        <td># Fail</td>
                        <td>{summaryFailCount} ({summaryFailPct}%)</td>
                    </tr>
                    <tr>
                        <td># Pass</td>
                        <td>{summaryPassCount} ({summaryPassPct}%)</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </>);
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
        let anyZeroInCLO = false;

        // Check if any assessment within this CLO has a score of 0
        assessmentGroups.forEach(group => {
            let groupScore = 0;
            group.weights.forEach(w => {
                const scoreRecord = student.scores.find(s => s.weightId === w.id);
                groupScore += scoreRecord?.value;
            });
            anyZeroInCLO = group.totalWeight > 0 && groupScore === 0;
        });

        let anyMakeupInCLO = false;
        clo.weights.forEach(w => {
            const scoreRecord = student.scores.find(s => s.weightId === w.id);
            totalScore += scoreRecord?.value || 0;
            if (scoreRecord?.makeup) anyMakeupInCLO = true;
        });

        const isPass = !anyZeroInCLO && (totalScore / maxScoreTotal >= 50 / 100);
        return { totalScore, isPass, anyZeroInCLO, anyMakeupInCLO };
    });

    const totalStudents = studentResults.length;
    const passCount = studentResults.filter(r => r.isPass).length;
    const failCount = totalStudents - passCount;
    const passPercentage = ((passCount / totalStudents) * 100).toFixed(0);
    const failPercentage = ((failCount / totalStudents) * 100).toFixed(0);

    return (
        <div className="clo-page">
            <h3 style={{ color: '#1890ff' }}>{`CLO ${clo.number}: ${clo.statement}`}</h3>
            <table>
                <thead>
                    <tr>
                        <th rowSpan={2}>id</th>
                        <th rowSpan={2}>name</th>
                        {assessmentGroups.map(group => (
                            <th key={group.id}>{group.name}</th>
                        ))}
                        <th colSpan={3}>Total</th>
                    </tr>
                    <tr>
                        {assessmentGroups.map(group => (
                            <th key={group.id}>max {group.totalWeight}</th>
                        ))}
                        <th>max {maxScoreTotal}</th>
                        <th>100%</th>
                        <th>Grade</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((student, index) => {
                        const { totalScore, isPass, anyMakeupInCLO } = studentResults[index];
                        return (
                            <tr key={student.id}>
                                <td>{student.id}</td>
                                <td>{student.khmerName}</td>
                                {assessmentGroups.map(group => {
                                    let groupScore = 0;
                                    let groupHasMakeup = false;
                                    group.weights.forEach(w => {
                                        const scoreRecord = student.scores.find(s => s.weightId === w.id);
                                        groupScore += scoreRecord?.value || 0;
                                        if (scoreRecord?.makeup) groupHasMakeup = true;
                                    });
                                    const groupPass = groupScore >= (group.totalWeight / 2);
                                    return (
                                        <td key={group.id}>{groupScore}{groupHasMakeup ? '*' : ''}</td>
                                    );
                                })}
                                <td>{totalScore}{anyMakeupInCLO ? '*' : ''}</td>
                                <td>
                                    {maxScoreTotal > 0 ? ((totalScore / maxScoreTotal) * 100).toFixed(0) : 0}%{anyMakeupInCLO ? '*' : ''}
                                </td>
                                <td>
                                    {(() => {
                                        if (anyZeroInCLO) return 'F';
                                        const pct = totalScore / maxScoreTotal * 100;
                                        let grade = 'F';
                                        if (pct >= 85) grade = 'A';
                                        else if (pct >= 80) grade = 'B+';
                                        else if (pct >= 70) grade = 'B';
                                        else if (pct >= 65) grade = 'C+';
                                        else if (pct >= 50) grade = 'C';
                                        else if (pct >= 45) grade = 'D';
                                        else if (pct >= 40) grade = 'E';
                                        return grade + (anyMakeupInCLO ? '*' : '');
                                    })()}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr>
                        <td colSpan={2 + assessmentGroups.length} rowSpan={4}></td>
                        <td>Fail</td>
                        <td>{failCount} ({failPercentage}%)</td>
                        <td>Avg. CLO achieved</td>
                    </tr>
                    <tr>
                        <td>Pass</td>
                        <td>{passCount} ({passPercentage}%)</td>
                        <td>{passPercentage >= 50 ? 'yes' : 'no'}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};

// 5. App / DocTemplate
const DocTemplate = React.forwardRef((props, ref) => (
    <div ref={ref}>
        <SummaryTable />
        {CLOs.map(clo => (<CLOTable key={clo.id} clo={clo} />))}
    </div>
));

const App = () => {
    const docRef = useRef(null);

    const download = (isExcel = false) => {
        const fullHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office'
                  xmlns:x='urn:schemas-microsoft-com:office:${isExcel ? 'excel' : 'word'}'
                  xmlns='https://www.w3.org/TR/html40'>
                <head>
                    <meta charset='utf-8'>
                </head>
                <body>
                    ${docRef.current.innerHTML}
                </body>
            </html>
        `;
        const blob = new Blob([fullHTML], { type: isExcel ? 'application/vnd.ms-excel' : 'application/msword' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = isExcel ? 'export.xls' : 'export.doc';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (<>
        <Button type="primary" onClick={() => download(false)}>download word</Button>
        <Button onClick={() => download(true)}>download excel</Button>
        <DocTemplate ref={docRef} />
    </>);
};

ctx.render(<App />);