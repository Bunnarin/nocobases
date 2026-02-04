const { data: { data: [semester] } } = await ctx.api.request({
    url: 'semester:list',
    params: {
        pageSize: 1,
        sort: 'startDate'
    },
});
const { data: { data: portfolios } } = await ctx.api.request({
    url: 'coursePortfolio:list',
    params: {
        'appends[]': 'files',
        filter: {
            courseId: ctx.value
        }
    }
});
const { data: { data: criterias } } = await ctx.api.request({
    url: 'coursePortfolioCriteria:list',
});

const FILE_COLOR = {
    '.docx': '#2b579a',
    '.xlsx': '#217346',
    '.pptx': '#d24726',
    '.pdf': '#ff0000'
};

const { React } = ctx.libs;
const { useState } = React;

const PortfolioTable = () => {
    const [loading, setLoading] = useState({});

    const handleUpload = async (criteriaId, event) => {
        const file = event.target.files[0];
        if (!file) return;

        setLoading(prev => ({ ...prev, [criteriaId]: true }));

        // Step 1: Create the attachment record
        // Since FormData constructor is blocked, we pass the file in 'data'
        // Many axios-based requesters (like ctx.api) handle this automatically
        const attachRes = await ctx.api.request({
            url: 'file:create',
            method: 'POST',
            data: { file },
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        const newFileId = attachRes.data?.data?.id;

        // Step 2: Update or Create the Portfolio record
        const existing = portfolios.find(p => p.criteriaId === criteriaId);

        if (existing)
            await ctx.api.request({
                url: `coursePortfolio:update`,
                method: 'POST',
                params: {
                    filterByTk: existing.id
                },
                data: {
                    files: [...existing.files?.map(({ id }) => ({ id })), newFileId]
                }
            });
        else
            await ctx.api.request({
                url: 'coursePortfolio:create',
                method: 'POST',
                data: {
                    course: ctx.value,
                    criteria: criteriaId,
                    semester: semester.id,
                    files: [{ id: newFileId }]
                }
            });
        window.location.reload();
        setLoading(prev => ({ ...prev, [criteriaId]: false }));
    };

    return (
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
            <thead>
                <tr style={{ backgroundColor: '#fafafa' }}>
                    <th style={styles.th}>Criteria</th>
                    <th style={styles.th}>Attached Files</th>
                </tr>
            </thead>
            <tbody>
                {criterias.map(crit => {
                    const portfolio = portfolios.find(p => p.criteriaId === crit.id);
                    const hasFiles = portfolio?.files?.length > 0;

                    return (
                        <tr key={crit.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            <td style={styles.td}>
                                <div style={{ fontWeight: '600' }}>{crit.name}</div>
                                <label style={{ ...styles.uploadBtn, backgroundColor: hasFiles ? '#1890ff' : '#ff4d4f' }}>
                                    {loading[crit.id] ? '...' : 'Upload'}
                                    <input
                                        type="file"
                                        style={{ display: 'none' }}
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                        onChange={(e) => handleUpload(crit.id, e)}
                                        disabled={loading[crit.id]}
                                    />
                                </label>
                            </td>

                            <td style={styles.td}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                    {hasFiles ? (
                                        portfolio.files.map(f => (
                                            <div key={f.id} style={styles.fileWrapper}>
                                                <div style={{ ...styles.fileBlock, color: '#ffffff', backgroundColor: FILE_COLOR[f.extname] }}>
                                                    {f.extname.slice(1)}
                                                </div>
                                                {f.filename}
                                            </div>
                                        )
                                        )
                                    ) : (
                                        <span style={{ color: '#bfbfbf', fontSize: '12px' }}>No files uploaded</span>
                                    )}
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

const styles = {
    th: { borderBottom: '1px solid #e8e8e8', padding: '16px', textAlign: 'left' },
    td: { padding: '16px', verticalAlign: 'top' },
    uploadBtn: {
        display: 'inline-block',
        padding: '6px 16px',
        color: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '13px'
    },
    fileWrapper: {
        width: '75px', // Slightly wider to accommodate text
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '4px',
        borderRadius: '4px',
        marginRight: '12px'
    },
    fileBlock: {
        width: '40px',
        height: '30px',
        borderRadius: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '6px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: 'none' // Removed border since background color is now primary
    },
    // Updated as requested: White text for the filename
    fileNameText: {
        fontSize: '10px',
        color: '#ffffff', // Your change applied
        textAlign: 'center',
        width: '100%',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        padding: '0 2px'
    }
};

ctx.render(<PortfolioTable />);