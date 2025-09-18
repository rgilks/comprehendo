CREATE TABLE IF NOT EXISTS quiz (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language TEXT NOT NULL,
  level TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  question_language TEXT,
  user_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  name TEXT,
  email TEXT,
  image TEXT,
  first_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  language TEXT DEFAULT 'en',
  UNIQUE(provider_id, provider)
);

CREATE TABLE IF NOT EXISTS user_language_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  cefr_level TEXT NOT NULL DEFAULT 'A1',
  correct_streak INTEGER NOT NULL DEFAULT 0,
  last_practiced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, language_code)
);

CREATE TABLE IF NOT EXISTS question_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  is_good INTEGER NOT NULL,
  user_answer TEXT,
  is_correct INTEGER,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quiz_id) REFERENCES quiz (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip_address TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quiz_created_at ON quiz(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login DESC);
CREATE INDEX IF NOT EXISTS idx_user_language_progress_last_practiced ON user_language_progress(last_practiced DESC);
CREATE INDEX IF NOT EXISTS idx_question_feedback_quiz_id ON question_feedback (quiz_id);
CREATE INDEX IF NOT EXISTS idx_question_feedback_user_id ON question_feedback (user_id);
