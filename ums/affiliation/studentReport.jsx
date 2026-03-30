const { React } = ctx.libs;
const { useState, useRef, forwardRef } = React;
const { Button, Select } = ctx.libs.antd;

const programId = await ctx.getVar('ctx.popup.resource.filterByTk');
const { data: { data: program } } = await ctx.api.request({
    url: 'program:get',
    params: {
        filterByTk: programId,
        appends: 'faculty'
    }
});

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

// why not filter by just majorId? well that's cuz foundation also need to pull
const { data: { data: students } } = await ctx.api.request({
    url: 'student:list',
    params: {
        pageSize: 10000,
        sort: 'khmerName',
        filter: {
            "$or": [
                {
                    classes: {
                        programId
                    }
                },
                {
                    majorId: programId
                }
            ]
        },
        appends: 'background,background.province,scholarshipSource,major,classes,user'
    }
});

const degreeMap = ['AD', 'BSc', 'MSc', 'PhD', 'DVM'];

// for some reason the react style block have some power over the doc download, except the font
const DocTemplate = forwardRef(({ selectedYear }, ref) => (
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
                    <br />សាកលវិទ្យាល័យភូមិន្ទកសិកម្ម<br />{program.faculty.khmerName}
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
            ឆ្នាំទី{selectedYear} ជំនាន់ទី{semester.startYear - program.startYear + 1 - selectedYear} ឆ្នាំសិក្សា {semester.startYear} - {semester.startYear + 1}
        </p>
        <table>
            <thead>
                <tr>
                    <th>No.</th>
                    <th>ID</th>
                    <th>ref ID</th>
                    <th>ឈ្មោះ</th>
                    <th>ឈ្មោះឡាតាំង</th>
                    <th>ភេទ</th>
                    <th>ថ្ងៃខែឆ្នាំកំណើត</th>
                    <th>មកពី</th>
                    <th>កម្រិត</th>
                    {programId == 1 && <th>ជំនាញ</th>}
                    <th>ថ្នាក់</th>
                    <th>អាហារូបករណ៍</th>
                    <th>លេខទូរស័ព្ទ</th>
                </tr>
            </thead>
            <tbody>
                {students.filter(s => s.year == selectedYear).map((student, i) => (
                    <tr key={student.id}>
                        <td>{i + 1}</td>
                        <td>{student.id}</td>
                        <td>{student.oldId}</td>
                        <td>{student.khmerName}</td>
                        <td>{student.englishName}</td>
                        <td>{student.sex ? 'ស' : 'ប'}</td>
                        <td>{student.birthday}</td>
                        <td>{student.background?.province?.name}</td>
                        <td>{degreeMap[student.major.degree]}</td>
                        {programId == 1 && <td>{student.major.abbreviation}</td>}
                        <td>{student.classes.find(cls => cls.programId == programId)?.name}</td>
                        <td>
                            {student.scholarshipSource ? student.scholarshipSource.name + (student.scholarshipCoverage < 100 ? student.scholarshipCoverage : '') : 'បង់ថ្លៃ'}
                        </td>
                        <td>{student.user.phone}</td>
                    </tr>
                ))}
            </tbody>
        </table>
        <table className="invisible-table">
            <tr>
                <td>
                    ចំនួននិស្សិតសរុប៖ {students.filter(s => s.year == selectedYear).length}នាក់ (ស្រី៖ {students.filter(s => s.year == selectedYear && s.sex).length}នាក់)
                    <br /><br />
                    បានឃើញ និងឯកភាព
                    <br />
                    សាកលវិទ្យាធិការ
                </td>
                <td>
                    បានពិនិត្យត្រឹមត្រូវ
                    <br />
                    នាយកមជ្ឈមណ្ឌលសិក្សានិងសេវានិស្សិត
                    <br /><br /><br /><br />
                    ថ្ងៃ ខែ ឆ្នាំម្សាញ់ សប្តស័ក ព.ស ២៥៦៩
                    <br />
                    រាជធានីភ្នំពេញ, ថ្ងៃទី ខែ ឆ្នាំ ២០២៦
                    <br />
                    ព្រឺទ្ធបុរស
                </td>
                <td></td>
            </tr>
        </table>
    </div>
));

const App = () => {
    const docRef = useRef(null);
    const [selectedYear, setSelectedYear] = useState(programId == 1 ? 1 : 2);

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
        a.download = 'export.doc';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (<>
        selected year:
        <Select
            value={selectedYear}
            onChange={setSelectedYear}
            options={[
                { value: 1, label: '1' },
                { value: 2, label: '2' },
                { value: 3, label: '3' },
                { value: 4, label: '4' },
            ]}
            style={{ marginRight: '10px', marginBottom: '10px' }}
        />
        <Button type="primary" onClick={download}>download</Button>
        <DocTemplate selectedYear={selectedYear} ref={docRef} />
    </>);
};

ctx.render(<App />);