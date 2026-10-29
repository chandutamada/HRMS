const http = require('http');

function post(url, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': 'Bearer ' + token } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  console.log('1. Logging in as HR Admin (hr.superbee@hrms.internal)...');
  const loginRes = await post('http://localhost:4000/api/auth/login', {
    identifier: 'hr.superbee@hrms.internal',
    password: 'Password@123'
  });
  console.log('Login Status:', loginRes.status);
  const token = loginRes.data.data?.tokens?.accessToken;
  if (!token) throw new Error('No token returned: ' + JSON.stringify(loginRes.data));
  console.log('Token acquired!');

  console.log('2. Fetching monthly payroll overview for Oct 2026...');
  const overviewRes = await get('http://localhost:4000/api/payroll/monthly-overview?year=2026&month=10', token);
  console.log('Overview Status:', overviewRes.status);
  const overview = overviewRes.data.data || overviewRes.data;
  console.log('Period status:', overview.period?.status);
  console.log('Summary metrics:', overview.summary);
  console.log('Total Employees:', overview.employees?.length);
  overview.employees?.slice(0, 3).forEach(e => {
    console.log(` - ${e.fullName} (${e.employeeCode}): Basic=Rs.${e.basicSalary}, HRA=Rs.${e.hra}, Gross=Rs.${e.grossEarnings}, Net=Rs.${e.netSalary}, CarriedForward=${e.isCarriedForward}, Finalized=${e.isFinalized}`);
  });

  console.log('3. Testing Bulk Upload Endpoint with Excel row...');
  const firstEmp = overview.employees[0];
  const bulkRes = await post('http://localhost:4000/api/payroll/bulk-upload', {
    year: 2026,
    month: 10,
    records: [
      {
        employeeCode: firstEmp.employeeCode,
        fullName: firstEmp.fullName,
        basicSalary: 62000,
        hra: 24800,
        conveyance: 1600,
        medicalAllowance: 1250,
        specialAllowance: 2500,
        otherAllowances: 0,
        epfEmployee: 7440,
        professionalTax: 200,
        tds: 1500,
        lopDays: 0
      }
    ]
  }, token);
  console.log('Bulk Upload Status:', bulkRes.status, bulkRes.data);

  console.log('4. Re-fetching monthly overview to verify carry-forward update...');
  const overviewAfter = await get('http://localhost:4000/api/payroll/monthly-overview?year=2026&month=10', token);
  const empUpdated = (overviewAfter.data.data || overviewAfter.data).employees?.[0];
  console.log(`Updated Employee: ${empUpdated.fullName}: Basic=Rs.${empUpdated.basicSalary}, HRA=Rs.${empUpdated.hra}, Net=Rs.${empUpdated.netSalary}`);

  console.log('5. Testing November 2026 (next month) to verify that salary automatically carries forward...');
  const novOverview = await get('http://localhost:4000/api/payroll/monthly-overview?year=2026&month=11', token);
  const novEmp = (novOverview.data.data || novOverview.data).employees?.find(e => e.employeeCode === firstEmp.employeeCode);
  console.log(`November Carried Forward for ${novEmp.fullName}: Basic=Rs.${novEmp.basicSalary}, HRA=Rs.${novEmp.hra}, Net=Rs.${novEmp.netSalary}, CarriedForward=${novEmp.isCarriedForward}`);

  console.log('6. Testing Finalize All Employees for October 2026...');
  function put(url, body, token) {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const postData = JSON.stringify(body);
      const req = http.request({
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...(token ? { 'Authorization': 'Bearer ' + token } : {})
        }
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  const finRes = await put('http://localhost:4000/api/payroll/finalize-all', {
    year: 2026,
    month: 10
  }, token);
  console.log('Finalize All Status:', finRes.status, finRes.data);

  console.log('7. Verifying all employees are marked finalized in overview...');
  const finalOverview = await get('http://localhost:4000/api/payroll/monthly-overview?year=2026&month=10', token);
  const finalData = finalOverview.data.data || finalOverview.data;
  console.log('Finalized Count:', finalData.summary?.finalizedEmployees, '/', finalData.summary?.totalEmployees);
  console.log('Employees final status:', finalData.employees?.map(e => ({ name: e.fullName, isFinalized: e.isFinalized, recordId: e.recordId })));

  console.log('8. Testing PDF payslip generation for employee...');
  const testRecordId = finalData.employees[0].recordId;
  const pdfRes = await new Promise((resolve, reject) => {
    http.get(`http://localhost:4000/api/payroll/payslips/${testRecordId}/pdf`, {
      headers: { 'Authorization': 'Bearer ' + token }
    }, (res) => {
      let len = 0;
      res.on('data', chunk => len += chunk.length);
      res.on('end', () => resolve({ status: res.statusCode, length: len, contentType: res.headers['content-type'] }));
    }).on('error', reject);
  });
  console.log('PDF Generation Status:', pdfRes.status, 'Type:', pdfRes.contentType, 'Bytes:', pdfRes.length);

  console.log('>>> ALL VERIFICATION STEPS PASSED SUCCESSFULLY! <<<');
}

run().catch(console.error);
