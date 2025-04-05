const sql = require("mssql");
const PDFDocument = require("pdfkit");
const fs = require("fs");

async function generateStudentsReport() {
  const doc = new PDFDocument({ size: "A4" });
  const filePath = "./Ведомость.pdf";
  doc.pipe(fs.createWriteStream(filePath));

  try {
    const studentsQuery = await sql.query(`
      SELECT 
        p.txtPupilSurname AS surname,
        p.txtPupilName AS name,
        CONVERT(VARCHAR(10), p.datBirthday, 120) AS birthdate,
        p.txtAddress AS address
      FROM tblPupil p
    `);

    for (const student of studentsQuery.recordset) {
      doc.fontSize(14).text(`ФИО: ${student.surname} ${student.name}`);
      doc.text(`Дата рождения: ${student.birthdate}`);
      doc.text(`Адрес: ${student.address}`);

      const subjectsQuery = await sql.query(`
        SELECT 
          s.txtSubjectName AS subject,
          t.txtTeacherName AS teacher,
          s.intHours AS hours
        FROM tblSubject s
        JOIN tblTeacher t ON s.intTeacherId = t.intTeacherId
        WHERE s.intSubjectId IN (
          SELECT DISTINCT intSubjectId FROM tblMark WHERE intPupilId = (
            SELECT intPupilId FROM tblPupil WHERE txtPupilSurname = '${student.surname}' AND txtPupilName = '${student.name}'
          )
        )
      `);

      doc.moveDown().fontSize(12).text("Предметы:", { underline: true });
      for (const subject of subjectsQuery.recordset) {
        doc.text(
          `- ${subject.subject} (${subject.hours} часов), учитель: ${subject.teacher}`
        );
      }

      doc.moveDown().text("--------------------------------------------------");
    }

    doc.end();
    console.log(`Отчет «Ведомость» успешно создан: ${filePath}`);
  } catch (err) {
    console.error("Ошибка при генерации отчета:", err);
  }
}

module.exports = generateStudentsReport;
