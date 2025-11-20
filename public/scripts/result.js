document.addEventListener("DOMContentLoaded", async () => {
  const main = document.querySelector("main");
  main.removeAttribute("hidden");

  const result = await fetchResult(
    new URLSearchParams(window.location.search).get("uuid")
  );

  console.log(result);
});

async function fetchResult(uuid) {
  const response = await fetch(`/migrate/result?uuid=${uuid}`);
  if (response.status === 404) {
    console.error("No result found for uuid " + uuid);
    return null;
  }

  const result = await response.json();
  return result;
}
