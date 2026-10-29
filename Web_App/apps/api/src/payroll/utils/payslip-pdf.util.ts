const PDFDocument = require('pdfkit');

export interface PayslipPdfData {
  companyName: string;
  companyAddress?: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  designation: string;
  joiningDate: string;
  bankAccount?: string;
  bankName?: string;
  panNumber?: string;
  uanNumber?: string;
  location?: string;
  monthName: string;
  year: number;
  totalDays: number;
  presentDays: number;
  paidLeaveDays: number;
  lopDays: number;
  basicSalary: number;
  hra?: number;
  da?: number;
  medicalAllowance?: number;
  otherAllowances?: number;
  conveyance?: number;
  specialAllowance?: number;
  grossEarnings: number;
  epfEmployee?: number;
  professionalTax?: number;
  tds?: number;
  totalDeductions: number;
  netSalary: number;
  letterRefNo?: string;
  authorizedBy?: string;
  authorizedRole?: string;
  lineItems?: Array<{ name: string; amount: number; type: 'EARNING' | 'DEDUCTION' }>;
}

function numberToWordsIndian(num: number): string {
  const rounded = Math.round(num);
  if (rounded === 0) return 'Zero';

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n === 0) return '';
    if (n < 20) return a[n];
    const tens = b[Math.floor(n / 10)];
    const units = n % 10 !== 0 ? ` ${a[n % 10]}` : '';
    return `${tens}${units}`;
  }

  function convertThreeDigits(n: number): string {
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    let str = '';
    if (hundreds > 0) {
      str += `${a[hundreds]} Hundred`;
      if (remainder > 0) str += ' ';
    }
    if (remainder > 0) {
      str += convertTwoDigits(remainder);
    }
    return str;
  }

  let words = '';
  const crore = Math.floor(rounded / 10000000);
  let rem = rounded % 10000000;

  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;

  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;

  if (crore > 0) {
    words += `${convertThreeDigits(crore)} Crore `;
  }
  if (lakh > 0) {
    words += `${convertTwoDigits(lakh)} Lakh `;
  }
  if (thousand > 0) {
    words += `${convertTwoDigits(thousand)} Thousand `;
  }
  if (rem > 0) {
    words += convertThreeDigits(rem);
  }

  return `${words.trim()} Only`;
}

export function generatePayslipPdfBuffer(data: PayslipPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Standard A4: 595.28 x 841.89 points
    const doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: true,
      info: {
        Title: `Payslip_${data.employeeCode}_${data.monthName}_${data.year}`,
        Author: 'Superbee Aeronautics Pvt. Ltd.',
        Subject: 'Official Company Payroll Slip',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const navy = '#143862';
    const gold = '#D4AF37';
    const goldLight = '#F0D488';
    const textDark = '#0F2942';
    const headerBlue = '#BDD4E7';

    const pw = 595.28;
    const ph = 841.89;

    // 1. TOP-LEFT GEOMETRIC CORNER ACCENT
    doc.save();
    // Dark blue outer polygon
    doc.polygon([0, 0], [90, 0], [35, 95], [0, 95]).fill(navy);
    // Gold accent wedge
    doc.polygon([0, 36], [36, 36], [18, 68], [0, 68]).fill(gold);
    doc.polygon([36, 36], [68, 0], [82, 0], [45, 52]).fill(goldLight);
    doc.restore();

    // 2. BOTTOM-RIGHT GEOMETRIC CORNER ACCENT
    doc.save();
    doc.polygon([pw, ph - 110], [pw, ph], [pw - 110, ph], [pw - 36, ph - 110]).fill(navy);
    doc.polygon([pw, ph - 74], [pw - 42, ph - 74], [pw - 20, ph - 38], [pw, ph - 38]).fill(gold);
    doc.polygon([pw - 42, ph - 74], [pw - 76, ph], [pw - 92, ph], [pw - 52, ph - 56]).fill(goldLight);
    doc.restore();

    // 3. TOP BRANDING / LOGO LOCKUP
    const logoX = 95;
    const logoY = 32;

    doc.save();
    // Arched text SUPERBEE
    doc.font('Helvetica-Bold').fontSize(10).fillColor(textDark);
    doc.text('S U P E R B E E', logoX - 44, logoY - 14, { width: 110, align: 'center' });

    // Stylized Bee / Drone emblem
    // Center Body
    doc.ellipse(logoX + 11, logoY + 16, 7.5, 12).fill(gold);
    doc.rect(logoX + 4, logoY + 11, 14, 3).fill(navy);
    doc.rect(logoX + 5, logoY + 17, 12, 3).fill(navy);
    doc.circle(logoX + 11, logoY + 5, 5).fill(navy); // Head

    // Wings
    doc.lineWidth(1.2).strokeColor(navy);
    // Upper Wings
    doc.polygon([logoX + 5, logoY + 11], [logoX - 18, logoY + 4], [logoX - 20, logoY + 15], [logoX + 4, logoY + 15]).fillAndStroke('#E0EDF8', navy);
    doc.polygon([logoX + 17, logoY + 11], [logoX + 40, logoY + 4], [logoX + 42, logoY + 15], [logoX + 18, logoY + 15]).fillAndStroke('#E0EDF8', navy);
    // Lower Wings
    doc.polygon([logoX + 5, logoY + 16], [logoX - 12, logoY + 22], [logoX - 10, logoY + 27], [logoX + 5, logoY + 20]).fillAndStroke(goldLight, gold);
    doc.polygon([logoX + 17, logoY + 16], [logoX + 34, logoY + 22], [logoX + 32, logoY + 27], [logoX + 17, logoY + 20]).fillAndStroke(goldLight, gold);

    // Antennae
    doc.moveTo(logoX + 8, logoY + 3).lineTo(logoX + 2, logoY - 3).stroke();
    doc.moveTo(logoX + 14, logoY + 3).lineTo(logoX + 20, logoY - 3).stroke();
    doc.restore();

    // B. Main Company Title
    doc.font('Helvetica-Bold').fontSize(19).fillColor(textDark);
    doc.text('SUPERBEE AERONAUTICS PVT. LTD.', 160, 44, { characterSpacing: 0.5 });

    // C. Horizontal Gold Accent Bar under branding
    doc.save();
    doc.rect(50, 88, 495, 3.5).fill(gold);
    doc.rect(50, 86.8, 495, 1.2).fill(navy);
    doc.rect(50, 91.5, 495, 1.2).fill(navy);
    doc.restore();

    // 4. LETTER REF & PAYROLL SLIP TITLE
    const refYear = data.year || 2026;
    const refCode = data.letterRefNo || `SAPL/HR/${refYear}/${data.employeeCode.replace(/\D/g, '').padEnd(3, '0') || '903'}`;

    doc.font('Helvetica').fontSize(10.5).fillColor('#1E293B');
    doc.text(`Letter Ref. No: ${refCode}`, 50, 110);

    doc.font('Helvetica-Bold').fontSize(19).fillColor(textDark);
    doc.text('PAYROLL SLIP', 345, 106, { width: 200, align: 'right' });

    // Divider line
    doc.moveTo(50, 134).lineTo(545, 134).lineWidth(1).strokeColor('#CBD5E1').stroke();

    // 5. EMPLOYEE DETAILS BLOCK
    const metaY = 146;
    const lineH = 17.5;
    const col1X = 50;
    const colValX = 175;

    const metadata: Array<[string, string]> = [
      ['Month', `: ${data.monthName} ${data.year}`],
      ['Employee Name', `: ${data.employeeName}`],
      ['Employee ID', `: ${data.employeeCode}`],
      ['Designation', `: ${data.designation || 'Specialist'}`],
      ['Location / Dept', `: ${data.location || 'Visakhapatnam, AP'} / ${data.department || 'Aeronautics'}`],
      ['No. of Days in Month', `: ${data.totalDays} | No. of Present Days: ${data.presentDays}`],
    ];

    for (let i = 0; i < metadata.length; i++) {
      const y = metaY + i * lineH;
      doc.font('Helvetica').fontSize(10.5).fillColor('#1E293B').text(metadata[i][0], col1X, y);
      doc.font(i === 1 || i === 2 ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10.5)
        .fillColor(textDark)
        .text(metadata[i][1], colValX, y);
    }

    // 6. EARNINGS & DEDUCTIONS SIDE-BY-SIDE TABLES
    const tableTop = 268;
    const tableWidth = 240;
    const earnX = 50;
    const dedX = 305;

    // Titles
    doc.font('Helvetica').fontSize(13).fillColor(textDark).text('Earnings', earnX, tableTop);
    doc.font('Helvetica').fontSize(13).fillColor(textDark).text('Deductions', dedX, tableTop);

    // Headers
    const headY = tableTop + 20;
    doc.rect(earnX, headY, tableWidth, 20).fill(headerBlue);
    doc.rect(dedX, headY, tableWidth, 20).fill(headerBlue);

    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(textDark);
    doc.text('Description', earnX + 6, headY + 5);
    doc.text('Amount (INR)', earnX + 150, headY + 5, { width: 84, align: 'right' });

    doc.text('Description', dedX + 6, headY + 5);
    doc.text('Amount (INR)', dedX + 150, headY + 5, { width: 84, align: 'right' });

    // Table Content Line Items
    let earnings: Array<{ name: string; amount: number }> = [];
    let deductions: Array<{ name: string; amount: number }> = [];

    if (data.lineItems && data.lineItems.length > 0) {
      earnings = data.lineItems
        .filter((l) => l.type === 'EARNING')
        .map((l) => ({ name: l.name, amount: l.amount }));
      deductions = data.lineItems
        .filter((l) => l.type === 'DEDUCTION')
        .map((l) => ({ name: l.name, amount: l.amount }));
    }

    if (earnings.length === 0) {
      earnings = [
        { name: 'Basic Salary', amount: data.basicSalary || 11250 },
        { name: 'Dearness Allowance (DA)', amount: data.da || 3750 },
        { name: 'House Rent Allowance (HRA)', amount: data.hra || 5625 },
        { name: 'Medical Allowance', amount: data.medicalAllowance || 1250 },
        { name: 'Other Allowances', amount: data.otherAllowances || 3125 },
      ];
    }

    if (deductions.length === 0) {
      deductions = [
        { name: 'Provident Fund', amount: data.epfEmployee || 1800 },
        { name: 'ESIC', amount: 0 },
        { name: 'Professional Tax', amount: data.professionalTax || 200 },
        { name: 'Other Deductions (TDS)', amount: data.tds || 0 },
        { name: 'Other / LOP Deductions', amount: 0 },
      ];
    }

    const maxItems = Math.max(earnings.length, deductions.length, 5);
    let rowY = headY + 26;
    const rowH = 17.5;

    for (let i = 0; i < maxItems; i++) {
      const earn = earnings[i];
      const ded = deductions[i];

      doc.font('Helvetica').fontSize(9.5).fillColor('#1E293B');

      if (earn) {
        doc.text(earn.name, earnX + 6, rowY);
        doc.text(
          earn.amount > 0 ? earn.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'NIL',
          earnX + 150,
          rowY,
          { width: 84, align: 'right' }
        );
      }

      if (ded) {
        doc.text(ded.name, dedX + 6, rowY);
        doc.text(
          ded.amount > 0 ? ded.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'NIL',
          dedX + 150,
          rowY,
          { width: 84, align: 'right' }
        );
      }

      rowY += rowH;
    }

    // Totals Rows
    rowY += 4;
    // Top border line
    doc.moveTo(earnX, rowY).lineTo(earnX + tableWidth, rowY).lineWidth(1).strokeColor('#94A3B8').stroke();
    doc.moveTo(dedX, rowY).lineTo(dedX + tableWidth, rowY).lineWidth(1).strokeColor('#94A3B8').stroke();

    rowY += 6;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(textDark);
    doc.text('Total Earnings', earnX + 6, rowY);
    doc.text(
      data.grossEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      earnX + 150,
      rowY,
      { width: 84, align: 'right' }
    );

    doc.text('Total Deductions', dedX + 6, rowY);
    doc.text(
      data.totalDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      dedX + 150,
      rowY,
      { width: 84, align: 'right' }
    );

    // Gross Salary subline under Total Earnings
    rowY += 13;
    doc.text('Gross Salary', earnX + 6, rowY);

    rowY += 10;
    // Bottom border line
    doc.moveTo(earnX, rowY).lineTo(earnX + tableWidth, rowY).lineWidth(1.2).strokeColor('#94A3B8').stroke();
    doc.moveTo(dedX, rowY).lineTo(dedX + tableWidth, rowY).lineWidth(1.2).strokeColor('#94A3B8').stroke();

    // 7. NET PAY HIGHLIGHT BOX (Spans right column)
    const netBoxY = rowY + 18;
    const netBoxH = 46;
    doc.rect(dedX, netBoxY, tableWidth, netBoxH).fill('#D8E8F5');

    doc.font('Helvetica-Bold').fontSize(15).fillColor(textDark);
    doc.text(
      `Net Pay: ${data.netSalary.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      dedX + 8,
      netBoxY + 8
    );

    const netWords = numberToWordsIndian(data.netSalary);
    doc.font('Helvetica').fontSize(9.5).fillColor('#1E293B');
    doc.text(`In Words: ${netWords}`, dedX + 8, netBoxY + 28);

    // Bank Account & Payment Mode
    const bankY = netBoxY + netBoxH + 10;
    const bankAcc = data.bankAccount
      ? `${data.bankName || 'HDFC Bank'} [••••••••${data.bankAccount.slice(-4)}]`
      : '[Placeholder Account]';

    doc.font('Helvetica').fontSize(10).fillColor('#1E293B');
    doc.text(`Bank Account: ${bankAcc}`, dedX, bankY);
    doc.text('Payment Mode: Bank Transfer', dedX, bankY + 16);

    // 8. AUTHORIZATION, SIGNATURE & OFFICIAL RUBBER STAMP
    const authY = 645;
    doc.font('Helvetica').fontSize(11).fillColor(textDark).text('Authorized by:', 50, authY);
    doc.text('HR Manager - Superbee Aeronautics', 50, authY + 16);

    // Handwritten Calligraphy Signature representation
    const sigY = authY + 44;
    doc.save();
    doc.strokeColor('#1E3A8A').lineWidth(1.5);
    // Draw signature loops and strokes for "K Padmana Kumar"
    doc.moveTo(48, sigY + 12)
      .bezierCurveTo(55, sigY - 12, 70, sigY - 8, 65, sigY + 14)
      .bezierCurveTo(62, sigY + 22, 58, sigY + 8, 80, sigY + 8)
      .bezierCurveTo(90, sigY + 8, 95, sigY + 2, 105, sigY + 10)
      .bezierCurveTo(115, sigY + 16, 120, sigY + 6, 130, sigY + 8)
      .bezierCurveTo(140, sigY + 10, 145, sigY + 15, 155, sigY + 10)
      .stroke();
    doc.moveTo(60, sigY + 6).lineTo(135, sigY + 4).stroke();
    doc.restore();

    // Official Stamp (Concentric Double Rings with Star and Text)
    const stampX = 240;
    const stampY = sigY + 12;
    const stampR = 28;

    doc.save();
    doc.strokeColor('#143862').lineWidth(1.8);
    doc.circle(stampX, stampY, stampR).stroke();
    doc.lineWidth(0.8).circle(stampX, stampY, stampR - 3.5).stroke();
    doc.lineWidth(0.8).circle(stampX, stampY, stampR - 11).stroke();

    // Circular Stamp text representation
    doc.font('Helvetica-Bold').fontSize(5).fillColor('#143862');
    doc.text('SUPERBEE AERONAUTICS', stampX - 24, stampY - 24, { width: 48, align: 'center' });
    doc.text('PVT. LTD. ★', stampX - 24, stampY + 17, { width: 48, align: 'center' });
    doc.fontSize(7).text('★', stampX - 4, stampY - 5);
    doc.restore();

    // Printed Signatory Name below signature
    doc.font('Helvetica-Bold').fontSize(11).fillColor(textDark);
    doc.text('K Padmana Kumar', 50, sigY + 28);

    // 9. FOOTER ADDRESS BAR
    const footY = 794;
    doc.moveTo(40, footY).lineTo(480, footY).lineWidth(0.8).strokeColor('#94A3B8').stroke();

    doc.font('Helvetica-Bold').fontSize(6.8).fillColor('#1E293B');
    doc.text(
      'Address: C/o Centurion University of Technology and Management (CUTM) Ramchandrapur, Jatni, Bhubaneswar, Khurda, Odisha, 752050',
      40,
      footY + 6,
      { width: 440, align: 'center' }
    );
    doc.font('Helvetica').fontSize(6.8).fillColor('#334155');
    doc.text(
      'Corporate office: Flat No – 501, Akruthi Vijayalakshmi Residency, P & T Colony, Seethammadhara, Visakhapatnam, AP-530013.',
      40,
      footY + 17,
      { width: 440, align: 'center' }
    );

    doc.end();
  });
}
