const { React } = ctx.libs;
const { Button } = ctx.libs.antd;
const { useRef, useState, useEffect } = React;

const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: ctx.value,
        appends: 'course,course.program,course.program.faculty,course.weights,course.weights.assessment,course.weights.PLO,course.weights.CLO,class,class.students,class.students.scores'
    },
});

const students = schedule.class.students.sort((a, b) => a.khmerName?.localeCompare(b.khmerName, 'km'));
const { weights, program } = schedule.course;

const assessments = Object.values(weights.reduce((acc, { assessment, CLO, PLO, weight, id: weightId }) => {
    acc[assessment.name] ??= { ...assessment, PLOs: {} };
    const currentPLO = PLO || { id: 0, statement: '' };
    const currentCLO = CLO ? { ...CLO, weight, weightId } : { weight, weightId, statement: '' };
    acc[assessment.name].PLOs[currentPLO.id] ??= { ...currentPLO, CLOs: [] };
    acc[assessment.name].PLOs[currentPLO.id].CLOs.push(currentCLO);
    return acc;
}, {})).map(assessment => ({ ...assessment, PLOs: Object.values(assessment.PLOs) }));

const allClos = assessments.flatMap(assessment =>
    assessment.PLOs.flatMap(plo =>
        plo.CLOs.map(clo => ({ ...clo, assessmentName: assessment.name }))
    )
);

const totalMaxScore = allClos.reduce((sum, c) => sum + c.weight, 0);

// ── helpers ────────────────────────────────────────────────────────────────────

const scoreKey = (studentId, weightId) => `${studentId}-${weightId}`;

// Build initial scoreMap from server data
const buildInitialScoreMap = () => {
    const map = {};
    students.forEach(student =>
        student.scores?.forEach(s =>
            map[scoreKey(s.studentId, s.weightId)] = { value: s.value, id: s.id, makeup: s.makeup }
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

const SuffixInput = ({ max, value, weightId, studentId, rowIndex, colIndex, onCommit }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [localValue, setLocalValue] = useState(value ?? '');
    const timeoutRef = useRef(null);

    // Keep in sync if parent scoreMap changes (e.g. initial load)
    useEffect(() => setLocalValue(value ?? ''), [value]);

    const student = students.find(({ id }) => id == studentId);
    const originalScore = student.scores?.find(s => s.weightId == weightId);
    let makeup = originalScore?.makeup;

    const handleChange = (e) => {
        const raw = e.target.value;
        const num = raw === '' ? 0 : parseInt(raw);
        if (isNaN(num) || num < 0 || num > max)
            return ctx.message.error(`Score must be between 0 and ${max}`);

        setLocalValue(raw === '' ? '' : num);

        const isOldValFailed = originalScore?.value < max * 0.5;
        const isNewValPassed = num >= max * 0.5;
        const isOldValCreatedAtToday = new Date(originalScore?.createdAt).toDateString() === new Date().toDateString();
        if (isOldValFailed && isNewValPassed && !isOldValCreatedAtToday) makeup = true;

        onCommit(num, makeup);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (originalScore)
                ctx.api.request({
                    url: 'score:update',
                    method: 'POST',
                    params: { filterByTk: originalScore.id },
                    data: { value: num, makeup }
                });
            else
                ctx.api.request({
                    url: 'score:create',
                    method: 'POST',
                    data: {
                        student: studentId,
                        weight: weightId,
                        course: schedule.courseId,
                        value: num
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
                // this disable the scroll
                type="text"
                min="0"
                max={max}
                step="1"
                data-row={rowIndex}
                data-col={colIndex}
                value={localValue}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
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

const ScoreTable = ({ scoreMap, onCommit }) => (<>
    <style>{`
            th { border: 1pt solid #000; padding: 6px; text-align: center; background-color: #f2f2f2; }
            td { border: 1pt solid #000; padding: 6px; text-align: center; }
            .header-table td { border: none; width: 30%; }
        `}</style>
    <table style={{ fontFamily: 'Khmer OS Battambang', borderCollapse: 'collapse', width: '100%' }}>
        <thead>
            <tr>
                <th rowSpan={3}>សិស្ស</th>
                {assessments.map(assessment => {
                    const totalClos = assessment.PLOs.reduce((s, p) => s + p.CLOs.length, 0);
                    return (
                        <th key={assessment.name} colSpan={totalClos} title={assessment.name}
                            style={{ padding: '4px', maxWidth: totalClos * 80 + 'px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {assessment.name}
                        </th>
                    );
                })}
                <th rowSpan={3}>សរុប</th>
                <th rowSpan={3}>លទ្ធផល</th>
            </tr>
            <tr>
                {assessments.map(assessment =>
                    assessment.PLOs.map(plo => (
                        <th key={plo.id} colSpan={plo.CLOs.length} title={plo.statement}>
                            {plo.number ? `PLO ${plo.number}` : ''}
                        </th>
                    ))
                )}
            </tr>
            <tr>
                {assessments.map(assessment =>
                    assessment.PLOs.map(plo =>
                        plo.CLOs.map(clo => (
                            <th key={clo.weightId} title={clo.statement}>
                                {clo.number ? `CLO ${clo.number}` : ''}
                            </th>
                        ))
                    )
                )}
            </tr>
        </thead>
        <tbody>
            {students.map((student, rowIndex) => {
                const { total, hasMakeup } = getTotal(student.id, scoreMap);
                const pct = totalMaxScore > 0 ? (total / totalMaxScore) * 100 : 0;
                const pass = pct >= 50;
                return (
                    <tr key={student.id}>
                        <td>{student.khmerName}</td>
                        {allClos.map((clo, colIndex) => (
                            <td key={scoreKey(student.id, clo.weightId)}>
                                <SuffixInput
                                    max={clo.weight}
                                    value={scoreMap[scoreKey(student.id, clo.weightId)]?.value}
                                    studentId={student.id}
                                    weightId={clo.weightId}
                                    rowIndex={rowIndex}
                                    colIndex={colIndex}
                                    onCommit={(val, mk) => onCommit(student.id, clo.weightId, val, mk)}
                                />
                            </td>
                        ))}
                        <td>{total}{hasMakeup ? '*' : ''}/{totalMaxScore}</td>
                        <td>
                            {pass ? 'Pass' : 'Fail'}{hasMakeup ? '*' : ''}
                        </td>
                    </tr>
                );
            })}
        </tbody>
    </table>
</>);

// ── Hidden document template (plain text, captured for Word export) ────────────

const DocTemplate = React.forwardRef(({ scoreMap }, ref) => (
    <div ref={ref} style={{ fontFamily: 'Khmer OS Battambang, Arial, sans-serif' }}>
        <style>{`
            th { border: 1pt solid #000; padding: 6px; text-align: center; background-color: #f2f2f2; }
            td { border: 1pt solid #000; padding: 6px; text-align: center; }
            .header-table td { border: none; width: 30%; }
        `}</style>

        <table className="header-table" style={{ width: '100%', marginBottom: '20px' }}>
            <tr>
                <td><br /><br />សាកលវិទ្យាល័យភូមិន្ទកសិកម្ម<br />{program.faculty?.khmerName}</td>
                <td></td>
                <td>ព្រះរាជាណាចក្រកម្ពុជា<br />ជាតិ សាសនា ព្រះមហាក្សត្រ</td>
            </tr>
        </table>

        <p style={{ textAlign: 'center' }}>
            បញ្ជីរាយនាមនិស្សិត {program.khmerName}
            <br />{schedule.course.khmerName} ថ្នាក់ {schedule.class.name}
        </p>

        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
                <tr>
                    <th rowSpan={3}>សិស្ស</th>
                    {assessments.map(assessment => {
                        const totalClos = assessment.PLOs.reduce((s, p) => s + p.CLOs.length, 0);
                        return <th key={assessment.name} colSpan={totalClos}>{assessment.name}</th>;
                    })}
                    <th rowSpan={3}>សរុប</th>
                    <th rowSpan={3}>លទ្ធផល</th>
                </tr>
                <tr>
                    {assessments.map(assessment =>
                        assessment.PLOs.map(plo => (
                            <th key={plo.id} colSpan={plo.CLOs.length} title={plo.statement}>
                                {plo.number ? `PLO ${plo.number}` : ''}
                            </th>
                        ))
                    )}
                </tr>
                <tr>
                    {assessments.map(assessment =>
                        assessment.PLOs.map(plo =>
                            plo.CLOs.map(clo => (
                                <th key={clo.weightId} title={clo.statement}>
                                    {clo.number ? `CLO ${clo.number}` : ''}
                                </th>
                            ))
                        )
                    )}
                </tr>
            </thead>
            <tbody>
                {students.map(student => {
                    const { total, hasMakeup } = getTotal(student.id, scoreMap);
                    const pct = totalMaxScore > 0 ? (total / totalMaxScore) * 100 : 0;
                    const pass = pct >= 50;
                    return (
                        <tr key={student.id}>
                            <td style={{ textAlign: 'left' }}>{student.khmerName}</td>
                            {allClos.map(clo => {
                                const entry = scoreMap[scoreKey(student.id, clo.weightId)];
                                return <td key={`${student.id}-${clo.weightId}`}>{entry?.value ?? ''}{entry?.makeup ? '*' : ''}</td>;
                            })}
                            <td style={{ fontWeight: 'bold' }}>{total}{hasMakeup ? '*' : ''}/{totalMaxScore}</td>
                            <td style={{ fontWeight: 'bold' }}>{pass ? 'Pass' : 'Fail'}{hasMakeup ? '*' : ''}</td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
));

// ── App ────────────────────────────────────────────────────────────────────────

const App = () => {
    const [scoreMap, setScoreMap] = useState(buildInitialScoreMap);
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

    const download = () => {
        const contentHTML = docRef.current.innerHTML;
        const fullHTML = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office'
                  xmlns:w='urn:schemas-microsoft-com:office:word'
                  xmlns='https://www.w3.org/TR/html40'>
            <head><meta charset='utf-8'>
            <style>
                body { font-family: 'Khmer OS Battambang', sans-serif; }
                table { border-collapse: collapse; width: 100%; }
                td, th { border: 1pt solid #000; padding: 5pt; text-align: center; }
                .header-table td { border: none; }
            </style>
            </head><body>
                ${contentHTML}
            </body></html>
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
        <Button type="primary" onClick={download} style={{ marginBottom: '10px' }}>Download</Button>
        <ScoreTable scoreMap={scoreMap} onCommit={handleCommit} />
        <div style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }}>
            <DocTemplate ref={docRef} scoreMap={scoreMap} />
        </div>
    </>);
};

ctx.render(<App />);