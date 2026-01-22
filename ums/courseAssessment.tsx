const { data: { data: { CLOs } } } = await ctx.api.request({
    url: 'course:get',
    params: {
        filterByTk: ctx.value,
        appends: 'CLOs,CLOs.assessments,CLOs.PLOs'
    },
});

const { React } = ctx.libs;

const App = () => {
    const [weights, setWeights] = React.useState([]);

    const onSubmit = (e) => {
        let totalWeight = 0;
        weights.forEach(w => totalWeight += Number(w.weight));
        if (totalWeight !== 100)
            return ctx.message.error('the total weight is not 100%');

        if (e.target.textContent === 'submit') {
            e.target.textContent = 'click again to submit';
            return ctx.message.error('after this, you cannot make any further changes. click again to submit');
        }

        weights.forEach(w => {
            const payload = { ...w };
            delete payload.id; // Remove temporary React key
            console.log(payload);
            ctx.api.request({
                url: 'weight:create',
                data: payload
            });
        });
        ctx.message.success('done. you can close this popup now');
    }

    const addWeight = (CLOId) => {
        setWeights(prev => [
            ...prev,
            {
                id: Math.random().toString(36).slice(2, 9),
                course: ctx.value,
                CLOId,
                PLOId: '',
                assessmentId: '',
                weight: 10
            }
        ]);
    };

    const removeWeight = (weightId) =>
        setWeights(prev => prev.filter(w => w.id !== weightId));

    const updateWeight = (weightId, key, value) =>
        setWeights(prev => prev.map(w =>
            w.id != weightId ? w : { ...w, [key]: parseInt(value) }
            // the id and weight will always be int
        ));

    return (
        <div>
            <style>{`
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                th { background-color: #f5f5f5; }
                select, input { width: 100%; padding: 6px; }
                input { width: 70%; padding: 6px; }
                select:disabled { background-color: #f9f9f9; color: #666; cursor: not-allowed; }
                .btn-add { color: #007bff; border: none; background: none; cursor: pointer; font-weight: bold; }
            `}</style>

            <table>
                <thead>
                    <tr>
                        <th>CLO</th>
                        <th>PLO</th>
                        <th>Assessment</th>
                        <th>Weight (%)</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {CLOs.map((clo) => {
                        const cloWeights = weights.filter(w => w.CLOId === clo.id);

                        if (cloWeights.length === 0)
                            return (
                                <tr key={`empty-${clo.id}`}>
                                    <td>
                                        <button className="btn-add" onClick={() => addWeight(clo.id)}>
                                            ➕ CLO {clo.number}
                                        </button>
                                    </td>
                                    <td colSpan="4" style={{ color: '#999' }}>No weights assigned</td>
                                </tr>
                            );

                        return cloWeights.map((w, index) => {
                            // Logic: Is this row fully "configured"?
                            const isLocked = w.PLOId && w.assessmentId;

                            // Restriction logic: Find assessments already used for THIS CLO + THIS PLO
                            const usedAssessmentIds = weights
                                .filter(other =>
                                    other.CLOId === clo.id &&
                                    other.PLOId === w.PLOId &&
                                    other.id !== w.id // Don't filter out the current row's selection
                                )
                                .map(other => parseInt(other.assessmentId));

                            return (
                                <tr key={w.id}>
                                    {index === 0 && (
                                        <td rowSpan={cloWeights.length}>
                                            <button className="btn-add" onClick={() => addWeight(clo.id)}>
                                                ➕ CLO {clo.number}
                                            </button>
                                        </td>
                                    )}
                                    <td>
                                        <select
                                            value={w.PLOId}
                                            disabled={isLocked}
                                            onChange={(e) => updateWeight(w.id, 'PLOId', e.target.value)}
                                        >
                                            <option value="">Select PLO</option>
                                            {clo.PLOs.map(plo => (
                                                <option key={plo.id} value={plo.id}>PLO {plo.number}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <select
                                            value={w.assessmentId}
                                            disabled={!w.PLOId || isLocked}
                                            onChange={(e) => updateWeight(w.id, 'assessmentId', e.target.value)}
                                        >
                                            <option value="">Select Assessment</option>
                                            {clo.assessments
                                                .filter(a => !usedAssessmentIds.includes(a.id)) // Hide already used pairs
                                                .map(a => (
                                                    <option key={a.id} value={a.id}>{a.name}</option>
                                                ))
                                            }
                                        </select>
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={w.weight}
                                            onChange={(e) => updateWeight(w.id, 'weight', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <button onClick={() => removeWeight(w.id)}>✕</button>
                                    </td>
                                </tr>
                            );
                        });
                    })}
                </tbody>
            </table>
            <br />
            <button onClick={onSubmit}>
                submit
            </button>
        </div>
    );
}

ctx.render(<App />);