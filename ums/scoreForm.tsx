const React = ctx.libs.React;

const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: ctx.value,
        appends: 'course,course.weights,course.weights.assessment,course.weights.PLO,course.weights.CLO,class.students,class.students.scores'
    },
});

const students = schedule.class.students;
const weights = schedule.course.weights;

// helper
const isExpired = (createdAt) => {
    if (!createdAt) return false;
    const diffTime = Math.abs(new Date() - new Date(createdAt));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 30;
};

const assessments = Object.values(weights.reduce((acc, { assessment, CLO, PLO, weight, id: weightId }) => {
    // 1. Initialize Assessment if it doesn't exist
    acc[assessment.name] ??= {
        ...assessment,
        PLOs: {} // Use an object temporarily for easy lookups
    };

    const currentPLO = PLO || { id: 0, statement: '' };
    const currentCLO = CLO ? { ...CLO, weight, weightId } : { weight, weightId, statement: '' };

    // 2. Initialize PLO inside that Assessment if it doesn't exist
    acc[assessment.name].PLOs[currentPLO.id] ??= {
        ...currentPLO,
        CLOs: []
    };

    // 3. Push the CLO into the specific PLO's array
    acc[assessment.name].PLOs[currentPLO.id].CLOs.push(currentCLO);

    return acc;
}, {})).map(assessment => ({
    ...assessment,
    // 4. Convert the PLOs lookup object back into an array
    PLOs: Object.values(assessment.PLOs)
}));

const SuffixInput = ({ disabled, value, max, weightId, studentId }) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const timeoutRef = React.useRef(null); // To store the debounce timer

    const handleChange = (e) => {
        // 1. Clear the previous timer every time the user types
        if (timeoutRef.current)
            clearTimeout(timeoutRef.current);
        if (e.target.value === '')
            return;
        if (e.target.value < 0 || e.target.value > max)
            return ctx.message.error('score must be between 0 and ' + max);
        const student = students.find(({ id }) => id == studentId);
        const originalScore = student.scores.find(s =>
            s.weightId == weightId &&
            s.studentId == studentId
        );
        if (e.target.value === originalScore?.value)
            return;
        // 2. Set a new timer to call the API after 500ms of silence
        timeoutRef.current = setTimeout(() => {
            if (originalScore)
                ctx.api.request({
                    url: 'score:update',
                    method: 'POST',
                    params: {
                        filterByTk: originalScore.id
                    },
                    data: {
                        value: e.target.value
                    }
                });
            else
                ctx.api.request({
                    url: 'score:create',
                    method: 'POST',
                    data: {
                        student: studentId,
                        weight: weightId,
                        course: schedule.course.id,
                        value: e.target.value
                    }
                });
        }, 1000);
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <input
                type="number"
                min="0"
                max={max}
                step="1"
                disabled={disabled}
                title={disabled ? 'you cannot change after 1 month' : ''}
                defaultValue={value}
                onChange={handleChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={{
                    border: 'none',
                    width: isFocused ? '65px' : '45px'
                }}
            />

            {/* Conditionally render the suffix based on focus state */}
            {isFocused && (
                <span
                    style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                    }}
                >
                    /{max}
                </span>
            )}
        </div>
    );
}

const App = () => (
    <table style={{ fontFamily: 'Khmer OS Battambang', borderCollapse: 'collapse', width: '100%' }}>
        <thead>
            {/* Header Row 1: Assessment Name */}
            <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th rowSpan={3} style={{ border: '1px solid black' }}>សិស្ស</th>
                {assessments.map(assessment => {
                    // Total CLOs across all PLOs in this assessment
                    const totalClos = assessment.PLOs.reduce((sum, plo) => sum + plo.CLOs.length, 0);
                    return (
                        <th key={assessment.name} colSpan={totalClos} style={{ border: '1px solid black' }}>
                            {assessment.name}
                        </th>
                    );
                })}
            </tr>

            {/* Header Row 2: PLO under Assessment */}
            <tr style={{ backgroundColor: '#e9ecef' }}>
                {assessments.map(assessment =>
                    assessment.PLOs.map(plo => (
                        <th key={plo.id} title={plo.statement} colSpan={plo.CLOs.length} style={{ border: '1px solid black' }}>
                            {plo.number ? `PLO ${plo.number}` : ''}
                        </th>
                    ))
                )}
            </tr>

            {/* Header Row 3: CLOs under each PLO */}
            <tr style={{ backgroundColor: '#f2f2f2' }}>
                {assessments.map(assessment =>
                    assessment.PLOs.map(plo =>
                        plo.CLOs.map(clo => (
                            <th key={clo.weightId} title={clo.statement} style={{ border: '1px solid black' }}>
                                {clo.number ? `CLO ${clo.number}` : ''}
                            </th>
                        ))
                    )
                )}
            </tr>
        </thead>

        <tbody>
            {students.map(student => (
                <tr key={student.id}>
                    <td style={{ border: '1px solid black', padding: '8px' }}>
                        {student.khmerName}
                    </td>
                    {assessments.map(assessment =>
                        assessment.PLOs.map(plo =>
                            plo.CLOs.map(clo => {
                                const originalScore = student.scores.find(s =>
                                    s.weightId === clo.weightId && s.studentId === student.id
                                );
                                return (
                                    <td key={`${student.id}-${clo.weightId}`} style={{ border: '1px solid black', textAlign: 'center' }}>
                                        <SuffixInput
                                            max={clo.weight}
                                            value={originalScore?.value ?? ''}
                                            studentId={student.id}
                                            weightId={clo.weightId}
                                            disabled={isExpired(originalScore?.createdAt)}
                                        />
                                    </td>
                                );
                            })
                        )
                    )}
                </tr>
            ))}
        </tbody>
    </table>
);

ctx.render(<App />);