const sql = require("mssql");
const PDFDocument = require("pdfkit");
const fs = require("fs");

async function generateJournalReport(subjectName) {
  const doc = new PDFDocument({ size: "A4" });
  const filePath = "./Школьный журнал.pdf";
  doc.pipe(fs.createWriteStream(filePath));

  try {
    const subjectQuery = await sql.query(`
      SELECT 
        s.txtSubjectName AS subject,
        s.intHours AS hours,
        t.txtTeacherName AS teacher
      FROM tblSubject s
      JOIN tblTeacher t ON s.intTeacherId = t.intTeacherId
      WHERE s.txtSubjectName = '${subjectName}'
    `);

    if (subjectQuery.recordset.length === 0) {
      throw new Error("Предмет не найден");
    }

    const subject = subjectQuery.recordset[0];
    doc.fontSize(14).text(`Предмет: ${subject.subject}`);
    doc.text(`Количество часов: ${subject.hours}`);
    doc.text(`Учитель: ${subject.teacher}`);

    const lessonsQuery = await sql.query(`
      SELECT 
        CONVERT(VARCHAR(10), l.datLessonDate, 120) AS date,
        l.txtTheme AS theme
      FROM tblLesson l
      WHERE l.intSubjectId = (
        SELECT intSubjectId FROM tblSubject WHERE txtSubjectName = '${subjectName}'
      )
      ORDER BY l.datLessonDate DESC
    `);

    doc.moveDown().fontSize(12).text("Уроки:", { underline: true });
    for (const lesson of lessonsQuery.recordset) {
      doc.text(`- ${lesson.date}: ${lesson.theme}`);
    }

    doc.end();
    console.log(`Отчет «Школьный журнал» успешно создан: ${filePath}`);
  } catch (err) {
    console.error("Ошибка при генерации отчета:", err);
  }
}

module.exports = generateJournalReport;
