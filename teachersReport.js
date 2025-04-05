const sql = require("mssql");
const PDFDocument = require("pdfkit");
const fs = require("fs");

async function generateTeachersReport() {
  const doc = new PDFDocument({ size: "A4" });
  const filePath = "./Учителя.pdf";
  doc.pipe(fs.createWriteStream(filePath));

  try {
    const teachersQuery = await sql.query(`
      SELECT 
        t.txtTeacherName AS name,
        YEAR(t.datHireDate) AS hireYear,
        t.decSalary AS salary
      FROM tblTeacher t
    `);

    let totalTeachers = 0;

    for (const teacher of teachersQuery.recordset) {
      totalTeachers++;
      doc.fontSize(14).text(`ФИО: ${teacher.name}`);
      doc.text(`Год принятия на работу: ${teacher.hireYear}`);
      doc.text(`Оклад: ${teacher.salary} руб.`);

      const subjectsQuery = await sql.query(`
        SELECT 
          s.txtSubjectName AS subject,
          s.intHours AS hours,
          COUNT(l.intLessonId) AS lessonsCount
        FROM tblSubject s
        LEFT JOIN tblLesson l ON s.intSubjectId = l.intSubjectId
        WHERE s.intTeacherId = (SELECT intTeacherId FROM tblTeacher WHERE txtTeacherName = '${teacher.name}')
        GROUP BY s.txtSubjectName, s.intHours
      `);

      doc.moveDown().fontSize(12).text("Предметы:", { underline: true });
      doc.moveDown();

      const tableData = subjectsQuery.recordset.map((subject) => [
        subject.subject,
        subject.hours,
        subject.lessonsCount,
      ]);

      let totalSubjects = 0;
      let totalHours = 0;

      tableData.forEach(([subject, hours, lessonsCount]) => {
        totalSubjects++;
        totalHours += hours;
        doc.text(`- ${subject}: ${hours} часов, ${lessonsCount} уроков`);
      });

      doc.moveDown().text(`Всего предметов: ${totalSubjects}`);
      doc.text(`Всего часов: ${totalHours}`);
      doc.moveDown().text("--------------------------------------------------");
    }

    doc.moveDown().fontSize(14).text(`Всего учителей: ${totalTeachers}`);
    doc.end();
    console.log(`Отчет «Учителя» успешно создан: ${filePath}`);
  } catch (err) {
    console.error("Ошибка при генерации отчета:", err);
  }
}

module.exports = generateTeachersReport;
