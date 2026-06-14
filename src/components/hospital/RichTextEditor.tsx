import { useRef, useState } from "react";
import { Bold, Italic, List, Heading2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder = "Enter notes..." }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const executeCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const insertTable = () => {
    const table = `<table style="width:100%;border-collapse:collapse;margin:10px 0;"><tbody><tr><td style="border:1px solid #ccc;padding:8px;">Cell 1</td><td style="border:1px solid #ccc;padding:8px;">Cell 2</td></tr><tr><td style="border:1px solid #ccc;padding:8px;">Cell 3</td><td style="border:1px solid #ccc;padding:8px;">Cell 4</td></tr></tbody></table>`;
    document.execCommand("insertHTML", false, table);
    editorRef.current?.focus();
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-muted/50 border-b border-border p-2 flex flex-wrap gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => executeCommand("bold")}
          className="h-8 w-8 p-0"
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => executeCommand("italic")}
          className="h-8 w-8 p-0"
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => executeCommand("underline")}
          className="h-8 w-8 p-0"
          title="Underline (Ctrl+U)"
        >
          <u className="text-sm font-bold">U</u>
        </Button>
        <div className="w-px bg-border mx-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => executeCommand("insertUnorderedList")}
          className="h-8 w-8 p-0"
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => executeCommand("insertOrderedList")}
          className="h-8 w-8 p-0"
          title="Numbered List"
        >
          <span className="text-xs font-bold">1.</span>
        </Button>
        <div className="w-px bg-border mx-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={insertTable}
          className="h-8 w-8 p-0"
          title="Insert Table"
        >
          <span className="text-xs font-bold">⊞</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => executeCommand("removeFormat")}
          className="h-8 w-8 p-0"
          title="Clear Formatting"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={cn(
          "min-h-[200px] p-4 outline-none prose prose-sm max-w-none",
          "bg-background text-foreground",
          "[&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-2",
          "[&_li]:list-inside [&_ol]:list-decimal [&_ul]:list-disc",
          isFocused && "bg-muted/30"
        )}
        dangerouslySetInnerHTML={{ __html: value }}
        suppressContentEditableWarning
      />
    </div>
  );
}
