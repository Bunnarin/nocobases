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
const isExpired = (createdOn) => {
    if (!createdOn) return false;
    const diffTime = Math.abs(new Date() - new Date(createdOn));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 30;
};

const assessments = Object.values(weights.reduce((acc, { assessment, CLO, PLO, weight, id: weightId }) => {
    const aName = assessment.name;
    const cId = CLO.id; // Or CLO.name/number

    // 1. Initialize Assessment if it doesn't exist
    if (!acc[aName]) {
        acc[aName] = {
            ...assessment,
            CLOs: {} // Use an object temporarily for easy lookups
        };
    }

    // 2. Initialize CLO inside that Assessment if it doesn't exist
    if (!acc[aName].CLOs[cId]) {
        acc[aName].CLOs[cId] = {
            ...CLO,
            PLOs: []
        };
    }

    // 3. Push the PLO into the specific CLO's array
    acc[aName].CLOs[cId].PLOs.push({ ...PLO, weight, weightId });

    return acc;
}, {})).map(assessment => ({
    ...assessment,
    // 4. Convert the CLOs lookup object back into an array
    CLOs: Object.values(assessment.CLOs)
}));

console.log(assessments);

const SuffixInput = ({ disabled, value, max, weightId, studentId }) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const timeoutRef = React.useRef(null); // To store the debounce timer

    const handleChange = (e) => {
        // 1. Clear the previous timer every time the user types
        if (timeoutRef.current)
            clearTimeout(timeoutRef.current);
        // 2. Set a new timer to call the API after 500ms of silence
        timeoutRef.current = setTimeout(() => {
            if (e.target.value === '')
                return;
            const student = students.find(({ id }) => id == studentId);
            const originalScore = student.scores.find(s =>
                s.weightId == weightId &&
                s.studentId == studentId
            );
            if (e.target.value === originalScore?.value)
                return;
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
                    // Total PLOs across all CLOs in this assessment
                    const totalPlos = assessment.CLOs.reduce((sum, clo) => sum + clo.PLOs.length, 0);
                    return (
                        <th key={assessment.name} colSpan={totalPlos} style={{ border: '1px solid black', padding: '8px' }}>
                            {assessment.name}
                        </th>
                    );
                })}
            </tr>

            {/* Header Row 2: CLO under Assessment */}
            <tr style={{ backgroundColor: '#e9ecef' }}>
                {assessments.map(assessment =>
                    assessment.CLOs.map(clo => (
                        <th key={clo.id} title={clo.statement} colSpan={clo.PLOs.length} style={{ border: '1px solid black', fontSize: '0.9rem' }}>
                            CLO {clo.number}
                        </th>
                    ))
                )}
            </tr>

            {/* Header Row 3: PLOs under each CLO */}
            <tr style={{ backgroundColor: '#f2f2f2' }}>
                {assessments.map(assessment =>
                    assessment.CLOs.map(clo =>
                        clo.PLOs.map(plo => (
                            <th key={plo.weightId} title={plo.statement} style={{ border: '1px solid black', padding: '4px' }}>
                                PLO {plo.number}
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
                        assessment.CLOs.map(clo =>
                            clo.PLOs.map(plo => {
                                const originalScore = student.scores.find(s =>
                                    s.weightId === plo.weightId && s.studentId === student.id
                                );
                                return (
                                    <td key={`${student.id}-${plo.weightId}`} style={{ border: '1px solid black', textAlign: 'center' }}>
                                        <SuffixInput
                                            max={assessment.weight}
                                            value={originalScore?.value ?? ''}
                                            studentId={student.id}
                                            weightId={plo.weightId}
                                            disabled={isExpired(originalScore?.createdOn)}
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