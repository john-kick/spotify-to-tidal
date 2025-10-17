(async () => {
  const [ready, errors] = await checkLoginStatus();

  if (errors.length > 0) {
    console.error("Errors occurred while checking login status:", errors);
  }

  if (!ready) {
    console.log(
      "User not authenticated in both services, redirecting to login page"
    );
    window.location.href = "/auth";
  }

  if (ready) {
    initFormEvents();
    hydrate();
  }
})();

function hydrate() {
  document.body.querySelector("main").hidden = "false";
}

async function checkLoginStatus() {
  let authorized = true;
  const errors = [];
  await fetch("/spotify/status")
    .then((response) => response.json())
    .then((data) => {
      if (!data.authorized) {
        authorized = false;
      }
    })
    .catch((error) => {
      errors.push({ service: "spotify", error });
    });
  await fetch("/tidal/status")
    .then((response) => response.json())
    .then((data) => {
      if (!data.authorized) {
        authorized = false;
      }
    })
    .catch((error) => {
      errors.push({ service: "tidal", error });
    });

  return [authorized, errors];
}

function initFormEvents() {
  document
    .getElementById("migrate-form")
    .addEventListener("submit", handleMigrate);

  document
    .getElementById("delete-tracks")
    .addEventListener("submit", handleDeleteTracks);

  document
    .getElementById("delete-playlists")
    .addEventListener("submit", handleDeletePlaylists);
}

function handleMigrate(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const selectedOptions = Array.from(formData.entries()).map(
    (entry) => entry[0]
  );
  fetch("/migrate/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ options: selectedOptions })
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Migration result:", data);
      // Handle the migration result as needed
    })
    .catch((error) => {
      console.error("Error during migration:", error);
    });
}

function handleDeleteTracks(event) {
  event.preventDefault();
  fetch("/tidal/tracks", {
    method: "DELETE"
  }).catch((error) => {
    console.error("Error deleting liked tracks:", error);
  });
}

function handleDeletePlaylists(event) {
  event.preventDefault();
  fetch("/tidal/playlists", {
    method: "DELETE"
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Delete playlists result:", data);
      // Handle the deletion result as needed
    })
    .catch((error) => {
      console.error("Error deleting playlists:", error);
    });
}
