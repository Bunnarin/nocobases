const resObj = (res) => Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;

const { React } = ctx.libs;
const { useRef, forwardRef } = React;
const { Button } = ctx.libs.antd;

const programId = await ctx.getVar('ctx.popup.resource.filterByTk');

const { data: { data: semesters } } = await ctx.api.request({
    url: 'semester:list',
    params: {
        filter: {
            $or: [
                { startDate: { $dateOn: { type: "lastYear" } } },
                { startDate: { $dateOn: { type: "thisYear" } } },
                { startDate: { $dateOn: { type: "nextYear" } } }
            ]
        }
    }
});

// find the semester whose middle is closest to now
const semester = semesters.reduce((prev, curr) => {
    const time = (dateStr) => new Date(dateStr).getTime();
    const prevMiddle = time(prev.startDate) + (time(prev.endDate) - time(prev.startDate)) / 2;
    const currMiddle = time(curr.startDate) + (time(curr.endDate) - time(curr.startDate)) / 2;
    const prevDiff = Math.abs(prevMiddle - new Date().getTime());
    const currDiff = Math.abs(currMiddle - new Date().getTime());
    return currDiff < prevDiff ? curr : prev;
});

const { data: { data: program } } = await ctx.api.request({
    url: 'program:get',
    params: {
        appends: 'faculty',
        filterByTk: programId
    }
});

const { data: { data: classes } } = await ctx.api.request({
    url: 'class:list',
    params: {
        filter: {
            programId
        },
        appends: 'schedules,schedules.course,students,students.scores,students.scores.weight'
    }
});

const students = classes.flatMap(cls => cls.students);
// stringify cuz set cannot compare objects
const specialCourseIds = [123, 109, 99];
let courses = classes.flatMap(cls => cls.schedules).map(schedule => JSON.stringify(schedule.course));
courses = [...new Set(courses)].map(course => JSON.parse(course))
    .sort((a, b) => specialCourseIds.indexOf(a.id) - specialCourseIds.indexOf(b.id));

let englishCourseSpec;
const hasEngish = courses.find(c => c.englishName.toLowerCase() == 'english');
if (hasEngish)
    await ctx.api.request({
        url: 'KV:get',
        params: {
            filterByTk: 'englishCourseSpec'
        }
    }).then(res => englishCourseSpec = JSON.parse(resObj(res).value));

const gradeMap = (gpa) => {
    if (gpa >= 4.00) return 'A';
    if (gpa >= 3.50) return 'B+';
    if (gpa >= 3.00) return 'B';
    if (gpa >= 2.50) return 'C+';
    if (gpa >= 2.00) return 'C';
    return 'F';
};

const GPAMap = (score) => {
    if (score >= 85) return 4.00;
    if (score >= 80) return 3.50;
    if (score >= 70) return 3.00;
    if (score >= 65) return 2.50;
    if (score >= 50) return 2.00;
    return 0.00;
};

const getGPAInfo = (scores, courseId) => {
    const { displayValue, hasMakeup } = getScoreInfo(scores, courseId);
    if (isNaN(displayValue)) return { value: displayValue, hasMakeup };
    return { value: GPAMap(displayValue), hasMakeup };
}

const getScoreInfo = (scores, courseId) => {
    let total = 0;
    let hasMakeup = false;
    const courseScores = scores.filter(s => s.weight.courseId === courseId);
    courseScores.forEach(score => {
        total += score.value;
        if (score.makeup) hasMakeup = true;
    });

    let displayValue = total;
    if (courseId == 123) {
        total = 0;
        englishCourseSpec.weights.forEach(({ id, weight }) => {
            const entry = courseScores.find(s => s.weightId == id);
            total += entry?.value * weight / 100;
        });
        const passThreshold = englishCourseSpec.semesterPassThresholds[semester.number - 1];
        total = Math.round(total);
        displayValue = total >= passThreshold ? 'sastified' : 'unsastified';
    } else if (courseId == 109 || courseId == 99)
        displayValue = total >= 50 ? 'sastified' : 'unsastified';

    return { total, displayValue, hasMakeup };
}

const DocTemplate = forwardRef((props, ref) => (<div ref={ref}>
    <style>{`
        table, p {
            font-family: 'Khmer OS Battambang', sans-serif;
            border-collapse: collapse;
            width: 100%;
        }
        td, th {
            text-align: center;
            border: 1pt solid #ccc;
        }
        .invisible-table td {
            border: none;
            text-align: center;
        }
    `}</style>
    <table className="invisible-table">
        <tr>
            <td>
                <br />សាកលវិទ្យាល័យភូមិន្ទកសិកម្ម<br />{program.faculty.khmerName}
            </td>
            <td></td>
            <td>
                ព្រះរាជាណាចក្រកម្ពុជា<br />ជាតិ សាសនា ព្រះមហាក្សត្រ
            </td>
        </tr>
    </table>
    <p style={{ textAlign: 'center' }}>
        លទ្ធផលប្រឡងឆមាសទី {semester.number} និស្សិតឆ្នាំទី {students[0].year} ឆ្នាំសិក្សា {semester.startYear}-{semester.startYear + 1}
        <br />{program.khmerName}
    </p>
    <table>
        <thead>
            <tr>
                <th rowSpan={2}>ID</th>
                <th rowSpan={2}>ឈ្មោះ</th>
                {courses.map(c => (<th>{c.khmerName}</th>))}
                <th rowSpan={2}>ពិន្ទុសរុប</th>
                <th rowSpan={2}>GPA</th>
                <th rowSpan={2}>Grade</th>
            </tr>
            <tr>
                {courses.map(c => (<th>
                    {c.theoryCredit + c.practiceCredit} ({c.theoryCredit},{c.practiceCredit})
                </th>))}
            </tr>
        </thead>
        <tbody>
            {students.map(student => {
                let studentHasMakeup = false;
                const total = courses.reduce((acc, course) => {
                    const { total: val, hasMakeup } = getScoreInfo(student.scores, course.id);
                    if (hasMakeup) studentHasMakeup = true;
                    if (isNaN(val)) return acc;
                    return acc + val;
                }, 0);
                const averageGPA = courses.reduce((acc, course) => {
                    const { value, hasMakeup } = getGPAInfo(student.scores, course.id);
                    if (hasMakeup) studentHasMakeup = true;
                    if (isNaN(value)) return acc;
                    return acc + value;
                }, 0) / courses.length;
                return (
                    <tr key={student.id}>
                        <td>{student.id}</td>
                        <td>{student.khmerName}</td>
                        {courses.map(course => {
                            const { value, hasMakeup } = getGPAInfo(student.scores, course.id);
                            return <td key={course.id}>{value}{hasMakeup ? '*' : ''}</td>;
                        })}
                        <td>{total.toFixed(2)}{studentHasMakeup ? '*' : ''}</td>
                        <td>{averageGPA.toFixed(2)}{studentHasMakeup ? '*' : ''}</td>
                        <td>{gradeMap(averageGPA)}{studentHasMakeup ? '*' : ''}</td>
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
                ព្រឺទ្ធបុរស
            </td>
        </tr>
    </table>
</div>));

const App = () => {
    const docRef = useRef(null);

    const download = (isExcel = false) => {
        const fullHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office'
                  xmlns:w='urn:schemas-microsoft-com:office:${isExcel ? 'excel' : 'word'}'
                  xmlns='https://www.w3.org/TR/html40'>
                <head>
                    <meta charset='utf-8'>
                    <style>
                        @page Section1 {
                            size: 841.9pt 595.3pt;
                            mso-page-orientation: landscape;
                            margin: 1in 1in 1in 1in;
                        }
                        div.Section1 { page: Section1; }
                    </style>
                </head>
                <body>
                    <div class="Section1">
                        ${docRef.current.innerHTML}
                    </div>
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
        <Button type="primary" onClick={() => download(false)} style={{ marginBottom: '10px' }}>download word</Button>
        <Button onClick={() => download(true)} style={{ marginBottom: '10px' }}>download excel</Button>
        <DocTemplate ref={docRef} />
    </>);
};

ctx.render(<App />);