import { Fragment, type ReactNode } from "react";

type MarkdownProps = {
  content: string;
};

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={idx} className="rounded bg-muted px-1.5 py-0.5 text-[12px]">
          {part.slice(1, -1)}
        </code>
      );
    }

    return <Fragment key={idx}>{part}</Fragment>;
  });
}

export function Markdown({ content }: MarkdownProps) {
  const lines = content.split("\n");
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (!listItems.length) return;

    nodes.push(
      <ul key={`list-${nodes.length}`} className="my-2 list-disc space-y-1 pl-5">
        {listItems.map((item, idx) => (
          <li key={`${item}-${idx}`}>{renderInline(item)}</li>
        ))}
      </ul>
    );

    listItems = [];
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim() || "";

    if (!line) {
      flushList();
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }

    flushList();
    nodes.push(
      <p key={`p-${i}`} className="leading-relaxed">
        {renderInline(line)}
      </p>
    );
  }

  flushList();

  return <div className="space-y-2">{nodes}</div>;
}
