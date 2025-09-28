document
  .getElementById("migrate-form")
  .addEventListener("submit", function (event) {
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
  });

document
  .getElementById("delete-tracks")
  .addEventListener("submit", function (event) {
    event.preventDefault();
    fetch("/tidal/tracks", {
      method: "DELETE"
    }).catch((error) => {
      console.error("Error deleting liked tracks:", error);
    });
  });

document
  .getElementById("delete-playlists")
  .addEventListener("submit", function (event) {
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
  });
