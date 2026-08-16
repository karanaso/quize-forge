"use client";

import type { PersistedQuestion } from "@/lib/schemas";
import { useI18n } from "@/stores/locale";

export function QuestionEditor({
  question,
  onChange,
}: {
  question: PersistedQuestion;
  onChange: (patch: Partial<PersistedQuestion>) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-zinc-700">{t("QuestionEditor", "Question text")}</span>
        <textarea
          value={question.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      {question.kind === "mc" && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-zinc-700">{t("QuestionEditor", "Options")}</span>
          {question.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                checked={question.correctIndex === i}
                onChange={() => onChange({ correctIndex: i })}
                className="h-4 w-4 shrink-0"
              />
              <input
                value={opt}
                onChange={(e) => {
                  const options = [...question.options];
                  options[i] = e.target.value;
                  onChange({ options });
                }}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {question.kind === "tf" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={question.correct}
            onChange={(e) => onChange({ correct: e.target.checked })}
            className="h-4 w-4"
          />
          {t("QuestionEditor", "Statement is true")}
        </label>
      )}

      {question.kind === "fill" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">{t("QuestionEditor", "The blank")}</span>
            <input
              value={question.blank}
              onChange={(e) => onChange({ blank: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-zinc-700">
              {t("QuestionEditor", "Acceptable answers (one per line)")}
            </span>
            <textarea
              value={question.acceptableAnswers.join("\n")}
              onChange={(e) =>
                onChange({
                  acceptableAnswers: e.target.value
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              rows={2}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      {question.kind === "matching" && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-zinc-700">{t("QuestionEditor", "Pairs (term → definition)")}</span>
          {question.pairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={pair.left}
                onChange={(e) => {
                  const pairs = [...question.pairs];
                  pairs[i] = { ...pairs[i], left: e.target.value };
                  onChange({ pairs });
                }}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
              <span className="text-zinc-400">→</span>
              <input
                value={pair.right}
                onChange={(e) => {
                  const pairs = [...question.pairs];
                  pairs[i] = { ...pairs[i], right: e.target.value };
                  onChange({ pairs });
                }}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-zinc-700">{t("QuestionEditor", "Points")}</span>
          <input
            type="number"
            min={1}
            max={100}
            value={question.points}
            onChange={(e) => onChange({ points: Number(e.target.value) || 1 })}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-zinc-700">{t("QuestionEditor", "Explanation")}</span>
          <input
            value={question.explanation}
            onChange={(e) => onChange({ explanation: e.target.value })}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
    </div>
  );
}
