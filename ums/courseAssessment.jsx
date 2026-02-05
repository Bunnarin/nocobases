const { data: { data: { programId, CLOs, weights: oldWeights } } } = await ctx.api.request({
    url: 'course:get',
    params: {
        filterByTk: ctx.value,
        appends: 'weights,CLOs'
    },
});

let { data: { data: PLOs } } = await ctx.api.request({
    url: 'PLO:list',
});

// restrict PLO if has programId
const specificPLOs = PLOs.filter(p => p.programId == programId);
if (specificPLOs.length > 0)
    PLOs = specificPLOs;
else // use the default PLOs
    PLOs = PLOs.filter(p => p.programId == null);

const { data: { data: assessments } } = await ctx.api.request({
    url: 'assessment:list',
});

const { React } = ctx.libs;
const { useState } = React;
const { Select } = ctx.libs.antd;

const weightToDetach = [];

const App = () => {
    const [weights, setWeights] = useState(oldWeights);

    const onSubmit = async (e) => {
        let totalWeight = 0;
        weights.forEach(w => totalWeight += w.weight);
        if (totalWeight !== 100)
            return ctx.message.error('the total weight is not 100%');

        if (e.target.textContent === 'submit') {
            e.target.textContent = 'click again to submit';
            return ctx.message.error('after this, you cannot make any further changes. click again to submit');
        }

        // detach weights
        for (const weightId of weightToDetach)
            ctx.api.request({
                url: 'weight:update',
                method: 'POST',
                params: {
                    filterByTk: weightId
                },
                data: {
                    courseId: null
                }
            });

        const currentWeights = [...weights];
        for (let i = 0; i < currentWeights.length; i++) {
            const w = currentWeights[i];
            // only create the newly formed weight
            if (!w.new) continue;

            const payload = {
                ...w,
                assessment: w.assessmentId,
                PLO: w.PLOId,
                CLO: w.CLOId
            };
            delete payload.id;

            const { data: { data: newWeight } } = await ctx.api.request({
                url: 'weight:create',
                method: 'POST',
                data: payload
            });

            // Update local snapshot and state
            currentWeights[i] = newWeight;
            setWeights([...currentWeights]);
        }
        ctx.message.success('done. you can close this popup now');
    }

    const addWeight = (CLOId) => {
        setWeights(prev => [
            ...prev,
            {
                new: true,
                id: Math.random().toString(36).slice(2, 9),
                course: ctx.value,
                CLOId,
                PLOId: '',
                assessmentId: '',
                weight: 10
            }
        ]);
    };

    const removeWeight = (weightId) => {
        setWeights(prev => prev.filter(w => w.id !== weightId));
        weightToDetach.push(weightId);
    }

    const updateWeight = (weightId, key, value) =>
        setWeights(prev => prev.map(w =>
            w.id != weightId ? w : { ...w, [key]: parseInt(value) }
        ));

    return (
        <div>
            <style>{`
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
                th { background-color: #f5f5f5; }
                .ant-select, input { width: 100% !important; }
                input { width: 70%; padding: 6px; }
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

                            // Uniqueness logic:
                            // Filter assessments already used for THIS CLO + THIS PLO
                            const usedAssessmentIds = weights
                                .filter(other =>
                                    other.CLOId === clo.id &&
                                    other.PLOId === w.PLOId &&
                                    other.id !== w.id &&
                                    w.PLOId // Only filter if PLO is selected
                                )
                                .map(other => parseInt(other.assessmentId));

                            // Filter PLOs already used for THIS CLO + THIS Assessment
                            const usedPLOIds = weights
                                .filter(other =>
                                    other.CLOId === clo.id &&
                                    other.assessmentId === w.assessmentId &&
                                    other.id !== w.id &&
                                    w.assessmentId // Only filter if Assessment is selected
                                )
                                .map(other => parseInt(other.PLOId));

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
                                        <Select
                                            showSearch
                                            placeholder="Select PLO"
                                            optionFilterProp="label"
                                            value={w.PLOId || undefined}
                                            disabled={isLocked}
                                            onChange={(val) => updateWeight(w.id, 'PLOId', val)}
                                            style={{ width: '100%' }}
                                            options={PLOs
                                                .filter(p => !usedPLOIds.includes(p.id))
                                                .map(p => ({ label: `PLO ${p.number}`, value: p.id }))
                                            }
                                        />
                                    </td>
                                    <td>
                                        <Select
                                            showSearch
                                            placeholder="Select Assessment"
                                            optionFilterProp="label"
                                            value={w.assessmentId || undefined}
                                            disabled={!w.PLOId || isLocked}
                                            onChange={(val) => updateWeight(w.id, 'assessmentId', val)}
                                            style={{ width: '100%' }}
                                            options={assessments
                                                .filter(a => !usedAssessmentIds.includes(a.id))
                                                .map(a => ({ label: a.name, value: a.id }))
                                            }
                                        />
                                    </td>
                                    <td>
                                        <input
                                            required
                                            disabled={!w.new}
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