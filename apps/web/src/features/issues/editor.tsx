import Placeholder from '@tiptap/extension-placeholder'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

// Lazy-loaded (see description-editor.tsx) so TipTap stays out of the app shell chunk.
// Callers key this by the entity id; a new entity = a fresh editor, so no content-sync effect is needed.
export default function Editor({
  value,
  onChange,
  placeholder = 'Add a description…',
}: {
  value: JSONContent | null | undefined
  onChange: (json: JSONContent | null) => void
  placeholder?: string
}) {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: value ?? undefined,
    editorProps: { attributes: { class: 'tiptap min-h-[120px] text-sm focus:outline-none' } },
    onBlur: ({ editor }) => {
      if (editor.isDestroyed) return
      onChange(editor.isEmpty ? null : editor.getJSON())
    },
  })
  return <EditorContent editor={editor} />
}
