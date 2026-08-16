import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import mongoose from "mongoose";
import {
  PORT,
  TEST_MONGODB_URI,
  TEST_TEACHER,
  SESSION_SECRET,
  BASE_URL,
  PID_FILE,
} from "./config";

const root = process.cwd();

function killStaleServer() {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = Number(fs.readFileSync(PID_FILE, "utf8"));
      process.kill(-pid, "SIGKILL");
      process.kill(pid, "SIGKILL");
    }
  } catch {
    // already gone
  }
  fs.rmSync(PID_FILE, { force: true });
}

async function dropTestDb() {
  await mongoose.connect(TEST_MONGODB_URI);
  await mongoose.connection.db?.dropDatabase();
  await mongoose.disconnect();
}

async function waitForServer(timeoutMs = 180_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`${BASE_URL}/login`);
      if (res.status === 200) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) {
      throw new Error(`Server did not become ready within ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 750));
  }
}

export async function setup() {
  killStaleServer();
  await dropTestDb();
  process.stdout.write(`[setup] test DB ready: ${TEST_MONGODB_URI}\n`);

  process.stdout.write("[setup] building app...\n");
  execSync("npm run build", { stdio: "inherit", cwd: root, timeout: 300_000 });
  process.stdout.write("[setup] build done\n");

  const child = spawn(
    "npx",
    ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"],
    {
      cwd: root,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        MONGODB_URI: TEST_MONGODB_URI,
        TEACHER_USERNAME: TEST_TEACHER.username,
        TEACHER_PASSWORD: TEST_TEACHER.password,
        SESSION_SECRET,
      },
    },
  );
  fs.writeFileSync(PID_FILE, String(child.pid));

  await waitForServer();
  process.stdout.write(
    `[setup] server ready on ${BASE_URL} (pid ${child.pid})\n`,
  );
}

export async function teardown() {
  killStaleServer();

  try {
    await mongoose.connect(TEST_MONGODB_URI);
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
  } catch {
    // best-effort cleanup
  }
}
