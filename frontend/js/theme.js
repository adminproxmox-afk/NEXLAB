const themeKey = "nexlab-theme";
let theme = "dark";

try {
  if (localStorage.getItem(themeKey) === "light") theme = "light";
} catch {}

document.documentElement.dataset.theme = theme;
document.documentElement.style.colorScheme = theme;
document.querySelector('meta[name="theme-color"]')?.setAttribute(
  "content",
  theme === "light" ? "#f4f7f5" : "#111412",
);

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-theme-toggle]");
  if (!button) return;

  theme = theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "light" ? "#f4f7f5" : "#111412",
  );
  try {
    localStorage.setItem(themeKey, theme);
  } catch {}

  const nextTheme = theme === "dark" ? "світлу" : "темну";
  button.setAttribute("aria-label", `Перемкнути на ${nextTheme} тему`);
  button.title = `${theme === "dark" ? "Світла" : "Темна"} тема`;
  button.firstElementChild.textContent = theme === "dark" ? "☼" : "☾";
});
