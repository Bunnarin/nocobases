const scheduleId = await ctx.getVar('ctx.popup.resource.filterByTk');

const { React } = ctx.libs;
const { useState } = React;
const { Button, Select, Input } = ctx.libs.antd;

// get config, see if we're allowed to make change during this period
// this KV table has a key val pair. it's is ISOstring that tells us the last date that we're allowed to make change
let deadlinePassed = true;
await ctx.api.request({
  url: 'KV:get',
  params: {
    filterByTk: 'evaluationDeadline'
  },
}).then(({ data }) => {
  if (data?.data?.value)
    deadlinePassed = new Date(data.data.value) <= new Date();
});

let { data: { data: questions } } = await ctx.api.request({
  url: 'evaluationQuestion:list',
});

const { data: { data: semesters } } = await ctx.api.request({
  url: 'semester:list',
  params: {
    filter: {
      $or: [
        { startDate: { $dateOn: { type: "lastYear" } } },
        { startDate: { $dateOn: { type: "thisYear" } } },
        { startDate: { $dateOn: { type: "nextYear" } } }
      ]
    }
  }
});

// find the semester whose middle is closest to now
const semester = semesters.reduce((prev, curr) => {
  const time = (dateStr) => new Date(dateStr).getTime();
  const prevMiddle = time(prev.startDate) + (time(prev.endDate) - time(prev.startDate)) / 2;
  const currMiddle = time(curr.startDate) + (time(curr.endDate) - time(curr.startDate)) / 2;
  const prevDiff = Math.abs(prevMiddle - new Date().getTime());
  const currDiff = Math.abs(currMiddle - new Date().getTime());
  return currDiff < prevDiff ? curr : prev;
});

// if today is closer to the end than the mid of the semester, then we append the CLo qs
const now = new Date().getTime();
const start = new Date(semester.startDate).getTime();
const end = new Date(semester.endDate).getTime();
const mid = (start + end) / 2;
const closerToEnd = Math.abs(end - now) < Math.abs(mid - now);

if (closerToEnd) {
  let CLOs = [];
  await ctx.api.request({
    url: 'schedule:get',
    params: {
      filterByTk: scheduleId,
      appends: 'course,course.CLOs'
    },
  }).then(({ data }) => CLOs = data.data.course.CLOs);
  questions.push(...CLOs.map(CLO => ({
    label: `សូមវាយតម្លៃសមត្ថភាពដែលប្អូនទទួលបានសម្រាប់ CLO ${CLO.number} "${CLO.khmerStatement || CLO.statement}"`,
    type: 'mcq',
    required: true,
    choices: '<50\n51-60\n61-70\n71-80\n81-90\n91-100'
  })));
}

const App = () => {
  const [formData, setFormData] = useState({});

  const handleInputChange = (label, value) =>
    setFormData(prev => ({ ...prev, [label]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (deadlinePassed)
      return ctx.message.error('Deadline has passed. You cannot submit changes.');

    // Validate required fields
    for (const field of questions)
      if (field.required && !formData[field.label])
        return ctx.message.error(`Please answer: ${field.label}`);

    // so that the fetched answer counter dont get stale
    const { data: { data: schedule } } = await ctx.api.request({
      url: 'schedule:get',
      params: {
        filterByTk: scheduleId,
        appends: 'completedStudents'
      },
    });

    if (schedule.completedStudents.find(s => s.id === ctx.user.studentId))
      return ctx.message.error('You have already submitted your answers.');

    // lazy reset: keep data until first student submits
    const noStudentYet = schedule.completedStudents.length == 0;
    if (noStudentYet) // reset counter (yes forgive me for delegating this task to the frontend)
      Object.keys(schedule).forEach(key => {
        if (key.startsWith('question'))
          schedule[key] = {};
      });

    questions.forEach((field, i) => {
      schedule[`question${i}`] ??= {};
      if (field.type === 'checkbox') {
        const values = formData[field.label] || [];
        values.forEach((value) => {
          schedule[`question${i}`][value] ??= 0;
          schedule[`question${i}`][value] += 1;
        });
      } else {
        const value = formData[field.label];
        if (!value) return;
        schedule[`question${i}`][value] ??= 0;
        schedule[`question${i}`][value] += 1;
      }
    });

    await ctx.api.request({
      url: 'schedule:update',
      method: 'POST',
      params: { filterByTk: scheduleId },
      data: schedule
    });

    ctx.message.success('you can close the popup now');
  };

  return (
    <form onSubmit={handleSubmit} style={containerStyle}>
      {deadlinePassed && <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(255, 255, 255, 0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}></div>}
      {questions.map((field, index) => (
        <div key={index} style={fieldGroupStyle}>
          <label>
            {field.label}
            {field.required && <span style={{ color: '#ef4444' }}>*</span>}
          </label>

          {/* Text Inputs */}
          {field.type === 'text' && (
            <Input
              value={formData[field.label] || ''}
              onChange={(e) => handleInputChange(field.label, e.target.value)}
            />
          )}

          {/* Select Inputs (MCQ or Checkbox) */}
          {(field.type === 'mcq' || field.type === 'checkbox') && (
            <Select
              mode={field.type === 'checkbox' ? 'multiple' : undefined}
              placeholder={field.type === 'checkbox' ? 'Select options...' : 'Select an option...'}
              value={formData[field.label] || (field.type === 'checkbox' ? [] : undefined)}
              onChange={(val) => handleInputChange(field.label, val)}
              options={field.choices.split('\n').filter(c => c.trim()).map(c => ({
                label: c,
                value: c
              }))}
            />
          )}
        </div>
      ))}

      <Button type="primary" htmlType="submit">
        submit
      </Button>
    </form>
  );
};

const containerStyle = {
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

ctx.render(<App />);
