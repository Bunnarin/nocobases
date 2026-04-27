const { React } = ctx.libs;
const { Button, Switch } = ctx.libs.antd;
const { useRef, useState, forwardRef } = React;

const resObj = (res) => Array.isArray(res.data.data) ? res.data.data[0] : res.data.data;

// because LC needs to know what the latest semester is
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

const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: ctx.value,
        appends: 'course,course.weights,course.weights.assessment,course.weights.PLO,course.weights.CLO,class,class.program,class.program.faculty,class.students,class.students.scores'
    },
});

const isEnglish = schedule.course.englishName.toLowerCase() == 'english';
let englishCourseSpec;
if (isEnglish)
    await ctx.api.request({
        url: 'KV:get',
        params: {
            filterByTk: 'englishCourseSpec'
        }
    }).then(res => englishCourseSpec = JSON.parse(resObj(res).value));

const students = schedule.class.students.sort((a, b) => a.khmerName?.localeCompare(b.khmerName, 'km'));
const { weights } = schedule.course;
const { program } = schedule.class;
const hasWeights = weights.length > 0;

// If no weights are configured, use a single synthetic column with max=100 and weightId=null
let allClos = [{ weightId: null, weight: 100, assessmentName: 'ពិន្ទុ', cloNumber: '', ploNumber: '' }];
if (hasWeights) {
    allClos = Object.values(weights.reduce((acc, { assessment, CLO, PLO, weight, id: weightId }) => {
        const currentCLO = CLO || { id: 0, number: '', statement: '' };
        const currentPLO = PLO || { id: 0, number: '', statement: '' };
        acc[currentCLO.id] ??= { ...currentCLO, PLOs: {} };
        acc[currentCLO.id].PLOs[currentPLO.id] ??= { ...currentPLO, assessments: [] };
        acc[currentCLO.id].PLOs[currentPLO.id].assessments.push({
            ...assessment, weight, weightId, assessmentName: assessment.name
        });
        return acc;
    }, {})).flatMap(clo =>
        Object.values(clo.PLOs).flatMap(plo =>
            plo.assessments.map(a => ({ ...a, cloNumber: clo.number, ploNumber: plo.number }))
        )
    );
}

// clos is only used for the grouped header when weights exist
const clos = hasWeights
    ? Object.values(weights.reduce((acc, { assessment, CLO, PLO, weight, id: weightId }) => {
        const currentCLO = CLO || { id: 0, number: '', statement: '' };
        const currentPLO = PLO || { id: 0, number: '', statement: '' };
        acc[currentCLO.id] ??= { ...currentCLO, PLOs: {} };
        acc[currentCLO.id].PLOs[currentPLO.id] ??= { ...currentPLO, assessments: [] };
        acc[currentCLO.id].PLOs[currentPLO.id].assessments.push({
            ...assessment, weight, weightId, assessmentName: assessment.name
        });
        return acc;
    }, {})).map(clo => ({ ...clo, PLOs: Object.values(clo.PLOs) })).sort((a, b) => a.number - b.number)
    : [];

const totalMaxScore = allClos.reduce((sum, c) => sum + c.weight, 0);

// ── helpers ────────────────────────────────────────────────────────────────────

const scoreKey = (studentId, weightId) => `${studentId}-${weightId}`;

// Build initial scoreMap from server data
const buildInitialScoreMap = () => {
    const map = {};
    students.forEach(student =>
        student.scores?.filter(s => s.courseId == schedule.courseId).forEach(s =>
            map[scoreKey(student.id, s.weightId)] = s
        )
    );
    return map;
};

const getTotal = (studentId, scoreMap) => {
    let total = 0;
    let hasMakeup = false;
    allClos.forEach(c => {
        const entry = scoreMap[scoreKey(studentId, c.weightId)];
        if (entry) {
            total += entry.value;
            if (entry.makeup) hasMakeup = true;
        }
    });
    return { total, hasMakeup };
};

// ── Visible interactive table & Document Template ──────────────────────────────

const getBand = (score) => {
    if (score >= 1 && score <= 12) return 'A1';
    if (score >= 13 && score <= 16) return 'A2';
    if (score >= 17 && score <= 23) return 'B1';
    if (score >= 24 && score <= 26) return 'B2';
    if (score >= 27 && score <= 28) return 'C1';
    if (score >= 29 && score <= 30) return 'C2';
    return '';
}

const ScoreTable = forwardRef(({ scoreMap, onCommit, onPaste }, ref) => (<div ref={ref}>
    <style>{`
            table, p { 
                font-family: 'Khmer OS Battambang', sans-serif; 
                border-collapse: collapse; 
                width: 100%; 
            }
            th, td { 
                border: 1pt solid #000; 
                padding: 6px; 
                text-align: center; 
            }
            .invisible-table td { 
                border: none; 
                text-align: center; 
            }
        `}</style>

    <table className="invisible-table">
        <tr>
            <td><br /><br />សាកលវិទ្យាល័យភូមិន្ទកសិកម្ម<br />{program.faculty.khmerName}</td>
            <td></td>
            <td>ព្រះរាជាណាចក្រកម្ពុជា<br />ជាតិ សាសនា ព្រះមហាក្សត្រ</td>
        </tr>
    </table>

    <p style={{ textAlign: 'center' }}>
        បញ្ជីរាយនាមនិស្សិត {program.khmerName} <br />
        ឆមាសទី {semester.number} ឆ្នាំសិក្សា {semester.startYear}-{semester.startYear + 1} <br />
        {schedule.course.khmerName} ថ្នាក់ {schedule.class.name}
    </p>

    <table>
        <thead>
            <tr>
                <th rowSpan={isEnglish || !hasWeights ? 1 : 4}>ល.រ.</th>
                <th rowSpan={isEnglish || !hasWeights ? 1 : 4}>ID</th>
                <th rowSpan={isEnglish || !hasWeights ? 1 : 4}>ឈ្មោះ</th>
                <th rowSpan={isEnglish || !hasWeights ? 1 : 4}>name</th>
                <th rowSpan={isEnglish || !hasWeights ? 1 : 4}>ភេទ</th>
                <th rowSpan={isEnglish || !hasWeights ? 1 : 4}>ថ្ងៃខែឆ្នាំកំណើត</th>
                {isEnglish ? (
                    allClos.map(c => (<React.Fragment key={String(c.weightId)}>
                        <th>{c.assessmentName} ({englishCourseSpec.weights.find(w => w.id === c.weightId)?.weight}%)</th>
                        <th key={c.weightId + '-band'}>band</th>
                    </React.Fragment>))
                ) : !hasWeights ? (
                    <th>ពិន្ទុ (100)</th>
                ) : (
                    clos.map(({ id, number, statement, PLOs }) =>
                        <th key={id} title={statement}
                            colSpan={PLOs.reduce((s, p) => s + p.assessments.length, 0)}
                        >
                            CLO {number}
                        </th>
                    )
                )}
                <th rowSpan={isEnglish || !hasWeights ? 1 : 4}>{isEnglish ? 'ពិន្ទុសមមូល' : 'សរុប'}</th>
                {isEnglish && <th>band</th>}
                <th rowSpan={isEnglish || !hasWeights ? 1 : 4}>លទ្ធផល {isEnglish && semester.number == 1 ? 'ឆមាសទី១' : ''}</th>
                {isEnglish && semester.number == 1 && <th rowSpan={isEnglish || !hasWeights ? 1 : 4}>លទ្ធផល ឆមាសទី២</th>}
            </tr>
            {!isEnglish && hasWeights && (<>
                <tr>
                    {clos.map(({ PLOs }) =>
                        PLOs.map(plo => (
                            <th key={plo.id} colSpan={plo.assessments.length} title={plo.statement}>
                                PLO {plo.number}
                            </th>
                        ))
                    )}
                </tr>
                <tr>
                    {clos.map(({ PLOs }) =>
                        PLOs.map(plo =>
                            plo.assessments.map(c => (
                                <th key={c.weightId} title={c.assessmentName} style={{ padding: '4px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.assessmentName}
                                </th>
                            ))
                        )
                    )}
                </tr>
                <tr>
                    {clos.map(({ PLOs }) =>
                        PLOs.map(plo =>
                            plo.assessments.map(c => (
                                <th key={c.weightId + '-max'}>
                                    {c.weight}
                                </th>
                            ))
                        )
                    )}
                </tr>
            </>)}
        </thead>
        <tbody>
            {students.map((student, rowIndex) => {
                let { total, hasMakeup } = getTotal(student.id, scoreMap);
                let pass = total / totalMaxScore >= 0.5;

                let passSem2;
                if (isEnglish) {
                    total = 0;
                    englishCourseSpec.weights.forEach(({ id, weight }) => {
                        const entry = scoreMap[scoreKey(student.id, id)];
                        if (!entry) return;
                        total += entry.value * weight / 100;
                    });
                    total = Math.round(total);
                    const passThreshold = englishCourseSpec.semesterPassThresholds[semester.number - 1];
                    pass = total >= passThreshold;

                    if (semester.number == 1) {
                        const secondPassThreshold = englishCourseSpec.semesterPassThresholds[semester.number];
                        passSem2 = total >= secondPassThreshold;
                    }
                }

                const passColor = (pass) => pass ? '#e6ffe6' : '#f8d0d0ff';

                return (
                    <tr key={student.id}>
                        <td>{rowIndex + 1}</td>
                        <td>{student.id}</td>
                        <td>{student.khmerName}</td>
                        <td>{student.englishName}</td>
                        <td>{student.sex}</td>
                        <td>{student.birthday}</td>
                        {allClos.map((clo, colIndex) => {
                            const entry = scoreMap[scoreKey(student.id, clo.weightId)];

                            return (<React.Fragment key={scoreKey(student.id, clo.weightId)}>
                                <td style={{ backgroundColor: passColor(isEnglish ? entry?.value > 0 : entry?.value >= clo.weight * 0.5) }}>
                                    <span className="export-text" style={{ display: 'none' }}>
                                        {entry?.value}
                                        {entry?.makeup ? '*' : ''}
                                    </span>
                                    <span className="no-export">
                                        <input
                                            type="text"
                                            data-row={rowIndex}
                                            data-col={colIndex}
                                            value={entry?.value ?? ''}
                                            onChange={(e) => onCommit(student.id, clo.weightId, e.target.value, clo.weight)}
                                            onKeyDown={(e) => {
                                                let r = rowIndex, c = colIndex;
                                                if (e.key === 'Enter' || e.key === 'ArrowDown') r++;
                                                else if (e.key === 'ArrowUp') r--;
                                                else if (e.key === 'ArrowRight') c++;
                                                else if (e.key === 'ArrowLeft') c--;
                                                else return;
                                                const next = document.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
                                                if (next) { e.preventDefault(); next.focus(); next.select(); }
                                            }}
                                            onPaste={(e) => onPaste(e, rowIndex, colIndex)}
                                            onFocus={(e) => e.target.select()}
                                            onBlur={(e) => {
                                                const val = e.target.value;
                                                const formatted = (val === '' || val === '.') ? '' : String(parseFloat(val));
                                                onCommit(student.id, clo.weightId, formatted, clo.weight, true);
                                            }}
                                            style={{ backgroundColor: 'transparent', border: 'none', width: '45px', textAlign: 'center', outline: 'none', color: 'inherit' }}
                                        />
                                        {entry?.makeup ? '*' : ''}
                                    </span>
                                </td>
                                {isEnglish && <td>{getBand(Math.round(entry?.value))}</td>}
                            </React.Fragment>);
                        })}
                        <td>{total}{hasMakeup ? '*' : ''}</td>
                        {isEnglish && <td>{getBand(Math.round(total))}</td>}
                        <td style={{ backgroundColor: passColor(pass) }}>{pass ? 'sastified' : 'unsastified'}{hasMakeup ? '*' : ''}</td>
                        {isEnglish && semester.number == 1 && <td style={{ backgroundColor: passColor(passSem2) }}>{passSem2 ? 'ជាប់ស្វ័យប្រវត្តិ' : 'តម្រូវឲ្យប្រឡង'}</td>}
                    </tr>
                )
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
    const [scoreMap, setScoreMap] = useState(buildInitialScoreMap);
    const [isMakeup, setIsMakeup] = useState(Object.values(scoreMap).some(s => !!s.makeup));

    const docRef = useRef(null);
    const timeoutsMap = useRef({});

    const handleCommit = (studentId, weightId, rawValue, max, instant = false) => {
        if (rawValue !== '' && !/^\d*\.?\d*$/.test(rawValue)) return;

        const num = (rawValue === '' || rawValue === '.') ? 0 : parseFloat(rawValue);
        const effectiveMax = max ?? 100;
        if (num < 0 || num > effectiveMax)
            return ctx.message.error(`must be between 0 and ${effectiveMax}`);

        const key = scoreKey(studentId, weightId);

        setScoreMap(prev => ({
            ...prev,
            [key]: { ...prev[key], value: num, makeup: isMakeup }
        }));

        const execute = () => {
            timeoutsMap.current[key] = null;
            const student = students.find(({ id }) => id == studentId);
            const originalScore = student.scores.find(s => s.weightId == weightId && s.courseId == schedule.courseId);

            if (originalScore && originalScore.value != num)
                ctx.api.request({
                    url: 'score:update',
                    method: 'POST',
                    params: { filterByTk: originalScore.id },
                    data: { value: num, makeup: isMakeup }
                }).then(res => {
                    const idx = student.scores.findIndex(s => s.weightId == weightId);
                    student.scores[idx] = resObj(res);
                }).catch(() =>
                    setScoreMap(prev => ({
                        ...prev,
                        [key]: { ...prev[key], value: originalScore.value, makeup: originalScore.makeup }
                    }))
                );
            else
                ctx.api.request({
                    url: 'score:create',
                    method: 'POST',
                    data: {
                        student: student.id,
                        weight: weightId,
                        course: schedule.courseId,
                        value: num,
                        makeup: isMakeup
                    }
                }).then(res => student.scores.push(resObj(res))
                ).catch(() =>
                    setScoreMap(prev => ({
                        ...prev,
                        [key]: { ...prev[key], value: 0, makeup: false }
                    }))
                );
        };

        if (timeoutsMap.current[key])
            clearTimeout(timeoutsMap.current[key]);

        if (instant && timeoutsMap.current[key])
            execute();
        else if (!instant)
            timeoutsMap.current[key] = setTimeout(execute, 1000);
    };

    const handlePaste = async (e, startRowIdx, startColIdx) => {
        e.preventDefault();
        const text = e.clipboardData.getData('Text');
        if (!text.trim()) return;

        const rows = text.trim().split(/\r?\n/).map(row => row.split('\t'));

        if (startRowIdx + rows.length > students.length)
            return ctx.message.error("Pasted data exceeds student row boundary.");

        const updates = [];

        for (let r = 0; r < rows.length; r++) {
            const studentIndex = startRowIdx + r;
            const student = students[studentIndex];
            const rowData = rows[r];

            if (startColIdx + rowData.length > allClos.length)
                return ctx.message.error("Pasted data exceeds column boundary.");

            for (let c = 0; c < rowData.length; c++) {
                const cloIndex = startColIdx + c;
                const clo = allClos[cloIndex];
                const raw = rowData[c].trim();

                if (raw === '') continue;

                const num = parseFloat(raw);
                if (isNaN(num) || num < 0 || num > clo.weight)
                    return ctx.message.error(`"${student.khmerName}", CLO ${clo.cloNumber}: value "${raw}" is invalid or exceeds maximum.`);

                updates.push({
                    student,
                    clo,
                    val: num
                });
            }
        }

        if (updates.length === 0) return;

        let globalMakeup = false;

        setScoreMap(prev => {
            const next = { ...prev };
            updates.forEach(({ student, clo, val }) => {
                const key = scoreKey(student.id, clo.weightId);
                const originalScore = student.scores.find(s => s.weightId == clo.weightId && s.courseId == schedule.courseId);

                next[key] = { ...next[key], value: val, makeup: globalMakeup };

                if (originalScore && originalScore.value != val)
                    ctx.api.request({
                        url: 'score:update',
                        method: 'POST',
                        params: { filterByTk: originalScore.id },
                        data: { value: val, makeup: globalMakeup }
                    }).then(res => {
                        const idx = student.scores.findIndex(s => s.weightId == clo.weightId);
                        student.scores[idx] = resObj(res);
                    });
                else
                    ctx.api.request({
                        url: 'score:create',
                        method: 'POST',
                        data: {
                            student: student.id,
                            weight: clo.weightId,
                            course: schedule.courseId,
                            value: val,
                            makeup: globalMakeup
                        }
                    }).then(res => student.scores.push(resObj(res)));
            });
            ctx.message.success(`Pasted ${updates.length} scores successfully.`);
            return next;
        });
    };

    const download = (isExcel = false) => {
        const clonedDoc = docRef.current.cloneNode(true);

        // Strip out the interactive React Suffix inputs
        clonedDoc.querySelectorAll('.no-export').forEach(el => el.remove());

        // Flip the underlying invisible text into view so MS Word detects them properly
        clonedDoc.querySelectorAll('.export-text').forEach(el => el.style.display = 'inline');

        const fullHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office'
                  xmlns:x='urn:schemas-microsoft-com:office:${isExcel ? 'excel' : 'word'}'
                  xmlns='https://www.w3.org/TR/html40'>
                <head>
                    <meta charset='utf-8'>
                </head>
                <body>
                    ${clonedDoc.innerHTML}
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
        <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span>
                ប្រឡងសង?
                <Switch checked={isMakeup} onChange={setIsMakeup} />
            </span>
            <Button type="primary" onClick={() => download(false)}>download word</Button>
            <Button onClick={() => download(true)}>download excel</Button>
        </div>
        <p>* = ធ្លាប់ធ្លាក់</p>
        <p>you can also paste from excel as long as the name ordering is the same</p>
        <ScoreTable ref={docRef} scoreMap={scoreMap} onCommit={handleCommit} onPaste={handlePaste} />
    </>);
};

ctx.render(<App />);