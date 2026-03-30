const { React } = ctx.libs;
const { Button } = ctx.libs.antd;
const { useRef } = React;

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

const scheduleId = await ctx.getVar('ctx.popup.resource.filterByTk');
// 1. Data Fetching
const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: scheduleId,
        appends: 'class,class.students,class.students.scores,course,course.program,course.program.faculty,course.weights,course.weights.CLO,course.weights.PLO'
    }
});

const { program, weights } = schedule.course;
const students = schedule.class.students.sort((a, b) => a.khmerName?.localeCompare(b.khmerName, 'km'));

// 2. Logic: Process CLOs and PLOs from weights
const cloMap = {};
const ploMap = {};

weights.filter(w => w.courseId == schedule.course.id)
    .forEach(w => {
        if (w.CLO) {
            cloMap[w.CLO.id] ??= { ...w.CLO, weightIds: [] };
            cloMap[w.CLO.id].weightIds.push(w.id);
        }
        if (w.PLO) {
            ploMap[w.PLO.id] ??= { ...w.PLO, weightIds: [] };
            ploMap[w.PLO.id].weightIds.push(w.id);
        }
    });

const clos = Object.values(cloMap).sort((a, b) => (a.number || 0) - (b.number || 0));
const plos = Object.values(ploMap).sort((a, b) => (a.number || 0) - (b.number || 0));

// 4. Sub-components
const DocTemplate = React.forwardRef((props, ref) => (
    <div ref={ref}>
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
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>ឈ្មោះ</th>
                    <th>ថ្ងៃខែឆ្នាំកំណើត</th>
                    {clos.map(clo => (
                        <th key={`clo-${clo.id}`}>CLO {clo.number}</th>
                    ))}
                    {plos.map(plo => (
                        <th key={`plo-${plo.id}`}>PLO {plo.number}</th>
                    ))}
                    <th>ពិន្ទុសរុប</th>
                </tr>
            </thead>
            <tbody>
                {students.map(student => {
                    let totalHasMakeup = false;
                    const scoreByWeightId = {};
                    student.scores?.forEach(s => {
                        scoreByWeightId[s.weightId] = { value: s.value || 0, makeup: s.makeup };
                    });

                    // Total score is the sum of all weight scores
                    const totalScore = weights.reduce((sum, w) => {
                        const entry = scoreByWeightId[w.id];
                        if (entry?.makeup) totalHasMakeup = true;
                        return sum + (entry?.value || 0);
                    }, 0);

                    return (
                        <tr key={student.id}>
                            <td>{student.id}</td>
                            <td>{student.khmerName}</td>
                            <td>
                                {student.birthday ? new Date(student.birthday).toLocaleDateString('en-GB') : '-'}
                            </td>
                            {clos.map(clo => {
                                let cloHasMakeup = false;
                                const cloScore = clo.weightIds.reduce((sum, wid) => {
                                    const entry = scoreByWeightId[wid];
                                    if (entry?.makeup) cloHasMakeup = true;
                                    return sum + (entry?.value || 0);
                                }, 0);
                                return <td key={`clo-${clo.id}`}>{cloScore}{cloHasMakeup ? '*' : ''}</td>
                            })}
                            {plos.map(plo => {
                                let ploHasMakeup = false;
                                const ploScore = plo.weightIds.reduce((sum, wid) => {
                                    const entry = scoreByWeightId[wid];
                                    if (entry?.makeup) ploHasMakeup = true;
                                    return sum + (entry?.value || 0);
                                }, 0);
                                return <td key={`plo-${plo.id}`}>{ploScore}{ploHasMakeup ? '*' : ''}</td>
                            })}
                            <td>{totalScore}{totalHasMakeup ? '*' : ''}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        <table className="invisible-table">
            <tr>
                <td>
                    សំគាល់៖ ពិន្ទុដែលទទួលបាន 0.00 ឬ Unsatisfied ជាពិន្ទុប្រឡងធ្លាក់ដែលត្រូវប្រឡងសង។
                    <br /><br />
                    បានឃើញ និងឯកភាព
                    <br />
                    ប្រធានគណៈកម្មការប្រឡង
                </td>
                <td>
                    ថ្ងៃ ខែ ឆ្នាំម្សាញ់ សប្តស័ក ព.ស ២៥៦៩
                    <br />
                    រាជធានីភ្នំពេញ, ថ្ងៃទី ខែ ឆ្នាំ ២០២៦
                    <br />
                    ព្រឹទ្ធបុរស
                </td>
            </tr>
        </table>
    </div>
));

// 5. Main App
const App = () => {
    const docRef = useRef(null);

    const download = () => {
        const fullHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office'
                  xmlns:w='urn:schemas-microsoft-com:office:word'
                  xmlns='https://www.w3.org/TR/html40'>
                <head>
                    <meta charset='utf-8'>
                </head>
                <body>
                    ${docRef.current.innerHTML}
                </body>
            </html>
        `;
        const blob = new Blob([fullHTML], { type: 'application/msword' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (<>
        <Button type="primary" onClick={download}>Download Report</Button>
        <DocTemplate ref={docRef} />
    </>);
};

ctx.render(<App />);
