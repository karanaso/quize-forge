import Image from "next/image";

export function QuizImage({
  imageId,
  alt,
  className,
}: {
  imageId?: string;
  alt: string;
  className?: string;
}) {
  if (!imageId) return null;
  return (
    <Image
      src={`/api/image/${imageId}`}
      alt={alt}
      width={640}
      height={480}
      className={`h-auto max-h-64 w-auto max-w-full rounded border border-zinc-200 object-contain ${className ?? ""}`}
      unoptimized
    />
  );
}
