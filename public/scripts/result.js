document.addEventListener("DOMContentLoaded", async () => {
  const main = document.querySelector("main");
  main.removeAttribute("hidden");

  const pageContent = document.getElementById("page-content");

  const result = await fetchResult(
    new URLSearchParams(window.location.search).get("uuid")
  );

  const pulser = document.querySelector(".pulser");
  pulser.remove();

  if (result === null) {
    const errorMessage = document.createElement("p");
    errorMessage.textContent = "Error: No result found.";
    pageContent.appendChild(errorMessage);
    return;
  }

  if (result.likedSongs !== undefined) {
    createLikedSongsSection(result.likedSongs);
  }

  if (result.playlistsMigrated !== undefined) {
    createPlaylistSection(result.playlistsMigrated);
  }
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

function createLikedSongsSection(likedSongs) {}

function createPlaylistSection(playlistResult) {}
