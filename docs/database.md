# Database structure

QuizForge uses **MongoDB** (via Mongoose) with **GridFS** for the binary
PDFs and figure images. There are three application collections
(`quizzes`, `pdfs`, `attempts`) plus the two GridFS collections
(`fs.files`, `fs.chunks`).

## Logical diagram (Mermaid)

```mermaid
erDiagram
    USERS {
        string userId "sha256(username) - derived, not stored"
    }

    QUIZZES ||--o{ ATTEMPTS : "has"
    QUIZZES }o--o| PDFS : "generated from (pdfId)"
    PDFS ||--o| FS_FILES : "stores binary (gridfsId)"
    QUIZZES ||--o{ QUESTIONS : "embeds"
    QUESTIONS }o--o| FS_FILES : "figure (imageId)"
    USERS ||--o{ QUIZZES : "owns (ownerId)"
    USERS ||--o{ PDFS : "owns (ownerId)"

    QUIZZES {
        ObjectId _id PK
        string title
        string ownerId FK "indexed"
        ObjectId pdfId FK "optional"
        string sourceFilename
        int pageFrom
        int pageTo
        string difficulty "easy|medium|hard"
        string language "content language"
        array questions "embedded subdocs"
        object config "timer/shuffle"
        string status "draft|published"
        date createdAt
        date updatedAt
    }

    QUESTIONS {
        string id
        string kind "mc|tf|fill|matching"
        string text
        array options "mc"
        int correctIndex "mc"
        boolean correct "tf"
        string blank "fill"
        array acceptableAnswers "fill"
        array pairs "matching"
        int points
        string imageId FK "optional figure"
        string imageCaption
        string explanation
    }

    PDFS {
        ObjectId _id PK
        string filename "uuid.pdf"
        string ownerId FK "indexed"
        string originalName
        int pageCount
        int size "bytes"
        ObjectId gridfsId FK "unique -> fs.files"
        date createdAt
        date updatedAt
    }

    ATTEMPTS {
        ObjectId _id PK
        ObjectId quizId FK "indexed"
        string school
        string className
        string studentName
        array answers "embedded, with correct flag"
        int score
        int totalPoints
        int correctCount
        int durationSec
        date startedAt
        date createdAt
        date updatedAt
    }

    FS_FILES {
        ObjectId _id PK
        long length
        int chunkSize
        date uploadDate
        string filename
        object metadata "kind: pdf|question-image"
    }

    FS_CHUNKS {
        ObjectId _id PK
        ObjectId files_id FK "-> fs.files"
        int n
        binary data
    }
```

## Collections

### `quizzes`

One document per quiz. The questions and configuration are **embedded**
subdocuments (a single document read carries the whole quiz, which is what
the student flow needs).

| Field         | Type          | Notes                                              |
| ------------- | ------------- | -------------------------------------------------- |
| `_id`         | ObjectId      | Primary key                                        |
| `title`       | string        |                                                    |
| `ownerId`     | string        | sha256 of the teacher username; **indexed**        |
| `pdfId`       | ObjectId      | Reference to `pdfs._id` (optional)                 |
| `sourceFilename` | string    | Original uploaded PDF name                         |
| `pageFrom` / `pageTo` | int  | Page range used for generation                     |
| `difficulty`  | enum          | `easy` \| `medium` \| `hard`                       |
| `language`    | string        | Language the AI detected in the book               |
| `questions`   | array         | Embedded question subdocuments (see below)         |
| `config`      | object        | `{ timerMinutes, shuffleQuestions, shuffleOptions }` |
| `status`      | enum          | `draft` \| `published`                             |
| `createdAt` / `updatedAt` | date | Mongoose timestamps                            |

Each entry in `questions` carries `id`, `kind`, `text`, `points`,
`explanation`, and then kind-specific fields:

| `kind`      | Extra fields                                          |
| ----------- | ----------------------------------------------------- |
| `mc`        | `options[]` (exactly 4), `correctIndex`               |
| `tf`        | `correct` (boolean)                                   |
| `fill`      | `blank`, `acceptableAnswers[]`                        |
| `matching`  | `pairs[]` of `{ left, right }`                        |
| any         | `imageId` (optional, → `fs.files`), `imageCaption`    |

### `pdfs`

Metadata for each uploaded PDF. The actual bytes live in GridFS; `gridfsId`
links them.

| Field          | Type      | Notes                                       |
| -------------- | --------- | ------------------------------------------- |
| `_id`          | ObjectId  | Primary key                                 |
| `filename`     | string    | `<uuid>.pdf`                                |
| `ownerId`      | string    | sha256 of the teacher username; **indexed** |
| `originalName` | string    | Name of the uploaded file                   |
| `pageCount`    | int       | Used for range validation                   |
| `size`         | int       | Bytes                                       |
| `gridfsId`     | ObjectId  | **unique** → `fs.files._id`                 |
| `createdAt` / `updatedAt` | date | Mongoose timestamps              |

### `attempts`

One document per student submission. Students are **anonymous** — they are
identified only by the free-text `school` / `className` / `studentName`.

| Field            | Type      | Notes                                              |
| ---------------- | --------- | -------------------------------------------------- |
| `_id`            | ObjectId  | Primary key                                        |
| `quizId`         | ObjectId  | → `quizzes._id`; **indexed**                       |
| `school` / `className` / `studentName` | string | Student identity                     |
| `answers`        | array     | Embedded answer subdocuments + a `correct` flag    |
| `score` / `totalPoints` / `correctCount` | int | Graded result                         |
| `durationSec`    | int       | Time taken                                          |
| `startedAt`      | date      | When the student began                             |
| `createdAt` / `updatedAt` | date | Mongoose timestamps                          |

The compound index
`{ quizId: 1, school: 1, className: 1, studentName: 1 }` backs the
"best attempt per student" aggregation.

### GridFS: `fs.files` / `fs.chunks`

MongoDB's default `fs` bucket stores the binary payloads in 255 KB chunks:

| Collection | Contents |
| ---------- | -------- |
| `fs.files` | File metadata: `_id`, `length`, `chunkSize`, `uploadDate`, `filename`, `metadata` |
| `fs.chunks` | Binary data split into chunks: `files_id` → `fs.files._id`, `n` (chunk index), `data` |

Two kinds of blobs are stored, distinguished by `metadata.kind`:

- `"pdf"` — the uploaded textbook (`metadata.originalName`), linked from `pdfs.gridfsId`
- `"question-image"` — cropped figures embedded in questions (`metadata.contentType`), linked from `questions[].imageId`

## Relationships & integrity

- **1 PDF → N quizzes** (`quizzes.pdfId` → `pdfs._id`): one upload can back
  several quizzes. Deleting a PDF is not currently cascaded.
- **1 quiz → N attempts** (`attempts.quizId` → `quizzes._id`): many students
  submit; their best attempt is used for per-question stats.
- **1 owner → N quizzes/pdf** (`ownerId`): a single teacher per env today;
  the field exists so multi-account support can be added later.
- **questions[] and answers[] are embedded** — there are no separate
  question or answer collections.

## Design notes

- **Referential integrity is by convention, not enforced.** `pdfId`,
  `gridfsId`, `imageId` and `quizId` are not `$ref`-validated; orphaned
  references (e.g. after a deleted PDF) simply render as missing images.
- **No users collection yet.** The `ownerId` is the sha256 of
  `TEACHER_USERNAME`, derived in `src/lib/auth.ts`. Legacy documents
  without an `ownerId` are adopted by the first teacher on login
  (`src/lib/ownership.ts`).
- The dashboard list sorts by `updatedAt`; adding an index on
  `{ ownerId: 1, updatedAt: -1 }` would be the natural next step at scale.
