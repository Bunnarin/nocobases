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

const { data: { data: [semester] } } = await ctx.api.request({
    url: 'semester:list',
    params: {
        sort: '-startDate',
        limit: 1
    }
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

const degreeMap = ['បរិញ្ញាបត្ររង', 'បរិញ្ញាបត្រ', 'អនុបណ្ឌិត', 'បណ្ឌិត', 'បណ្ឌិតវេជ្ជសាស្ត្រសត្វ'];

const DocTemplate = forwardRef(({ selectedYear }, ref) => (
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
            បញ្ជីរាយនាមនិស្សិត {program.khmerName}
            <br />
            ឆ្នាំទី{selectedYear} ជំនាន់ទី{semester.startYear - program.startYear + 1 - selectedYear} ឆ្នាំសិក្សា {semester.startYear} - {semester.startYear + 1}
        </p>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
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
                        <td>{student.sex ? 'ស្រី' : 'ប្រុស'}</td>
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
        <table className="footer-table" style={{ width: '100%' }}>
            <tr>
                <td>
                    ចំនួននិស្សិតសរុប៖ {students.filter(s => s.year == selectedYear).length}នាក់ (ស្រី៖ {students.filter(s => s.year == selectedYear && s.sex).length}នាក់)
                    <br />
                    ប្រធានគណៈកម្មការប្រឡង
                </td>
                <td>
                    <br /><br />
                    ថ្ងៃ ខែ ឆ្នាំម្សាញ់ សប្តស័ក ព.ស ២៥៦៩
                    <br />
                    រាជធានីភ្នំពេញ, ថ្ងៃទី ខែ ឆ្នាំ ២០២៦
                    <br />
                    ព្រឺទ្ធបុរស
                </td>
            </tr>
        </table>
        <table className="header-table" style={{ width: '100%' }}>
            <tr>
                <td>
                    <br /><br />
                    បានឃើញ និងឯកភាព
                    <br />
                    សាកលវិទ្យាធិការ
                </td>
                <td>
                    បានពិនិត្យត្រឹមត្រូវ
                    <br />
                    នាយកមជ្ឈមណ្ឌលសិក្សានិងសេវានិស្សិត
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
            style={{ marginRight: '10px' }}
        />
        <Button type="primary" onClick={download} style={{ marginBottom: '10px' }}>download</Button>
        <DocTemplate selectedYear={selectedYear} ref={docRef} />
    </>);
};

ctx.render(<App />);