const path = require('path');
const fs = require('fs');
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 4000;

// --- SQLite 초기화 ---
const DB_FILE = path.join(__dirname, 'auth.db');
const db = new sqlite3.Database(DB_FILE);

db.serialize(() => {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login_id TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      company_name TEXT NOT NULL,
      business_reg_number TEXT NOT NULL,
      business_reg_file_path TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
      plan_type TEXT NOT NULL DEFAULT 'free', -- free | paid
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `
  );
});

// --- 업로드 설정 (사업자등록증) ---
const uploadDir = path.join(__dirname, 'uploads', 'business-reg');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// --- 미들웨어 ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  })
);

// 정적 파일: Empowered / portfolio 등 전체 서브폴더를 서비스
const staticRoot = path.join(__dirname, '..');
app.use(express.static(staticRoot));

// --- 메일 전송 설정 ---
let mailTransport = null;

function getMailTransport() {
  if (mailTransport) return mailTransport;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn('[auth-server] SMTP 환경변수가 설정되지 않아 메일 전송을 건너뜁니다.');
    return null;
  }

  mailTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  return mailTransport;
}

async function sendSignupNotificationEmail(payload) {
  const transport = getMailTransport();
  if (!transport) return;

  const {
    login_id,
    company_name,
    business_reg_number,
    contact_email,
    contact_phone,
    filePath
  } = payload;

  const subject = `새 기업 계정 가입 신청: ${company_name} (${login_id})`;
  const textLines = [
    '새로운 기업 계정 가입 신청이 접수되었습니다.',
    '',
    `아이디: ${login_id}`,
    `회사명: ${company_name}`,
    `사업자등록번호: ${business_reg_number}`,
    `담당자 이메일: ${contact_email}`,
    `담당자 연락처: ${contact_phone || '-'}`,
    '',
    '관리자 페이지에서 승인/거절을 진행해 주세요.'
  ];

  const mailOptions = {
    from: process.env.SMTP_FROM || 'no-reply@proby.io',
    to: 'chris@proby.io',
    subject,
    text: textLines.join('\n')
  };

  if (filePath && fs.existsSync(filePath)) {
    mailOptions.attachments = [
      {
        filename: path.basename(filePath),
        path: filePath
      }
    ];
  }

  try {
    await transport.sendMail(mailOptions);
  } catch (err) {
    console.error('[auth-server] signup notification email failed:', err);
  }
}

// --- 유틸 함수 ---
function requireAdmin(req, res, next) {
  if (!req.session.userId || !req.session.isAdmin) {
    return res.status(403).json({ error: 'admin only' });
  }
  next();
}

function getUserById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', id, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

// --- Auth API ---

// 아이디 중복 체크
app.post('/api/auth/check-id', (req, res) => {
  const { loginId } = req.body;
  if (!loginId) {
    return res.status(400).json({ error: 'loginId is required' });
  }
  db.get('SELECT id FROM users WHERE login_id = ?', loginId, (err, row) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'db error' });
    }
    res.json({ available: !row });
  });
});

// 기업회원 회원가입 (사업자등록증 업로드 필수)
app.post(
  '/api/auth/signup-company',
  upload.single('business_reg_file'),
  async (req, res) => {
    try {
      const {
        login_id,
        password,
        company_name,
        business_reg_number,
        contact_email,
        contact_phone
      } = req.body;

      if (
        !login_id ||
        !password ||
        !company_name ||
        !business_reg_number ||
        !contact_email
      ) {
        return res.status(400).json({ error: '필수 항목 누락' });
      }
      if (!req.file) {
        return res.status(400).json({ error: '사업자등록증 파일은 필수입니다.' });
      }

      db.get(
        'SELECT id FROM users WHERE login_id = ?',
        login_id,
        async (err, row) => {
          if (err) {
            console.error(err);
            return res.status(500).json({ error: 'db error' });
          }
          if (row) {
            return res
              .status(409)
              .json({ error: '이미 사용 중인 아이디입니다.' });
          }

          const passwordHash = await bcrypt.hash(password, 12);

          db.run(
            `
            INSERT INTO users (
              login_id, password_hash, company_name,
              business_reg_number, business_reg_file_path,
              contact_email, contact_phone, status, plan_type, is_admin
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'free', 0)
          `,
            [
              login_id,
              passwordHash,
              company_name,
              business_reg_number,
              req.file.path,
              contact_email,
              contact_phone || null
            ],
            function (insertErr) {
              if (insertErr) {
                console.error(insertErr);
                return res.status(500).json({ error: 'db error' });
              }
              // 가입 신청 알림 메일 (실패해도 가입 자체는 성공 처리)
              sendSignupNotificationEmail({
                login_id,
                company_name,
                business_reg_number,
                contact_email,
                contact_phone,
                filePath: req.file.path
              }).catch(() => {});

              return res.json({ ok: true, status: 'pending' });
            }
          );
        }
      );
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'server error' });
    }
  }
);

// 로그인
app.post('/api/auth/login', (req, res) => {
  const { login_id, password } = req.body;
  if (!login_id || !password) {
    return res.status(400).json({ error: 'login_id, password 필수' });
  }

  db.get('SELECT * FROM users WHERE login_id = ?', login_id, async (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'db error' });
    }
    if (!user) {
      return res
        .status(400)
        .json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res
        .status(400)
        .json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    if (user.status !== 'approved') {
      return res.status(403).json({
        error: '관리자 승인 대기 중입니다.',
        status: user.status
      });
    }

    req.session.userId = user.id;
    req.session.isAdmin = !!user.is_admin;
    req.session.hasPaidPlan = user.plan_type === 'paid';

    res.json({ ok: true });
  });
});

// 현재 로그인 상태 조회 (프론트 AUTH_STATE 연동용)
app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ isLoggedIn: false, hasPaidPlan: false, user: null });
  }
  try {
    const user = await getUserById(req.session.userId);
    if (!user) {
      return res.json({ isLoggedIn: false, hasPaidPlan: false, user: null });
    }
    res.json({
      isLoggedIn: true,
      hasPaidPlan: user.plan_type === 'paid',
      user: {
        id: user.id,
        login_id: user.login_id,
        company_name: user.company_name,
        status: user.status,
        plan_type: user.plan_type
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'server error' });
  }
});

// 로그아웃
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

// --- 관리자 API (간단 버전) ---

// 상태별 사용자 목록
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const status = req.query.status || 'pending';
  db.all(
    'SELECT id, login_id, company_name, status, plan_type, created_at FROM users WHERE status = ? ORDER BY created_at DESC',
    status,
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'db error' });
      }
      res.json(rows);
    }
  );
});

// 승인 / 거절 / 유료 플랜 설정
app.post('/api/admin/users/:id/approve', requireAdmin, (req, res) => {
  db.run(
    'UPDATE users SET status = "approved" WHERE id = ?',
    req.params.id,
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'db error' });
      }
      res.json({ ok: true });
    }
  );
});

app.post('/api/admin/users/:id/reject', requireAdmin, (req, res) => {
  db.run(
    'UPDATE users SET status = "rejected" WHERE id = ?',
    req.params.id,
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'db error' });
      }
      res.json({ ok: true });
    }
  );
});

app.post('/api/admin/users/:id/set-paid', requireAdmin, (req, res) => {
  db.run(
    'UPDATE users SET plan_type = "paid" WHERE id = ?',
    req.params.id,
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'db error' });
      }
      res.json({ ok: true });
    }
  );
});

// --- 서버 시작 ---
app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
  console.log(`Serving static files from: ${staticRoot}`);
});

