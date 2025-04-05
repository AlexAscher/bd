const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const sql = require("mssql");

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
app.post("/lesson", async (req, res) => {
  const { subject, date, theme } = req.body;

  try {
    // Создаём новый запрос
    const request = new sql.Request();
    request.input("subject", sql.NVarChar, subject);
    request.input("date", sql.Date, date);
    request.input("theme", sql.NVarChar, theme);

    // Выполняем параметризованный запрос
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
// 🔹 Получить оценку и информацию об учениках по урокам
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
// Получить список учеников
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

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
