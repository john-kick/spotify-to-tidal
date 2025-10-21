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
  // FormData only includes "successful" controls (e.g. checked checkboxes).
  // To capture all migration options (checked or not), read the checkbox
  // inputs explicitly and send their boolean checked state.
  const form = event.target;
  const checkboxes = Array.from(
    form.querySelectorAll('input[type="checkbox"][name]')
  );
  const options = {};
  checkboxes.forEach((cb) => {
    options[cb.name] = !!cb.checked;
  });

  fetch("/migrate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ options })
  })
    .then((response) => response.json())
    .then((data) => {
      trackProgress(data.uuid);
    })
    .catch((error) => {
      console.error("Error during migration:", error);
    });
}

function handleDeleteTracks(event) {
  event.preventDefault();
  fetch("/tidal/tracks", {
    method: "DELETE"
  })
    .then((res) => res.json())
    .then((res) => trackProgress(res.uuid))
    .catch((error) => console.error("Error deleting liked tracks:", error));
}

function handleDeletePlaylists(event) {
  event.preventDefault();
  fetch("/tidal/playlists", { method: "DELETE" })
    .then((res) => res.json())
    .then((res) => trackProgress(res.uuid))
    .catch((error) => console.error("Error deleting playlists:", error));
}

function trackProgress(uuid) {
  const eventSource = new EventSource(`/progress?uuid=${uuid}`);

  const progressElement = document.createElement("div");
  const progressTitleElement = document.createElement("h2");
  const progressContentElement = document.createElement("div");
  const progressTextElement = document.createElement("div");
  const progressBarElement = document.createElement("div");

  progressElement.classList.add("progress");
  progressTitleElement.classList.add("progress-title");
  progressContentElement.classList.add("progress-content");
  progressTextElement.classList.add("progress-text");
  progressBarElement.classList.add("progress-bar");

  progressContentElement.appendChild(progressTextElement);
  progressContentElement.appendChild(progressBarElement);

  progressElement.appendChild(progressTitleElement);
  progressElement.appendChild(progressContentElement);

  document.body.appendChild(progressElement);

  progressTitleElement.innerText = "Processing";
  progressBarElement.hidden = true;

  eventSource.onmessage = (event) => {
    const { text, progressBar, status } = JSON.parse(event.data);

    if (status && status === "done") {
      eventSource.close();

      progressTextElement.innerText = "DONE";

      setTimeout(() => {
        progressElement.remove();
      }, 2000);
      return;
    }

    console.log(event.data);

    progressTextElement.innerText = text;
    if (progressBar) {
      progressBarElement.hidden = false;
      progressBarElement.style.width =
        (progressBar.current / progressBar.total) * 100 + "%";
    } else {
      progressBarElement.hidden = true;
    }
  };
}
