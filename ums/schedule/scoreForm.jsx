const { React } = ctx.libs;
const { Button, Switch, Modal } = ctx.libs.antd;
const { useRef, useState, useEffect, forwardRef } = React;

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

const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: ctx.value,
        appends: 'course,course.program,course.program.faculty,course.weights,course.weights.assessment,course.weights.PLO,course.weights.CLO,class,class.students,class.students.scores'
    },
});

const isEnglish = schedule.course.englishName == 'english';

const students = schedule.class.students.sort((a, b) => a.khmerName?.localeCompare(b.khmerName, 'km'));
const { weights, program } = schedule.course;

const clos = Object.values(weights.reduce((acc, { assessment, CLO, PLO, weight, id: weightId }) => {
    const currentCLO = CLO || { id: 0, number: '', statement: '' };
    const currentPLO = PLO || { id: 0, number: '', statement: '' };

    acc[currentCLO.id] ??= { ...currentCLO, PLOs: {} };
    acc[currentCLO.id].PLOs[currentPLO.id] ??= { ...currentPLO, assessments: [] };

    acc[currentCLO.id].PLOs[currentPLO.id].assessments.push({
        ...assessment,
        weight,
        weightId,
        assessmentName: assessment.name
    });
    return acc;
}, {})).map(clo => ({
    ...clo,
    PLOs: Object.values(clo.PLOs)
})).sort((a, b) => a.number - b.number);

const allClos = clos.flatMap(clo =>
    clo.PLOs.flatMap(plo =>
        plo.assessments.map(assessment => ({
            ...assessment,
            cloNumber: clo.number,
            ploNumber: plo.number
        }))
    )
);

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

const SuffixInput = ({ max, value, makeup, weightId, studentId, rowIndex, colIndex, onCommit, onPaste, checkMakeupPrompt }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [localValue, setLocalValue] = useState(value ?? '');
    const timeoutRef = useRef(null);

    // Keep in sync if parent scoreMap changes (e.g. initial load)
    useEffect(() => setLocalValue(value ?? ''), [value]);

    const student = students.find(({ id }) => id == studentId);
    const originalScore = student.scores?.find(s => s.weightId == weightId);

    const handleChange = async (e) => {
        const raw = e.target.value;
        if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return; // Restrict input strictly to decimals

        const num = (raw === '' || raw === '.') ? 0 : parseFloat(raw);
        if (num < 0 || num > max)
            return ctx.message.error(`Score must be between 0 and ${max}`);

        setLocalValue(raw);

        const currentMakeup = await checkMakeupPrompt(originalScore?.value || 0, max);

        onCommit(num, currentMakeup);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (originalScore)
                ctx.api.request({
                    url: 'score:update',
                    method: 'POST',
                    params: { filterByTk: originalScore.id },
                    data: { value: num, makeup: currentMakeup }
                }).then(res => {
                    const idx = student.scores.findIndex(s => s.weightId == weightId);
                    student.scores[idx] = res.data.data;
                });
            else
                ctx.api.request({
                    url: 'score:create',
                    method: 'POST',
                    data: {
                        student: studentId,
                        weight: weightId,
                        course: schedule.course.id,
                        value: num,
                        makeup: currentMakeup
                    }
                }).then(res => student.scores.push(res.data.data));
        }, 1000);
    };

    const handleKeyDown = (e) => {
        let r = rowIndex, c = colIndex;
        if (e.key === 'Enter' || e.key === 'ArrowDown') r++;
        else if (e.key === 'ArrowUp') r--;
        else if (e.key === 'ArrowRight') c++;
        else if (e.key === 'ArrowLeft') c--;
        else return;
        const next = document.querySelector(`input[data-row="${r}"][data-col="${c}"]`);
        if (next) { e.preventDefault(); next.focus(); next.select(); }
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <input
                // this ensure that scrolling don't modify the value accidentally
                type="text"
                data-row={rowIndex}
                data-col={colIndex}
                value={localValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={onPaste}
                onFocus={(e) => { setIsFocused(true); e.target.select(); }}
                onBlur={() => setIsFocused(false)}
                style={{ border: 'none', width: isFocused ? '65px' : '45px' }}
            />
            {makeup && '*'}
            {isFocused && (
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                    /{max}
                </span>
            )}
        </div>
    );
};

// ── Visible interactive table ──────────────────────────────────────────────────

const ScoreTable = ({ scoreMap, onCommit, onPaste, checkMakeupPrompt }) => (<>
    <style>{`
            th { border: 1pt solid #000; padding: 6px; text-align: center; background-color: #f2f2f2; }
            td { border: 1pt solid #000; padding: 6px; text-align: center; }
            .header-table td { border: none; width: 30%; }
        `}</style>
    <table>
        <thead>
            <tr>
                <th rowSpan={isEnglish ? 1 : 3}>ឈ្មោះ</th>
                {isEnglish ? (
                    allClos.map(c =>
                        <th key={c.weightId} title={c.assessmentName}
                            style={{ padding: '4px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.assessmentName}
                        </th>
                    )
                ) : (
                    clos.map(({ id, number, statement, PLOs }) => {
                        const totalAssessments = PLOs.reduce((s, p) => s + p.assessments.length, 0);
                        return (
                            <th key={id} colSpan={totalAssessments} title={statement}
                                style={{ padding: '4px', maxWidth: totalAssessments * 80 + 'px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {number ? `CLO ${number}` : ''}
                            </th>
                        );
                    })
                )}
            </tr>
            {!isEnglish && (<>
                <tr>
                    {clos.map(({ PLOs }) =>
                        PLOs.map(plo => {
                            const totalAssessments = plo.assessments.length;
                            return (
                                <th key={plo.id} colSpan={totalAssessments} title={plo.statement}>
                                    {plo.number ? `PLO ${plo.number}` : ''}
                                </th>
                            );
                        })
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
            </>)}
        </thead>
        <tbody>
            {students.map((student, rowIndex) => (
                <tr key={student.id}>
                    <td>{student.khmerName}</td>
                    {allClos.map((clo, colIndex) => (
                        <td key={scoreKey(student.id, clo.weightId)}>
                            <SuffixInput
                                max={clo.weight}
                                value={scoreMap[scoreKey(student.id, clo.weightId)]?.value}
                                makeup={scoreMap[scoreKey(student.id, clo.weightId)]?.makeup}
                                studentId={student.id}
                                weightId={clo.weightId}
                                rowIndex={rowIndex}
                                colIndex={colIndex}
                                onCommit={(val, mk) => onCommit(student.id, clo.weightId, val, mk)}
                                onPaste={(e) => onPaste(e, rowIndex, colIndex)}
                                checkMakeupPrompt={checkMakeupPrompt}
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    </table>
</>);

// ── Hidden document template (plain text, captured for Word export) ────────────
const getBand = (score) => {
    if (score >= 8 && score <= 12) return 'A1';
    if (score >= 13 && score <= 16) return 'A2';
    if (score >= 17 && score <= 23) return 'B1';
    if (score >= 24 && score <= 26) return 'B2';
    if (score >= 27 && score <= 28) return 'C1';
    if (score >= 29 && score <= 30) return 'C2';
    return 'F';
}

const DocTemplate = forwardRef(({ scoreMap }, ref) => (
    <div ref={ref}>
        <style>{`
            th { border: 1pt solid #000; padding: 6px; text-align: center; background-color: #f2f2f2; }
            td { border: 1pt solid #000; padding: 6px; text-align: center; }
            .header-table td { border: none; width: 30%; }
        `}</style>

        <table className="header-table" style={{ width: '100%', marginBottom: '20px' }}>
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

        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
                <tr>
                    <th rowSpan={isEnglish ? 1 : 3}>ID</th>
                    <th rowSpan={isEnglish ? 1 : 3}>ឈ្មោះ</th>
                    <th rowSpan={isEnglish ? 1 : 3}>name</th>
                    <th rowSpan={isEnglish ? 1 : 3}>ភេទ</th>
                    <th rowSpan={isEnglish ? 1 : 3}>ថ្ងៃខែឆ្នាំកំណើត</th>
                    {isEnglish ? (
                        allClos.map(c => (<>
                            <th key={c.weightId} title={c.assessmentName}>{c.assessmentName}</th>
                            <th key={c.weightId + '-band'}>band</th>
                        </>))
                    ) : (
                        clos.map(({ id, number, statement, PLOs }) => {
                            const totalAssessments = PLOs.reduce((s, p) => s + p.assessments.length, 0);
                            return (
                                <th key={id} colSpan={totalAssessments} title={statement}>
                                    {number ? `CLO ${number}` : ''}
                                </th>
                            );
                        })
                    )}
                    <th rowSpan={isEnglish ? 1 : 3}>{isEnglish ? 'មធ្យម' : 'សរុប'}</th>
                    <th rowSpan={isEnglish ? 1 : 3}>លទ្ធផល</th>
                    {isEnglish && <th>band</th>}
                </tr>
                {!isEnglish && (<>
                    <tr>
                        {clos.map(({ PLOs }) =>
                            PLOs.map(plo => (
                                <th key={plo.id} colSpan={plo.assessments.length} title={plo.statement}>
                                    {plo.number ? `PLO ${plo.number}` : ''}
                                </th>
                            ))
                        )}
                    </tr>
                    <tr>
                        {clos.map(({ PLOs }) =>
                            PLOs.map(plo =>
                                plo.assessments.map(c => (
                                    <th key={c.weightId} title={c.assessmentName}>
                                        {c.assessmentName}
                                    </th>
                                ))
                            )
                        )}
                    </tr>
                </>)}
            </thead>
            <tbody>
                {students.map(student => {
                    const { total, hasMakeup } = getTotal(student.id, scoreMap);
                    let pass = total / totalMaxScore >= 0.5;
                    // different pass logic for LC
                    const avg = total / allClos.length;
                    if (isEnglish) {
                        const englishPassThreshold = semester.number == 1 ? 8 : 13;
                        pass = avg >= englishPassThreshold;
                    }
                    return (
                        <tr key={student.id}>
                            <td>{student.id}</td>
                            <td>{student.khmerName}</td>
                            <td>{student.englishName}</td>
                            <td>{student.sex ? 'ប' : 'ស'}</td>
                            <td>{student.birthday}</td>
                            {allClos.map(clo => {
                                const entry = scoreMap[scoreKey(student.id, clo.weightId)];
                                return (<>
                                    <td key={scoreKey(student.id, clo.weightId)}>
                                        {entry?.value}
                                        {entry?.makeup ? '*' : ''}
                                    </td>
                                    {isEnglish && <td>{getBand(entry?.value)}</td>}
                                </>);
                            })}
                            {/* if english, then we calculate average */}
                            <td>{isEnglish ? avg : total}{hasMakeup ? '*' : ''}</td>
                            <td>{pass ? 'Pass' : 'Fail'}{hasMakeup ? '*' : ''}</td>
                            {isEnglish && <td>{getBand(avg)}</td>}
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
    const [scoreMapState, setScoreMapState] = useState(buildInitialScoreMap);
    const scoreMapRef = useRef(scoreMapState);
    const initialScoreMapRef = useRef(scoreMapState);
    const setScoreMap = (val) => {
        if (typeof val === 'function') {
            setScoreMapState(prev => {
                const updated = val(prev);
                scoreMapRef.current = updated;
                return updated;
            });
        } else {
            scoreMapRef.current = val;
            setScoreMapState(val);
        }
    };
    const scoreMap = scoreMapState;
    const [isMakeup, setIsMakeupState] = useState(Object.values(scoreMap).some(s => !!s.makeup));
    const isMakeupRef = useRef(Object.values(scoreMap).some(s => !!s.makeup));
    const setIsMakeup = (checked) => {
        setIsMakeupState(checked);
        isMakeupRef.current = checked;
    };

    const hasPromptedRef = useRef(false);
    const isPromptingRef = useRef(false);

    const checkMakeupPrompt = (oldVal, max) => {
        if (hasPromptedRef.current) return Promise.resolve(isMakeupRef.current);

        // the only condition that we prompt is when we have never added a mekeup before (cuz if we have added, it means that by defualt we makeup)
        const scores = Object.values(initialScoreMapRef.current);
        const noScoreMakeup = scores.every(s => !s.makeup);
        const someScoreNotToday = scores.some(s => new Date(s.createdAt).toDateString() !== new Date().toDateString() && s.value !== 0);

        if (oldVal < max * 0.5 && noScoreMakeup && someScoreNotToday) {
            if (isPromptingRef.current)
                return new Promise(resolve => {
                    const interval = setInterval(() => {
                        if (!isPromptingRef.current) {
                            clearInterval(interval);
                            resolve(isMakeupRef.current);
                        }
                    }, 100);
                });

            isPromptingRef.current = true;
            return new Promise(resolve =>
                Modal.confirm({
                    title: 'Makeup Score?',
                    content: 'ពិន្ទុនេះធម្មតា ឬប្រឡងសង?',
                    okText: 'ប្រឡងសង',
                    cancelText: 'ធម្មតា',
                    onOk() {
                        setIsMakeup(true);
                        hasPromptedRef.current = true;
                        isPromptingRef.current = false;
                        resolve(true);
                    },
                    onCancel() {
                        setIsMakeup(false);
                        hasPromptedRef.current = true;
                        isPromptingRef.current = false;
                        resolve(false);
                    }
                })
            );
        }

        return Promise.resolve(isMakeupRef.current);
    };

    const docRef = useRef(null);

    const handleCommit = (studentId, weightId, value, makeup) => {
        const key = scoreKey(studentId, weightId);
        setScoreMap(prev => {
            const next = {
                ...prev,
                [key]: { ...prev[key], value, makeup }
            };
            return next;
        });
    };

    const handlePaste = async (e, startRowIdx, startColIdx) => {
        e.preventDefault();
        const text = e.clipboardData.getData('Text');
        if (!text) return;

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

        let globalMakeup = isMakeupRef.current;
        for (const { student, clo } of updates) {
            const originalScore = student.scores?.find(s => s.weightId == clo.weightId);
            const oldVal = originalScore?.value || 0;
            globalMakeup = await checkMakeupPrompt(oldVal, clo.weight);
        }

        setScoreMap(prev => {
            const next = { ...prev };
            updates.forEach(({ student, clo, val }) => {
                const key = scoreKey(student.id, clo.weightId);
                const originalScore = student.scores?.find(s => s.weightId == clo.weightId);

                next[key] = { ...next[key], value: val, makeup: globalMakeup };

                // Fire API calls asynchronously
                if (originalScore)
                    ctx.api.request({
                        url: 'score:update',
                        method: 'POST',
                        params: { filterByTk: originalScore.id },
                        data: { value: val, makeup: globalMakeup }
                    }).then(res => {
                        const idx = student.scores.findIndex(s => s.weightId == weightId);
                        student.scores[idx] = res.data.data;
                    });
                else
                    ctx.api.request({
                        url: 'score:create',
                        method: 'POST',
                        data: {
                            student: student.id,
                            weight: clo.weightId,
                            course: schedule.course.id,
                            value: val,
                            makeup: globalMakeup
                        }
                    }).then(res => student.scores.push(res.data.data));
            });
            ctx.message.success(`Pasted ${updates.length} scores successfully.`);
            return next;
        });
    };

    const download = () => {
        const fullHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office'
                  xmlns:w='urn:schemas-microsoft-com:office:word'
                  xmlns='https://www.w3.org/TR/html40'>
                <head>
                    <meta charset='utf-8'>
                    <style>
                        body { font-family: 'Khmer OS Battambang', sans-serif; }
                        table { border-collapse: collapse; width: 100%; }
                        td, th { border: 1pt solid #000; padding: 5pt; text-align: center; }
                        .header-table td { border: none; }
                    </style>
                </head>
                <body>${docRef.current.innerHTML}</body>
            </html>
        `;
        const blob = new Blob([fullHTML], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scores_${schedule.class.name}.doc`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (<>
        <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span>
                Makeup score?&nbsp;
                <Switch checked={isMakeup} onChange={(checked) => { setIsMakeup(checked); hasPromptedRef.current = true; }} />
            </span>
            <Button type="primary" onClick={download}>download</Button>
        </div>
        <p>you can also paste from excel as long as the name ordering is the same</p>
        <ScoreTable scoreMap={scoreMap} onCommit={handleCommit} onPaste={handlePaste} checkMakeupPrompt={checkMakeupPrompt} />
        <div style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }}>
            <DocTemplate ref={docRef} scoreMap={scoreMap} />
        </div>
    </>);
};

ctx.render(<App />);