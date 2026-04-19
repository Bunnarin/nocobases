const resObj = (res) => Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;

const { React } = ctx.libs;
const { useRef, forwardRef } = React;
const { Button } = ctx.libs.antd;

const GPAMap = (score) => {
    if (score >= 85) return 4.0;
    if (score >= 80) return 3.5;
    if (score >= 70) return 3.0;
    if (score >= 65) return 2.5;
    if (score >= 50) return 2.0;
    return 0.0;
};

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
        filter: {
            $or:
                [{ startDate: { $dateOn: { type: "lastYear" } } },
                { startDate: { $dateOn: { type: "thisYear" } } },
                { startDate: { $dateOn: { type: "nextYear" } } }]
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

const students = classs.students.sort((a, b) => a.khmerName.localeCompare(b.khmerName, 'km'));

const specialCourseIds = [123, 109, 99];
// make sure these special are last
const courses = classs.schedules.map(schedule => schedule.course)
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

const getCourseInfo = (scores, courseId) => {
    const courseScores = scores.filter(score => score.weight.courseId === courseId);
    let total = courseScores.reduce((acc, score) => acc + score.value, 0);
    const hasMakeup = courseScores.some(score => score.makeup);

    let displayValue = total;
    // different pass logic for LC
    if (courseId == 123) {
        total = 0;
        englishCourseSpec.weights.forEach(({ id, weight }) => {
            const entry = courseScores.find(s => s.weightId == id);
            total += entry?.value * weight / 100;
        });
        total = Math.round(total);
        const passThreshold = englishCourseSpec.semesterPassThresholds[semester.number - 1];
        displayValue = total >= passThreshold ? 'sastified' : 'unsastified';
    } else if (courseId == 109 || courseId == 99)
        displayValue = total >= 50 ? 'sastified' : 'unsastified';

    return { total, displayValue, hasMakeup };
}

const getGPAInfo = (scores, courseId) => {
    const { displayValue, hasMakeup } = getCourseInfo(scores, courseId);
    if (isNaN(displayValue)) return { value: displayValue, hasMakeup };
    return { value: GPAMap(displayValue).toFixed(2), hasMakeup };
}

// 4. Components
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
    <table>
        <thead>
            <tr>
                <th>ល.រ.</th>
                <th>ID</th>
                <th>ឈ្មោះ</th>
                <th>ភេទ</th>
                <th>ថ្ងៃខែឆ្នាំកំណើត</th>
                {courses.map(course => (<th>
                    {course.khmerName} <br /> {course.theoryCredit + course.practiceCredit} ({course.theoryCredit}-{course.practiceCredit})
                </th>))}
                <th>ពិន្ទុសរុប</th>
                <th>ពិន្ទុមធ្យម</th>
            </tr>
        </thead>
        <tbody>
            {students.map((student, idx) => {
                let studentHasMakeup = false;
                const weightedTotalScore = courses.reduce((acc, course) => {
                    const { total, displayValue, hasMakeup } = getCourseInfo(student.scores, course.id);
                    if (hasMakeup) studentHasMakeup = true;
                    // exclude the special courses
                    if (isNaN(displayValue)) return acc;
                    const credit = course.theoryCredit + course.practiceCredit;
                    return acc + total * credit;
                }, 0);
                const totalCredit = courses.reduce((acc, course) => {
                    const { displayValue } = getCourseInfo(student.scores, course.id);
                    if (isNaN(displayValue)) return acc;
                    const credit = course.theoryCredit + course.practiceCredit;
                    return acc + credit;
                }, 0);
                return (
                    <tr key={student.id}>
                        <td>{idx + 1}</td>
                        <td>{student.id}</td>
                        <td>{student.khmerName}</td>
                        <td>{student.sex}</td>
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
