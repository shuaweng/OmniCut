export const terminalSetup = `
function typeInto(el, text, characters) {
  const content = text.slice(0, Math.max(0, Math.floor(characters)));
  if (el.textContent !== content) el.textContent = content;
}`;
