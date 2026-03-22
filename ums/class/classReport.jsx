const { React } = ctx.libs;
const { useRef, forwardRef } = React;
const { Button } = ctx.libs.antd;

// 1. Data Fetching
const classId = await ctx.getVar('ctx.popup.resource.filterByTk');
const { data: { data: classs } } = await ctx.api.request({
    url: 'class:get',
    params: {
        filterByTk: classId,
        appends: 'program,program.faculty,students,students.scores,students.scores.weight,schedules,schedules.course'
    }
});

// because LC needs to know what the latest semester is
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

const students = classs.students.sort((a, b) => a.khmerName.localeCompare(b.khmerName, 'km'));
const courses = classs.schedules.map(schedule => schedule.course);

const GPAMap = (score) => {
    if (score >= 85) return 4.0;
    if (score >= 80) return 3.5;
    if (score >= 70) return 3.0;
    if (score >= 65) return 2.5;
    if (score >= 50) return 2.0;
    return 0.0;
};

const getCourseInfo = (scores, courseId) => {
    const courseScores = scores.filter(score => score.weight.courseId === courseId);
    const totalScore = courseScores.reduce((acc, score) => acc + score.value, 0);
    const hasMakeup = courseScores.some(score => score.makeup);

    let displayValue = totalScore;
    if (courseId == 123) {
        const englishPassThreshold = semester.number == 1 ? 8 : 13;
        const numOfWeight = courseScores.length;
        displayValue = totalScore / numOfWeight >= englishPassThreshold ? 'sastified' : 'unsastified';
    } else if (courseId == 109 || courseId == 99) {
        displayValue = totalScore >= 50 ? 'sastified' : 'unsastified';
    }

    return { totalScore, displayValue, hasMakeup };
}

const getGPAInfo = (scores, courseId) => {
    const { displayValue, hasMakeup } = getCourseInfo(scores, courseId);
    if (isNaN(displayValue)) return { value: displayValue, hasMakeup };
    return { value: GPAMap(displayValue).toFixed(2), hasMakeup };
}

// 4. Components
const DocTemplate = forwardRef((props, ref) => (
    <div ref={ref}>
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
                    <br />សាកលវិទ្យាល័យភូមិន្ទកសិកម្ម<br />{classs.program.faculty.khmerName}
                </td>
                <td></td>
                <td>
                    ព្រះរាជាណាចក្រកម្ពុជា<br />ជាតិ សាសនា ព្រះមហាក្សត្រ
                </td>
            </tr>
        </table>
        <p style={{ textAlign: 'center' }}>
            លទ្ធផលប្រឡងឆមាសទី {semester.number} និស្សិតឆ្នាំទី {students[0].year} ឆ្នាំសិក្សា {semester.startYear}-{semester.startYear + 1}
            <br />
            ថ្នាក់ {classs.name}
        </p>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>ឈ្មោះ</th>
                    <th>ភេទ</th>
                    <th>ថ្ងៃខែឆ្នាំកំណើត</th>
                    {courses.map(course => (
                        <th>{course.khmerName} <br /> {course.theoryCredit + course.practiceCredit} ({course.theoryCredit},{course.practiceCredit})</th>
                    ))}
                    <th>ពិន្ទុសរុប</th>
                    <th>ពិន្ទុមធ្យម</th>
                </tr>
            </thead>
            <tbody>
                {students.map(student => {
                    let studentHasMakeup = false;
                    const weightedTotalScore = courses.reduce((acc, course) => {
                        const { totalScore, displayValue, hasMakeup } = getCourseInfo(student.scores, course.id);
                        if (hasMakeup) studentHasMakeup = true;
                        if (isNaN(displayValue)) return acc;
                        const credit = course.theoryCredit + course.practiceCredit;
                        return acc + totalScore * credit;
                    }, 0);
                    const totalCredit = courses.reduce((acc, course) => {
                        const { displayValue } = getCourseInfo(student.scores, course.id);
                        if (isNaN(displayValue)) return acc;
                        const credit = course.theoryCredit + course.practiceCredit;
                        return acc + credit;
                    }, 0);
                    return (
                        <tr key={student.id}>
                            <td>{student.id}</td>
                            <td>{student.khmerName}</td>
                            <td>{student.sex ? 'ប្រុស' : 'ស្រី'}</td>
                            <td>{student.birthday}</td>
                            {courses.map(course => {
                                const { value, hasMakeup } = getGPAInfo(student.scores, course.id);
                                return <td key={course.id}>{value}{hasMakeup ? '*' : ''}</td>;
                            })}
                            <td>{weightedTotalScore}{studentHasMakeup ? '*' : ''}</td>
                            <td>{(weightedTotalScore / totalCredit).toFixed(2)}{studentHasMakeup ? '*' : ''}</td>
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
                    ព្រឺទ្ធបុរស
                </td>
            </tr>
        </table>
    </div>
));

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
            </style>
            </head><body>
                ${contentHTML}
            </body></html>
        `;

        const element = document.createElement('a');
        element.href = `data:application/vnd.ms-word,${encodeURIComponent(fullHTML)}`;
        element.download = `class_report.doc`;
        element.click();
    };

    return (<>
        <Button type="primary" onClick={download} style={{ marginBottom: '10px' }}>download</Button>
        <DocTemplate ref={docRef} />
    </>);
};

ctx.render(<App />);
