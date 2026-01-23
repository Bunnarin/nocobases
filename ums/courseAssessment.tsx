const { data: { data: { CLOs, weights: oldWeights } } } = await ctx.api.request({
    url: 'course:get',
    params: {
        filterByTk: ctx.value,
        appends: 'weights,CLOs,CLOs.assessments,CLOs.PLOs'
    },
});

const { React } = ctx.libs;

const App = () => {
    const [weights, setWeights] = React.useState(oldWeights);

    const onSubmit = async (e) => {
        let totalWeight = 0;
        weights.forEach(w => totalWeight += Number(w.weight));
        if (totalWeight !== 100)
            return ctx.message.error('the total weight is not 100%');

        if (e.target.textContent === 'submit') {
            e.target.textContent = 'click again to submit';
            return ctx.message.error('after this, you cannot make any further changes. click again to submit');
        }

        for (const w of weights) {
            // only create the newly formed weight
            if (w.id) continue;
            const payload = {
                ...w,
                assessment: w.assessmentId,
                PLO: w.PLOId,
                CLO: w.CLOId
            };

            await ctx.api.request({
                url: 'weight:create',
                method: 'POST',
                data: payload
            }).then(({ data }) =>
                setWeights(prev => prev.map(w => w.id === w.id ? data.data : w))
            );
        }

        // now time to assosicate them with course.weights
        ctx.api.request({
            url: 'course:update',
            method: 'POST',
            params: {
                filterByTk: ctx.value
            },
            data: {
                weights: weights.map(w => w.id)
            }
        });
        ctx.message.success('done. you can close this popup now');
    }

    const addWeight = (CLOId) => {
        setWeights(prev => [
            ...prev,
            {
                tempId: Math.random().toString(36).slice(2, 9),
                course: ctx.value,
                CLOId,
                PLOId: '',
                assessmentId: '',
                weight: 10
            }
        ]);
    };

    const removeWeight = (weightId) =>
        setWeights(prev => prev.filter(w => (w.id || w.tempId) !== weightId));

    const updateWeight = (weightId, key, value) =>
        setWeights(prev => prev.map(w =>
            w.tempId != weightId ? w : { ...w, [key]: parseInt(value) }
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
                                    other.id !== (w.id || w.tempId) // Don't filter out the current row's selection
                                )
                                .map(other => parseInt(other.assessmentId));

                            return (
                                <tr key={w.tempId}>
                                    {index === 0 && (
                                        <td rowSpan={cloWeights.length}>
                                            <button className="btn-add" onClick={() => addWeight(clo.id)}>
                                                ➕ CLO {clo.number}
                                            </button>
                                        </td>
                                    )}
                                    <td>
                                        <select
                                            required
                                            value={w.PLOId}
                                            disabled={isLocked}
                                            onChange={(e) => updateWeight(w.tempId, 'PLOId', e.target.value)}
                                        >
                                            <option value="">Select PLO</option>
                                            {clo.PLOs.map(plo => (
                                                <option key={plo.id} value={plo.id}>PLO {plo.number}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <select
                                            required
                                            value={w.assessmentId}
                                            disabled={!w.PLOId || isLocked}
                                            onChange={(e) => updateWeight(w.tempId, 'assessmentId', e.target.value)}
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
                                            required
                                            disabled={w.id}
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={w.weight}
                                            onChange={(e) => updateWeight(w.tempId, 'weight', e.target.value)}
                                        />
                                    </td>
                                    <td>
                                        <button onClick={() => removeWeight(w.id || w.tempId)}>✕</button>
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