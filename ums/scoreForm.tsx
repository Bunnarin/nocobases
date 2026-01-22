const React = ctx.libs.React;

const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: ctx.value,
        appends: 'course,course.weights,course.weights.assessment,course.weights.PLO,class.students,class.students.scores'
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

const assessments = Object.values(weights.reduce((acc, { assessment, PLO, id: weightId }) => {
    const name = assessment.name;
    acc[name] ??= {
        name,
        PLOs: []
    };
    acc[name].PLOs.push({ ...PLO, weightId });
    return acc;
}, {}));

const SuffixInput = ({ disabled, value, weightId, studentId }) => {
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
                max="100"
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
                    /100
                </span>
            )}
        </div>
    );
}

const App = () =>
(
    <table style={{ fontFamily: 'Khmer OS Battambang' }}>
        <thead>
            {/* Header Row 1: Scoring Criteria */}
            <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th rowSpan={2}>សិស្ស</th>
                {assessments.map(assessment => (
                    <th colSpan={assessment.PLOs.length}
                        style={{ border: 'solid' }}>
                        {assessment.name}
                    </th>
                ))}
            </tr>
            {/* Header Row 2: PLOs under each Criteria */}
            <tr style={{ backgroundColor: '#f2f2f2' }}>
                {assessments.map(assessment =>
                    assessment.PLOs.map(plo => (
                        <th title={plo.statement}
                            style={{ border: 'solid' }}>
                            PLO {plo.number}
                        </th>
                    ))
                )}
            </tr>
        </thead>
        <tbody>
            {students.map(student => (
                <tr>
                    <td style={{ border: 'solid' }}>
                        {student.khmerName}
                    </td>
                    {assessments.map(assessment =>
                        assessment.PLOs.map(plo => {
                            const originalScore = student.scores.find(s =>
                                s.weightId == plo.weightId &&
                                s.studentId == student.id
                            );
                            return (
                                <td style={{ border: 'solid' }}>
                                    <SuffixInput
                                        value={originalScore?.value ?? ''}
                                        studentId={student.id}
                                        weightId={plo.weightId}
                                        disabled={isExpired(originalScore?.createdOn)}
                                    />
                                </td>
                            );
                        })
                    )}
                </tr>
            ))}
        </tbody>
    </table>
);

ctx.render(<App />);