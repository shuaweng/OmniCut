/** Commit a text draft at the user's editing boundary, including input-only fills. */
export function bindTextParameterCommit(
  control: HTMLInputElement | HTMLTextAreaElement,
  commit: (value: string) => void | boolean | Promise<void | boolean>,
): void {
  let lastAccepted = control.value;
  const pending = new Set<string>();
  const submit = async (): Promise<void> => {
    const next = control.value;
    if (next === lastAccepted || pending.has(next)) return;
    pending.add(next);
    try {
      if (await commit(next) !== false) lastAccepted = next;
    } finally {
      pending.delete(next);
    }
  };
  control.addEventListener("change", () => { void submit(); });
  control.addEventListener("blur", () => { void submit(); });
  control.addEventListener("keydown", (event) => {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key !== "Enter" || keyboard.isComposing) return;
    if (control.tagName === "TEXTAREA" && !keyboard.ctrlKey && !keyboard.metaKey) return;
    event.preventDefault();
    void submit();
  });
}
