// get config, see if we're allowed to make change during this period
// this KV table has a key val pair. it's is ISOstring that tells us the last date that we're allowed to make change
let deadlinePassed = true;
await ctx.api.request({
    url: 'KV:get',
    params: {
        filterByTk: 'courseSpecDeadline'
    },
}).then(({ data }) => {
    if (data?.data?.value)
        deadlinePassed = new Date(data.data.value) <= new Date();
});

const { data: { data: { programId, CLOs, weights: oldWeights } } } = await ctx.api.request({
    url: 'course:get',
    params: {
        filterByTk: ctx.value,
        appends: 'weights,CLOs'
    },
});

let { data: { data: PLOs } } = await ctx.api.request({
    url: 'PLO:list'
});

// restrict PLO if has programId
const specificPLOs = PLOs.filter(p => p.programId == programId);
if (specificPLOs.length > 0)
    PLOs = specificPLOs;
else // use the default PLOs
    PLOs = PLOs.filter(p => p.programId == null);

const { data: { data: assessments } } = await ctx.api.request({
    url: 'assessment:list',
    params: {
        pageSize: 1000 // or else it'll default to only 20
    }
});

const { React } = ctx.libs;
const { useState } = React;
const { Select, Button } = ctx.libs.antd;

const weightToDetach = [];
const cloToDetach = [];

const App = () => {
    const [weights, setWeights] = useState(oldWeights);
    const [localCLOs, setLocalCLOs] = useState(CLOs);
    const [localAssessments, setLocalAssessments] = useState(assessments);
    const [assessmentSearch, setAssessmentSearch] = useState('');

    const onSubmit = async (e) => {
        if (deadlinePassed)
            return ctx.message.error('Deadline has passed. You cannot submit changes.');

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
            await ctx.api.request({
                url: 'weight:update',
                method: 'POST',
                params: {
                    filterByTk: weightId
                },
                data: {
                    courseId: null
                }
            });

        // detach CLOs
        for (const cloId of cloToDetach)
            await ctx.api.request({
                url: 'CLO:update',
                method: 'POST',
                params: {
                    filterByTk: cloId
                },
                data: {
                    courseId: null
                }
            });

        // Create/Update CLOs
        const cloIdMap = {};
        for (let i = 0; i < localCLOs.length; i++) {
            const clo = localCLOs[i];
            if (clo.new)
                await ctx.api.request({
                    url: 'CLO:create',
                    method: 'POST',
                    data: {
                        number: clo.number,
                        statement: clo.statement,
                        khmerStatement: clo.khmerStatement,
                        course: ctx.value
                    }
                }).then(({ data }) => cloIdMap[clo.id] = data.data.id);
            else if (clo.edited)
                ctx.api.request({
                    url: 'CLO:update',
                    method: 'POST',
                    params: { filterByTk: clo.id },
                    data: {
                        statement: clo.statement,
                        khmerStatement: clo.khmerStatement
                    }
                });
        }

        const currentWeights = [...weights];
        for (let i = 0; i < currentWeights.length; i++) {
            const w = currentWeights[i];
            // only create the newly formed weight
            if (!w.new) continue;

            const payload = {
                ...w,
                assessment: w.assessmentId,
                PLO: w.PLOId,
                CLO: cloIdMap[w.CLOId] || w.CLOId
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

    const addCLO = () => {
        const nextNum = localCLOs.length > 0 ? Math.max(...localCLOs.map(c => c.number)) + 1 : 1;
        setLocalCLOs(prev => [
            ...prev,
            {
                new: true,
                id: 'temp-' + Math.random().toString(36).slice(2, 9),
                number: nextNum,
                statement: ''
            }
        ]);
    };

    const removeCLO = (cloId) => {
        setLocalCLOs(prev => prev.filter(c => c.id !== cloId));
        if (typeof cloId == 'number')
            cloToDetach.push(cloId);

        // Also detach any associated weights
        weights.filter(w => w.CLOId === cloId && !w.new)
            .forEach(w => weightToDetach.push(w.id));
        setWeights(prev => prev.filter(w => w.CLOId !== cloId));
    };

    const updateCLO = (cloId, key, value) => {
        setLocalCLOs(prev => prev.map(c =>
            c.id !== cloId ? c : { ...c, [key]: value, edited: !c.new }
        ));
    };

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
        if (typeof weightId == 'number') // meaning that it isn't new
            weightToDetach.push(weightId);
    }

    const updateWeight = (weightId, key, value) =>
        setWeights(prev => prev.map(w =>
            w.id != weightId ? w : { ...w, [key]: parseInt(value) }
        ));

    return (<div style={{ position: 'relative' }}>
        <style>{`
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 10px; border: 1px solid #ddd; text-align: left; vertical-align: top; }
            th { background-color: #f5f5f5; }
            input, textarea { padding: 6px; border: 1px solid #ccc; border-radius: 4px; }
            textarea { resize: vertical; min-height: 60px; }
            
            .deadline-overlay {
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(255, 255, 255, 0.5);
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
            }
        `}</style>

        {deadlinePassed && <div className="deadline-overlay"></div>}

        <Button onClick={addCLO}>Add CLO</Button>
        <br /><br />
        <table>
            <thead>
                <tr>
                    <th>CLO</th>
                    <th>EN Statement</th>
                    <th>KH Statement</th>
                    <th>PLO</th>
                    <th>Assessment</th>
                    <th>Weight (%)</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                {localCLOs.map((clo) => {
                    const cloWeights = weights.filter(w => w.CLOId === clo.id);

                    if (cloWeights.length === 0)
                        return (
                            <tr key={`empty-${clo.id}`}>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        CLO {clo.number}
                                        <Button onClick={() => addWeight(clo.id)}>➕</Button>
                                    </div>
                                </td>
                                <td>
                                    <textarea
                                        placeholder="english statement..."
                                        value={clo.statement}
                                        onChange={(e) => updateCLO(clo.id, 'statement', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <textarea
                                        placeholder="khmer statement..."
                                        value={clo.khmerStatement}
                                        onChange={(e) => updateCLO(clo.id, 'khmerStatement', e.target.value)}
                                    />
                                </td>
                                <td colSpan="4">No weights assigned</td>
                            </tr>
                        );

                    return cloWeights.map((w, index) => {
                        // Logic: Is this row fully "configured"?
                        const isLocked = w.PLOId && w.assessmentId;

                        // Uniqueness logic: Filter assessments already used for THIS CLO + THIS PLO
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
                                {index === 0 && (<>
                                    <td rowSpan={cloWeights.length}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            CLO {clo.number}
                                            <Button onClick={() => addWeight(clo.id)}>➕</Button>
                                        </div>
                                    </td>
                                    <td rowSpan={cloWeights.length}>
                                        <textarea
                                            placeholder="Enter CLO statement..."
                                            value={clo.statement}
                                            onChange={(e) => updateCLO(clo.id, 'statement', e.target.value)}
                                        />
                                    </td>
                                    <td rowSpan={cloWeights.length}>
                                        <textarea
                                            placeholder="khmer statement..."
                                            value={clo.khmerStatement}
                                            onChange={(e) => updateCLO(clo.id, 'khmerStatement', e.target.value)}
                                        />
                                    </td>
                                </>)}
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
                                        onSearch={setAssessmentSearch}
                                        onBlur={() => setAssessmentSearch('')}
                                        filterOption={false}
                                        value={w.assessmentId || undefined}
                                        disabled={!w.PLOId || isLocked}
                                        onChange={async (val) => {
                                            // create if new
                                            if (typeof val === 'string' && val.startsWith('__new__')) {
                                                const name = val.split(':')[1];
                                                const resp = await ctx.api.request({
                                                    url: 'assessment:create',
                                                    method: 'POST',
                                                    data: { name }
                                                });
                                                const newA = resp.data.data;
                                                setLocalAssessments(prev => [...prev, newA]);
                                                updateWeight(w.id, 'assessmentId', newA.id);
                                            } else {
                                                updateWeight(w.id, 'assessmentId', val);
                                            }
                                            setAssessmentSearch('');
                                        }}
                                        options={(() => {
                                            const opts = localAssessments
                                                .filter(a => !usedAssessmentIds.includes(a.id))
                                                .filter(a => a.name.toLowerCase().includes(assessmentSearch.toLowerCase()))
                                                .map(a => ({ label: a.name, value: a.id }));
                                            if (assessmentSearch && !localAssessments.some(a => a.name.toLowerCase() === assessmentSearch.toLowerCase()))
                                                opts.push({ label: `➕ Create "${assessmentSearch}"`, value: `__new__:${assessmentSearch}` });
                                            return opts;
                                        })()}
                                    />
                                </td>
                                <td>
                                    <input
                                        required
                                        disabled={!w.new}
                                        type="number"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={w.weight}
                                        onChange={(e) => updateWeight(w.id, 'weight', e.target.value)}
                                    />
                                </td>
                                <td>
                                    <Button danger onClick={() => removeWeight(w.id)}>✕</Button>
                                </td>
                            </tr>
                        );
                    });
                })}
            </tbody>
        </table>
        <br />
        <Button type="primary" onClick={onSubmit}>submit</Button>
    </div>);
}

ctx.render(<App />);