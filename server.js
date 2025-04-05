const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sql = require("mssql");
const puppeteer = require("puppeteer"); // Для генерации PDF

const app = express();
const PORT = 3000;

// Используем CORS, чтобы фронтенд мог обращаться к серверу
app.use(cors());
app.use(bodyParser.json());

// Конфигурация подключения к базе данных
const dbConfig = {
  user: "User080",
  password: "User080^]98",
  server: "192.168.112.103", // Например, "university.database.windows.net"
  database: "db22207",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

// Функция подключения к базе данных
async function connectDB() {
  try {
    await sql.connect(dbConfig);
    console.log("✅ Подключение к базе данных успешно!");
  } catch (err) {
    console.error("❌ Ошибка подключения к базе:", err);
  }
}
connectDB();

// 🔹 Получить все уроки с учителями
app.get("/lessons", async (req, res) => {
  try {
    const result = await sql.query(`
      SELECT 
        l.intLessonId AS id,
        s.txtSubjectName AS subject,
        CONVERT(VARCHAR(10), l.datLessonDate, 120) AS date,  -- Убираем время
        l.txtTheme AS theme,
        t.txtTeacherName AS teacher
      FROM tblLesson l
      JOIN tblSubject s ON l.intSubjectId = s.intSubjectId
      JOIN tblTeacher t ON s.intTeacherId = t.intTeacherId
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Ошибка при получении уроков:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Добавление нового урока
app.post("/lesson", async (req, res) => {
  const { subject, date, theme } = req.body;

  try {
    const request = new sql.Request();
    request.input("subject", sql.NVarChar, subject);
    request.input("date", sql.Date, date);
    request.input("theme", sql.NVarChar, theme);

    await request.query(`
        INSERT INTO tblLesson (intSubjectId, datLessonDate, txtTheme)
        VALUES (
          (SELECT intSubjectId FROM tblSubject WHERE txtSubjectName = @subject),
          @date,
          @theme
        )
      `);

    res.status(201).json({ message: "Урок добавлен успешно!" });
  } catch (err) {
    console.error("Ошибка при добавлении урока:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Получение информации об уроке и учениках
app.get("/lesson/:id", async (req, res) => {
  const lessonId = req.params.id;
  try {
    const lessonQuery = await sql.query(`
      SELECT 
        l.intLessonId AS id,
        s.txtSubjectName AS subject,
        CONVERT(VARCHAR(10), l.datLessonDate, 120) AS date,  -- Убираем время
        l.txtTheme AS theme,
        t.txtTeacherName AS teacher
      FROM tblLesson l
      JOIN tblSubject s ON l.intSubjectId = s.intSubjectId
      JOIN tblTeacher t ON s.intTeacherId = t.intTeacherId
      WHERE l.intLessonId = ${lessonId}
    `);

    const pupilsQuery = await sql.query(`
      SELECT 
        p.txtPupilSurname AS surname,
        p.txtPupilName AS name,
        CONVERT(VARCHAR(10), p.datBirthday, 120) AS birthdate,  -- Убираем время
        m.intMarkValue AS grade,
        m.txtMarkComment AS comment
      FROM tblMark m
      JOIN tblPupil p ON m.intPupilId = p.intPupilId
      WHERE m.intLessonId = ${lessonId}
    `);

    if (lessonQuery.recordset.length === 0) {
      return res.status(404).json({ error: "Урок не найден" });
    }

    res.json({
      lesson: lessonQuery.recordset[0],
      students: pupilsQuery.recordset,
    });
  } catch (err) {
    console.error("Ошибка при загрузке урока:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Получение списка учеников
app.get("/pupils", async (req, res) => {
  try {
    const result = await sql.query(`
        SELECT 
          intPupilId AS id, 
          txtPupilSurname AS surname, 
          txtPupilName AS name, 
          CONVERT(VARCHAR(10), datBirthday, 120) AS birthdate
        FROM tblPupil
      `);
    res.json(result.recordset);
  } catch (err) {
    console.error("Ошибка при получении учеников:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Добавление оценки
app.post("/grade", async (req, res) => {
  const { lessonId, pupilId, grade, comment } = req.body;
  try {
    const request = new sql.Request();
    request.input("lessonId", sql.Int, lessonId);
    request.input("pupilId", sql.Int, pupilId);
    request.input("grade", sql.Int, grade);
    request.input("comment", sql.NVarChar, comment);
    await request.query(`
        INSERT INTO tblMark (intLessonId, intPupilId, intMarkValue, txtMarkComment)
        VALUES (@lessonId, @pupilId, @grade, @comment)
      `);
    res.status(201).json({ message: "Оценка добавлена успешно!" });
  } catch (err) {
    console.error("Ошибка при добавлении оценки:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// 🔹 Маршрут для генерации PDF-отчета "Учителя"
app.get("/teachers", async (req, res) => {
  try {
    // Запрос к базе данных
    const teachersQuery = await sql.query(`
      SELECT 
        t.txtTeacherName AS teacherName,
        t.intTeacherYear AS hireYear,        -- Используем intTeacherYear
        t.fltTeacherSalary AS salary,        -- Используем fltTeacherSalary
        s.txtSubjectName AS subjectName,
        s.intSubjectVolume AS hours,         -- Используем intSubjectVolume
        COUNT(l.intLessonId) AS lessonsCount
      FROM tblTeacher t
      LEFT JOIN tblSubject s ON t.intTeacherId = s.intTeacherId
      LEFT JOIN tblLesson l ON s.intSubjectId = l.intSubjectId
      GROUP BY t.txtTeacherName, t.intTeacherYear, t.fltTeacherSalary, s.txtSubjectName, s.intSubjectVolume
    `);

    const teachersData = teachersQuery.recordset;

    // Группируем данные по учителям
    const groupedData = {};
    teachersData.forEach((row) => {
      const {
        teacherName,
        hireYear,
        salary,
        subjectName,
        hours,
        lessonsCount,
      } = row;

      if (!groupedData[teacherName]) {
        groupedData[teacherName] = {
          hireYear,
          salary,
          subjects: [],
          totalSubjects: 0,
          totalHours: 0,
        };
      }

      if (subjectName) {
        groupedData[teacherName].subjects.push({
          subjectName,
          hours,
          lessonsCount,
        });
        groupedData[teacherName].totalSubjects += 1;
        groupedData[teacherName].totalHours += hours || 0;
      }
    });

    // Создаем HTML для PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <title>Учителя</title>
        <style>
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid black; padding: 8px; text-align: left; }
          hr { margin: 20px 0; }
          .summary { font-weight: bold; margin-top: 10px; }
        </style>
      </head>
      <body>
        ${Object.entries(groupedData)
          .map(
            ([teacherName, data]) => `
            <h2>${teacherName}</h2>
            <p>Год принятия на работу: ${data.hireYear}</p>
            <p>Оклад: ${data.salary} руб.</p>
            <table>
              <thead>
                <tr>
                  <th>Предмет</th>
                  <th>Количество часов</th>
                  <th>Количество уроков</th>
                </tr>
              </thead>
              <tbody>
                ${data.subjects
                  .map(
                    (subject) => `
                      <tr>
                        <td>${subject.subjectName}</td>
                        <td>${subject.hours}</td>
                        <td>${subject.lessonsCount}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
            <div class="summary">
              Суммарное количество предметов: ${data.totalSubjects}<br>
              Суммарное количество часов: ${data.totalHours}
            </div>
            <hr>
          `
          )
          .join("")}
        <p><strong>Общее количество учителей: ${
          Object.keys(groupedData).length
        }</strong></p>
      </body>
      </html>
    `;

    // Генерация PDF с помощью Puppeteer
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({ format: "A4" });
    await browser.close();

    // Отправка PDF в ответ
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Учителя.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Ошибка при создании отчета:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
