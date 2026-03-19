const { React } = ctx.libs;
const { Button } = ctx.libs.antd;
const { useRef } = React;

const { data: { data: [semester] } } = await ctx.api.request({
    url: 'semester:list',
    params: {
        sort: '-startDate',
        limit: 1
    }
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
    <div ref={ref} style={{ fontFamily: 'Khmer OS Battambang, Arial, sans-serif' }}>
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
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '11px', border: '1pt solid #000' }}>
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
                    let totalScore = 0;
                    const scoreByWeightId = {};
                    student.scores?.forEach(s => {
                        scoreByWeightId[s.weightId] = s.value || 0;
                    });

                    // Total score is the sum of all weight scores
                    totalScore = weights.reduce((sum, w) => sum + (scoreByWeightId[w.id] || 0), 0);

                    return (
                        <tr key={student.id}>
                            <td>{student.id}</td>
                            <td>{student.khmerName}</td>
                            <td>
                                {student.birthday ? new Date(student.birthday).toLocaleDateString('en-GB') : '-'}
                            </td>
                            {clos.map(clo => {
                                const cloScore = clo.weightIds.reduce((sum, wid) => sum + (scoreByWeightId[wid] || 0), 0);
                                return <td key={`clo-${clo.id}`}>{cloScore}</td>
                            })}
                            {plos.map(plo => {
                                const ploScore = plo.weightIds.reduce((sum, wid) => sum + (scoreByWeightId[wid] || 0), 0);
                                return <td key={`plo-${plo.id}`}>{ploScore}</td>
                            })}
                            <td>{totalScore}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
        <table className="footer-table" style={{ width: '100%' }}>
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
        const contentHTML = docRef.current.innerHTML;
        const fullHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='https://www.w3.org/TR/html40'>
            <head><meta charset='utf-8'>
            <style>
                body { font-family: 'Khmer OS Battambang', sans-serif; }
                table { border-collapse: collapse; width: 100%; border: 1pt solid #000; }
                td, th { border: 1pt solid #000; padding: 5pt; text-align: center; }
                .text-left { text-align: left; }
            </style>
            </head><body>
                ${contentHTML}
            </body></html>
        `;

        const blob = new Blob([fullHTML], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Score_Report_${schedule.course?.name || 'export'}.doc`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (<>
        <Button type="primary" onClick={download}>Download Report</Button>
        <DocTemplate ref={docRef} />
    </>);
};

ctx.render(<App />);
