export const PORT = 3313;
export const BASE_URL = `http://127.0.0.1:${PORT}`;

export const TEST_MONGODB_URI =
  "mongodb://127.0.0.1:27017/quizforge_test";

export const TEST_TEACHER = {
  username: "teacher",
  password: "quizforge-dev",
};

export const SESSION_SECRET =
  "integration-test-secret-that-is-long-enough-0123456789";

export const PID_FILE = "/tmp/quizforge-test-server.pid";
