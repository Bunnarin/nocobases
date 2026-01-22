const { React } = ctx.libs;

let questions = [];
await ctx.api.request({
  url: 'evaluationQuestion:list',
}).then(({ data }) => questions = data.data);

const handleSubmit = async (e) => {
  e.preventDefault();

  let schedule;
  await ctx.api.request({
    url: 'schedule:get',
    params: {
      appends: 'completedStudents',
      filterByTk: ctx.value
    },
  }).then(({ data }) => schedule = data.data);
  console.log(schedule);

  const form = e.target;
  const results = {};

  questions.forEach((field, i) => {
    schedule[`question${i}`] ??= {};
    if (field.type === 'checkbox') {
      const checkboxes = form.querySelectorAll(`input[name="${field.label}"]:checked`);
      results[field.label] = Array.from(checkboxes).map(cb => cb.value);
      Array.from(checkboxes).forEach(({ value }) => {
        schedule[`question${i}`][value] ??= 0;
        schedule[`question${i}`][value] += 1;
      });
    } else {
      const input = form.elements[field.label];
      if (!input.value) return;
      results[field.label] = input.value;
      schedule[`question${i}`][input.value] ??= 0;
      schedule[`question${i}`][input.value] += 1;
    }
  });
  schedule.completedStudents ??= [];
  schedule.completedStudents.push(ctx.user.studentId);

  await ctx.api.request({
    url: 'schedule:update',
    method: 'POST',
    params: { filterByTk: ctx.value },
    data: schedule
  });

  ctx.message.success(JSON.stringify(results));
};

const App = () =>
(
  <form onSubmit={handleSubmit} style={containerStyle}>
    {questions.map((field, index) => (
      <div key={index} style={fieldGroupStyle}>
        <label style={labelStyle}>
          {field.label}
          {field.required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>

        {/* Text Inputs */}
        {field.type === 'text' && (
          <input
            name={field.label}
            type="text"
            required={field.required}
            style={inputStyle}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        )}

        {/* MCQ Dropdown */}
        {field.type === 'mcq' && (
          <select name={field.label} required={field.required} style={inputStyle}>
            <option value="">Select an option...</option>
            {field.choices.split('\n').map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        {/* Checkbox Group */}
        {field.type === 'checkbox' && (
          <div style={checkboxGroupStyle}>
            {field.choices.split('\n').map((choice) => (
              <label key={choice} style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  name={field.label}
                  value={choice}
                />
                {choice}
              </label>
            ))}
          </div>
        )}
      </div>
    ))}

    <button type="submit" style={buttonStyle}>
      Submit
    </button>
  </form>
);

const containerStyle = {
  maxWidth: '500px',
  margin: '2rem auto',
  padding: '2rem',

  display: 'flex',
  flexDirection: 'column',
  gap: '1.5rem',
  fontFamily: 'Khmer OS Battambang'
};

const fieldGroupStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem'
};

const labelStyle = {
  fontSize: '0.9rem',
  fontWeight: '600',
  color: '#374151',
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
};

const inputStyle = {
  padding: '0.6rem 0.8rem',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  fontSize: '1rem',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const checkboxGroupStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: '8px',
  padding: '10px',
  backgroundColor: '#f9fafb',
  borderRadius: '6px',
  border: '1px solid #f3f4f6'
};

const checkboxLabelStyle = {
  fontSize: '0.85rem',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  cursor: 'pointer'
};

const buttonStyle = {
  marginTop: '1rem',
  padding: '0.8rem',
  backgroundColor: '#2563eb',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontWeight: '600',
  cursor: 'pointer',
  transition: 'background-color 0.2s'
};

ctx.render(<App />);