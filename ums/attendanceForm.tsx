const React = ctx.libs.React;
const today = new Date().toISOString().split('T')[0];
let { data: { data: attendances } } = await ctx.api.request({
    url: 'attendance:list',
    params: {
        pageSize: 100,
        filter: {
            scheduleId: ctx.value,
            date: today
        }
    }
});

const { data: { data: schedule } } = await ctx.api.request({
    url: 'schedule:get',
    params: {
        filterByTk: ctx.value,
        appends: 'class,class.students'
    }
});

const students = schedule.class.students;

const App = () => {
    // Initialize state
    // Key: studentId, Value: { status: 'A'|'P'|'L', isLocked: boolean, id?: number }
    const [attendanceStates, setAttendanceStates] = React.useState(() => {
        const map = {};
        students.forEach(s => {
            const att = attendances.find(a => a.studentId === s.id);
            if (att)
                // Lock if Present or Late. Keep Unlocked if Absent so it can be updated.
                map[s.id] = {
                    status: att.status,
                    isLocked: att.status !== 'A',
                    id: att.id
                };
            else
                // No record = Absent and Unlocked
                map[s.id] = { status: 'A', isLocked: false, id: null };
        });
        return map;
    });

    const getNextStatus = {
        A: 'L',
        L: 'P',
        P: 'A'
    };

    const getStatusConfig = {
        A: { label: 'A', color: '#ef4444', bg: '#fef2f2', short: 'A' },
        L: { label: 'L', color: '#f59e0b', bg: '#fffbeb', short: 'L' },
        P: { label: 'P', color: '#10b981', bg: '#ecfdf5', short: 'P' },
        E: { label: 'E', color: '#f59e0b', bg: '#fffbeb', short: 'E' }
    }

    const handleToggle = (studentId) =>
        setAttendanceStates(prev => {
            const current = prev[studentId];
            if (current.isLocked) return prev; // Cannot change locked records

            return {
                ...prev,
                [studentId]: { ...current, status: getNextStatus[current.status] }
            };
        });

    const markAll = (status) =>
        setAttendanceStates(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(studentId => {
                // Only update unlocked records
                if (!next[studentId].isLocked)
                    next[studentId] = { ...next[studentId], status };
            });
            return next;
        });

    const onSubmit = async () => {
        // We process all unlocked records
        const recordsToProcess = students.filter(s => !attendanceStates[s.id].isLocked);
        const results = await Promise.all(recordsToProcess.map(async (s) => {
            const state = attendanceStates[s.id];
            const changed = state.status !== attendances.find(a => a.studentId === s.id)?.status;
            if (state.id && changed) {
                // Update existing
                await ctx.api.request({
                    url: 'attendance:update',
                    method: 'POST',
                    params: { filterByTk: state.id },
                    data: { status: state.status }
                });
                return { studentId: s.id, id: state.id, status: state.status };
            } else if (!state.id) {
                // Create new
                const { data: { data: newRecord } } = await ctx.api.request({
                    url: 'attendance:create',
                    method: 'POST',
                    data: {
                        date: today,
                        status: state.status,
                        student: s.id,
                        schedule: ctx.value
                    }
                });
                return { studentId: s.id, id: newRecord.id, status: state.status };
            }
        }));

        // Update local state with new IDs and locks
        setAttendanceStates(prev => {
            const next = { ...prev };
            results.forEach(({ studentId, id, status }) =>
                next[studentId] = {
                    status,
                    // Lock it if it is NOT Absent. If Absent, keep unlocked.
                    isLocked: status !== 'A',
                    id
                }
            );
            return next;
        });

        ctx.message.success('Submitted successfully.');
    };

    return (
        <div style={{
            fontFamily: "'Inter', 'Khmer OS Battambang', sans-serif",
        }}>
            <style>{`                
                    .attendance-table {
                        border-spacing: 0 8px;
                    }
                    .status-btn {
                        padding: 8px 16px;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        justify-content: center;
                        margin-left: auto;
                    }
                    .status-btn:not(:disabled):hover {
                        transform: translateY(-1px);
                        filter: brightness(0.95);
                    }
                    .status-btn:disabled {
                        cursor: not-allowed;
                        filter: grayscale(0.2);
                    }
                    .action-btn {
                        padding: 10px 20px;
                        border-radius: 10px;
                        border: 1px solid #e2e8f0;
                        background: white;
                        color: #475569;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .action-btn:hover:not(:disabled) {
                        border-color: #cbd5e1;
                        background: #f8fafc;
                        color: #1e293b;
                    }
                    .action-btn:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .submit-btn {
                        background: #2563eb;
                        color: white;
                        border: none;
                    }
                    .submit-btn:hover:not(:disabled) {
                        background: #1d4ed8;
                        color: white;
                    }
                    .student-name {
                        font-weight: 500;
                        color: #1e293b;
                    }
                    .student-id {
                        color: #94a3b8;
                        font-size: 0.85rem;
                    }
                `}</style>

            <button className="action-btn" onClick={() => markAll('P')}>
                <span style={{ color: '#10b981' }}>●</span> Mark All Present
            </button>
            <br />
            <table className="attendance-table">
                <tbody>
                    {students.map(student => {
                        const { status, isLocked } = attendanceStates[student.id];
                        const config = getStatusConfig[status];

                        return (
                            <tr key={student.id} className="attendance-row">
                                <td>
                                    {student.khmerName || student.englishName}
                                </td>
                                <td>
                                    <button
                                        className="status-btn"
                                        onClick={() => handleToggle(student.id)}
                                        disabled={isLocked}
                                        style={{
                                            backgroundColor: isLocked ? '#f1f5f9' : config.bg,
                                            color: isLocked ? '#64748b' : config.color,
                                            border: isLocked ? '1px solid #e2e8f0' : `1px solid ${config.color}40`,
                                        }}
                                    >
                                        <span style={{ fontSize: '1.2em', lineHeight: 1 }}>
                                            {status === 'P' && '✓'}
                                            {status === 'A' && '✕'}
                                            {status === 'L' && '⚠'}
                                        </span>
                                        {config.label}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <br />
            <button
                className="action-btn submit-btn"
                onClick={onSubmit}
            >
                Submit
            </button>
        </div>
    );
};

ctx.render(<App />);