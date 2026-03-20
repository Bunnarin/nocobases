const { React } = ctx.libs;
const { useRef, forwardRef } = React;
const { Button } = ctx.libs.antd;

const programId = await ctx.getVar('ctx.popup.resource.filterByTk');

const { data: { data: [semester] } } = await ctx.api.request({
    url: 'semester:list',
    params: {
        sort: '-startDate',
        limit: 1
    }
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
let courses = classes.flatMap(cls => cls.schedules).map(schedule => JSON.stringify(schedule.course));
courses = [...new Set(courses)].map(course => JSON.parse(course));

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
    let totalScore = 0;
    let hasMakeup = false;
    scores.forEach(score => {
        if (score.weight.courseId === courseId) {
            totalScore += score.value;
            if (score.makeup) hasMakeup = true;
        }
    });
    
    let displayValue = totalScore;
    if (courseId == 123) {
        const englishPassThreshold = semester.number == 1 ? 16 : 26;
        displayValue = totalScore >= englishPassThreshold ? 'sastified' : 'unsastified';
    } else if (courseId == 109 || courseId == 99) {
        displayValue = GPAMap(totalScore) != 0.00 ? 'sastified' : 'unsastified';
    }
    
    return { totalScore, displayValue, hasMakeup };
}

const DocTemplate = forwardRef((props, ref) => (
    <div ref={ref}>
        <style>{`
            td, th {
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
        <table style={styles.table}>
            <thead>
                <tr>
                    <th style={styles.th}>ID</th>
                    <th style={styles.th}>ឈ្មោះ</th>
                    {courses.map(course => (
                        <th style={styles.th}><div style={styles['vertical-text']}>{course.khmerName}</div> <br /> {course.theoryCredit + course.practiceCredit} ({course.theoryCredit},{course.practiceCredit}) </th>
                    ))}
                    <th style={styles.th}>ពិន្ទុសរុប</th>
                    <th style={styles.th}>GPA</th>
                    <th style={styles.th}>Grade</th>
                </tr>
            </thead>
            <tbody>
                {students.map(student => {
                    let studentHasMakeup = false;
                    const totalScore = courses.reduce((acc, course) => {
                        const { totalScore: val, hasMakeup } = getScoreInfo(student.scores, course.id);
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
                            <td>{totalScore}{studentHasMakeup ? '*' : ''}</td>
                            <td>{averageGPA.toFixed(2)}{studentHasMakeup ? '*' : ''}</td>
                            <td>{gradeMap(averageGPA)}{studentHasMakeup ? '*' : ''}</td>
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
        element.download = `export.doc`;
        element.click();
    };

    return (<>
        <Button type="primary" onClick={download} style={{ marginBottom: '10px' }}>download</Button>
        <DocTemplate ref={docRef} />
    </>);
};

const styles = {
    table: { borderCollapse: 'collapse', width: '100%', fontSize: '12px', marginBottom: '20px' },
    tdCenter: { border: '1pt solid #ccc', padding: '8px', textAlign: 'center' },
    'vertical-text': {
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        whiteSpace: 'nowrap',
        textAlign: 'left',
        margin: '0 auto',
    },
    th: {
        border: '1pt solid #ccc', padding: '8px', backgroundColor: '#f2f2f2',
        /* Adjust height of the header row to accommodate the rotated text */
        height: '150px',
        verticalAlign: 'bottom', /* Align the rotated text to the bottom of the cell */
    }

};

ctx.render(<App />);