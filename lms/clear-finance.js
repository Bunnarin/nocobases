console.log('student: ', student);
console.log('sem: ', semesterNum);
console.log('foundation major: ', foundationMajor);

// need to handle first year as well
const auditLogs = [student.balance];
let balance = student.balance;
student.majors.forEach(m => {
    // deduct
    if (semesterNum == 1 && payAnnual) {
        if (student.year == 1)
            balance -= foundationMajor.annualFee;
        else
            balance -= m.annualFee;
    }
    else {
        if (student.year == 1)
            balance -= foundationMajor.semesterFee;
        else
            balance -= m.semesterFee;
    }
    auditLogs.push(balance);

    // scholarship
    if (student.scholarshipCoverage > 0) {
        balance += balance * student.scholarshipCoverage / 100;
        auditLogs.push(balance);
    }

    // now we create another auditLog to even it all out
    balance = student.balance;
    auditLog.push(balance);
});
const newAuditLogs = auditLogs.map((element, index, arr) => {
    if (index < arr.length - 1)
        return [element, arr[index + 1]];
    // Return undefined for the last element, which will be filtered out later
    return undefined;
}).filter(pair => pair !== undefined);
let auditSQL = `INSERT INTO "auditLog" (collection, field, "recordId", "oldValue", "newValue","createdById", "createdAt") VALUES ` +
    newAuditLogs.map(([oldVal, newVal]) => `('student', 'balance', ${student.id}, '${oldVal}', '${newVal}', '${userId}', NOW())`).join(', ') + ');';
console.log('sql: ', auditSQL);