document.addEventListener("DOMContentLoaded", () => {
  const main = document.querySelector("main");
  main.removeAttribute("hidden");
});

async function fetchResult(id) {
  const response = await fetch(`/migrate/${id}`);
}
