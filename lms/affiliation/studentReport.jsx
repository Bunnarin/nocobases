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

// why also filter by class? cuz foundation year
const { data: { data: students } } = await ctx.api.request({
    url: 'student:list',
    params: {
        pageSize: 10000,
        sort: 'khmerName',
        filter: {
            "$and": [
                { year: { "$notEmpty": true } },
                { status: { "$eq": "0" } },
                programId == 1 ? {
                    classes: { programId }
                } : {
                    majors: { id: programId }
                }
            ],
        },
        appends: 'background,background.province,scholarshipSource,majors,majors.faculty,classes,user'
    }
});

const customFacultyOrder = [9, 4, 6, 12, 3, 10, 7, 8, 5, 11];

// for some reason the react style block have some power over the doc download, except the font
const DocTemplate = forwardRef(({ selectedYear }, ref) => (<div ref={ref}>
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
                <th>ថ្នាក់</th>
                <th>អាហារូបករណ៍</th>
                <th>លេខទូរស័ព្ទ</th>
            </tr>
        </thead>
        <tbody>
            {(() => {
                const filtered = students.filter(s => s.year == selectedYear);
                const groups = {};
                filtered.forEach(student => {
                    (student.majors || []).forEach(m => {
                        const faculty = m.faculty;
                        const facultyId = faculty?.id || 'unknown';
                        if (!groups[facultyId]) groups[facultyId] = { faculty, students: [] };
                        groups[facultyId].students.push(student);
                    });
                });

                let globalIndex = 0;
                const getOrder = (id) => {
                    const idx = customFacultyOrder.findIndex(fId => fId == id);
                    return idx === -1 ? Infinity : idx;
                };
                return Object.values(groups).sort((a, b) => getOrder(a.faculty?.id) - getOrder(b.faculty?.id)).map((group) => (
                    <React.Fragment key={group.faculty?.id}>
                        <tr>
                            <td colSpan="12" style={{ textAlign: 'left', backgroundColor: '#e2e2e2' }}>
                                មហាវិទ្យាល័យ{group.faculty?.khmerName}
                            </td>
                        </tr>
                        {group.students.map(s => {
                            globalIndex++;
                            return (
                                <tr key={s.id}>
                                    <td>{globalIndex}</td>
                                    <td>{s.id}</td>
                                    <td>{s.oldId}</td>
                                    <td>{s.khmerName}</td>
                                    <td>{s.englishName}</td>
                                    <td>{s.sex}</td>
                                    <td>{s.birthday}</td>
                                    <td>{s.background?.province?.name}</td>
                                    <td>{s.classes.find(cls => cls.programId == programId)?.name}</td>
                                    <td>
                                        {s.scholarshipSource ? s.scholarshipSource.name + (s.scholarshipCoverage < 100 ? s.scholarshipCoverage : '') : 'បង់ថ្លៃ'}
                                    </td>
                                    <td>{s.user.phone}</td>
                                </tr>
                            );
                        })}
                        <tr>
                            <td colSpan="12" style={{ textAlign: 'left' }}>
                                សរុប៖ {group.students.length} នាក់ (ស្រី៖ {group.students.filter(s => s.sex == 'F').length} នាក់)
                            </td>
                        </tr>
                    </React.Fragment>
                ));
            })()}
        </tbody>
    </table>
    <table className="invisible-table">
        <tr>
            <td>
                ចំនួននិស្សិតសរុប៖ {students.filter(s => s.year == selectedYear).reduce((acc, s) => acc + (s.majors?.length || 0), 0)}នាក់ (ស្រី៖ {students.filter(s => s.year == selectedYear && s.sex == 'F').reduce((acc, s) => acc + (s.majors?.length || 0), 0)}នាក់)
                <br />
                សរុបជាក់ស្ដែង៖ {students.filter(s => s.year == selectedYear).length}នាក់ (ស្រី៖ {students.filter(s => s.year == selectedYear && s.sex == 'F').length}នាក់)
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
    const [selectedYear, setSelectedYear] = useState(programId == 1 ? 1 : 2);

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
        <Button type="primary" onClick={() => download(false)}>download word</Button>
        <Button onClick={() => download(true)}>download excel</Button>
        <DocTemplate selectedYear={selectedYear} ref={docRef} />
    </>);
};

ctx.render(<App />);