const groups = [
  { name: "Questões", items: ["Banco de questões", "Discursivas"] },
  { name: "Treinar", items: ["Treino parcial", "Provas completas"] },
  { name: "Revisar", items: ["Caderno de erros", "Flashcards"] },
  { name: "Apoio", items: ["Biblioteca", "Conquistas", "Aulas"] },
];
const menuDialog = document.querySelector(".menu-dialog");
const accountDialog = document.querySelector(".account-dialog");
const heading = document.querySelector("h1");
const feedback = document.querySelector(".demo-feedback");

function destinationButton(label) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.destination = label;
  if (label === heading.textContent) button.setAttribute("aria-current", "page");
  return button;
}

function fillMenu(nav, selectedGroups = groups, includeHome = true) {
  nav.replaceChildren(...(includeHome ? [destinationButton("Início")] : []));
  for (const group of selectedGroups) {
    const section = document.createElement(group.name === "Apoio" ? "details" : "section");
    const label = document.createElement(group.name === "Apoio" ? "summary" : "h3");
    label.textContent = group.name;
    if (section.tagName === "DETAILS") {
      section.open = !includeHome || group.items.includes(heading.textContent);
    }
    section.append(label, ...group.items.map(destinationButton));
    nav.append(section);
  }
}

function updateRootSelection() {
  const selectedGroup = groups.find((group) => group.items.includes(heading.textContent));
  for (const button of document.querySelectorAll(".bottom-nav button")) {
    const active = button.dataset.destination === heading.textContent ||
      (selectedGroup && button.dataset.group === selectedGroup.name);
    if (active) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  }
}

function selectDestination(label) {
  heading.textContent = label;
  feedback.textContent = `Destino selecionado: ${label}. O conteúdo abaixo é apenas a amostra do protótipo.`;
  for (const nav of document.querySelectorAll(".sidebar, .menu-dialog nav")) fillMenu(nav);
  updateRootSelection();
  menuDialog.close();
  accountDialog.close();
}

for (const nav of document.querySelectorAll(".sidebar, .menu-dialog nav")) fillMenu(nav);
updateRootSelection();
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.hasAttribute("data-open-menu")) {
    fillMenu(menuDialog.querySelector("nav"));
    menuDialog.showModal();
  }
  if (button.hasAttribute("data-open-account")) accountDialog.showModal();
  if (button.hasAttribute("data-close")) button.closest("dialog").close();
  if (button.dataset.destination) selectDestination(button.dataset.destination);
  if (button.dataset.group) {
    fillMenu(menuDialog.querySelector("nav"), groups.filter((group) => group.name === button.dataset.group), false);
    menuDialog.showModal();
  }
});
document.querySelector(".filters").addEventListener("submit", (event) => {
  event.preventDefault();
  feedback.textContent = "Filtros demonstrativos. Nenhuma consulta foi enviada ao sistema.";
});
document.querySelector(".demo-resolve").addEventListener("click", () => {
  feedback.textContent = "A resolução continua no aplicativo. Este arquivo demonstra apenas a organização da tela.";
});
